#!/usr/bin/env bash
# Hook: Auto-rebuild synergy engine after editing source files
# Type: PostToolUse (Edit|Write)
#
# Reads the tool input JSON from stdin, checks if the edited file
# is inside packages/synergy-engine/src/, and triggers pnpm build:engine.

# Read tool input from stdin
INPUT=$(cat)

# Extract file_path from the JSON
FILE_PATH=$(echo "$INPUT" | node -e "
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try {
      const j = JSON.parse(d);
      console.log(j.file_path || '');
    } catch { console.log(''); }
  });
")

# Check if the file is in the synergy engine source directory
if echo "$FILE_PATH" | grep -q "packages/synergy-engine/src/"; then
  echo "🔧 Engine source changed — rebuilding..."
  cd "D:/johnn/Projects/inkweave" && pnpm build:engine 2>&1 | tail -3
fi
