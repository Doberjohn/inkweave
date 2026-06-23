#!/usr/bin/env bash
# Hook: Auto-rebuild synergy engine + precompute synergies after editing source files
# Type: PostToolUse (Edit|Write)
#
# Reads the tool input JSON from stdin, checks if the edited file
# is inside packages/synergy-engine/src/, and triggers pnpm build:engine
# followed by pnpm precompute-synergies so the web app sees fresh data.
# Always exits 0 (PostToolUse hooks are informational).

INPUT=$(cat)

# Extract file_path from the JSON
FILE_PATH=$(echo "$INPUT" | node -e "
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try {
      const j = JSON.parse(d);
      console.log(j.tool_input?.file_path || '');
    } catch { console.log(''); }
  });
")

# Normalize backslashes to forward slashes (Windows paths)
FILE_PATH=$(echo "$FILE_PATH" | sed 's|\\|/|g')

# Check if the file is in the synergy engine source directory
if echo "$FILE_PATH" | grep -q "packages/synergy-engine/src/"; then
  cd "$CLAUDE_PROJECT_DIR" || exit 0

  # Build engine (capture success/failure)
  BUILD_OUT=$(pnpm build:engine 2>&1)
  BUILD_OK=$?

  if [ $BUILD_OK -ne 0 ]; then
    echo "[engine-auto-rebuild] BUILD FAILED"
    echo "$BUILD_OUT" | tail -5
    exit 0
  fi

  # Precompute synergies (capture summary line)
  PRECOMPUTE_OUT=$(pnpm precompute-synergies 2>&1)
  SUMMARY=$(echo "$PRECOMPUTE_OUT" | grep -E "playstyles|groups|matches|cards with")

  echo "[engine-auto-rebuild] OK — $SUMMARY"
fi
