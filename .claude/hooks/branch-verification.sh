#!/usr/bin/env bash
# Hook: Warn when editing source files on master or non-feature branches
# Type: PreToolUse (Edit|Write)
#
# Exit 2 = block with warning, Exit 0 = allow
# Only warns for app/package source files — ignores docs, config, .claude/

INPUT=$(cat)

# Extract file_path from the tool input
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

# Only check source files (apps/, packages/) — skip docs, config, .claude, memory
if ! echo "$FILE_PATH" | grep -qE "(apps/|packages/).*\.(ts|tsx|js|jsx|json|css)$"; then
  exit 0
fi

# Get current branch
BRANCH=$(git -C "D:/johnn/Projects/inkweave" branch --show-current 2>/dev/null)

if [ "$BRANCH" = "master" ] || [ "$BRANCH" = "main" ]; then
  echo "You are editing source files on '$BRANCH'. Did you forget to create a feature branch?" >&2
  exit 2
fi
