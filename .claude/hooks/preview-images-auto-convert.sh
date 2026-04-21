#!/usr/bin/env bash
# Hook: Auto-convert preview card raw images to AVIFs after raw-folder writes
# Type: PostToolUse (Edit|Write)
#
# Reads the tool input JSON from stdin, checks if the edited file
# is inside apps/web/public/card-images-raw/, and triggers
# pnpm convert-preview-images so the app sees fresh AVIFs without
# manual steps. Mirrors the engine-auto-rebuild pattern.
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

# Check if the file is in the preview card raw-images directory
if echo "$FILE_PATH" | grep -q "apps/web/public/card-images-raw/"; then
  cd "D:/johnn/Projects/inkweave" || exit 0

  # Convert raw images (script is idempotent — only processes new/changed files)
  CONVERT_OUT=$(pnpm convert-preview-images 2>&1)
  CONVERT_OK=$?

  if [ $CONVERT_OK -ne 0 ]; then
    echo "[preview-images-auto-convert] CONVERT FAILED"
    echo "$CONVERT_OUT" | tail -5
    exit 0
  fi

  # Extract the summary line (e.g. "Done in 23.9s: 69 converted, 0 skipped")
  SUMMARY=$(echo "$CONVERT_OUT" | grep -E "^\s*Done in" | head -1 | sed 's/^[[:space:]]*//')
  echo "[preview-images-auto-convert] OK — $SUMMARY"
fi
