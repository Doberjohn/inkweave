#!/usr/bin/env bash
# Hook: Auto-precompute synergies after preview card data JSON writes
# Type: PostToolUse (Edit|Write)
#
# Reads the tool input JSON from stdin, checks if the edited file is
# apps/web/public/data/previewCards.json, and triggers
# pnpm precompute-synergies so the web app sees fresh synergy data
# for newly-added cards. Mirrors the engine-auto-rebuild pattern.
# Always exits 0 (PostToolUse hooks are informational).
#
# Does NOT trigger on engine source edits — those are covered by
# engine-auto-rebuild.sh which also runs precompute.

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

# Check if the file is the preview card data JSON
if echo "$FILE_PATH" | grep -q "apps/web/public/data/previewCards\.json$"; then
  cd "D:/johnn/Projects/inkweave" || exit 0

  PRECOMPUTE_OUT=$(pnpm precompute-synergies 2>&1)
  PRECOMPUTE_OK=$?

  if [ $PRECOMPUTE_OK -ne 0 ]; then
    echo "[preview-data-auto-precompute] PRECOMPUTE FAILED"
    echo "$PRECOMPUTE_OUT" | tail -5
    exit 0
  fi

  SUMMARY=$(echo "$PRECOMPUTE_OUT" | grep -E "playstyles|groups|matches|cards with")
  echo "[preview-data-auto-precompute] OK — $SUMMARY"
fi
