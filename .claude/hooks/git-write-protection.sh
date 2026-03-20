#!/usr/bin/env bash
# Hook: Block destructive git operations without explicit user approval
# Type: PreToolUse (Bash)
#
# Soft block (commit, push): blocked by default, allowed with USER_APPROVED=1 prefix
#   Workflow: hook blocks → Claude presents summary → user says "go ahead" → retry with prefix
# Hard block (checkout --, restore, reset --hard, clean -f, worktree remove/prune): always blocked
#
# Exit 2 = block (stderr shown to user), Exit 0 = allow

INPUT=$(cat)

# Extract the command from the Bash tool input
COMMAND=$(echo "$INPUT" | node -e "
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try {
      const j = JSON.parse(d);
      console.log(j.tool_input?.command || '');
    } catch { console.log(''); }
  });
")

# --- Soft blocks: bypassable with USER_APPROVED=1 ---

if echo "$COMMAND" | grep -qE "git commit( |$|\")"; then
  if echo "$COMMAND" | grep -qE "^USER_APPROVED=1 "; then
    exit 0
  fi
  echo "Git commit detected. Present a summary of changes and get explicit user approval first." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE "git push( |$|\")"; then
  if echo "$COMMAND" | grep -qE "^USER_APPROVED=1 "; then
    exit 0
  fi
  echo "Git push detected. Get explicit user approval first. (E2E runs automatically via pre-push hook.)" >&2
  exit 2
fi

# --- Hard blocks: never bypassable ---

if echo "$COMMAND" | grep -qE "git checkout -- "; then
  echo "Destructive git checkout detected. This discards uncommitted changes. Run this manually." >&2
  exit 2
elif echo "$COMMAND" | grep -qE "git restore "; then
  echo "git restore detected. This can discard changes. Run this manually." >&2
  exit 2
elif echo "$COMMAND" | grep -qE "git reset --(hard|mixed)"; then
  echo "Destructive git reset detected. This can lose commits/changes. Run this manually." >&2
  exit 2
elif echo "$COMMAND" | grep -qE "git clean -[a-zA-Z]*f"; then
  echo "git clean -f detected. This permanently deletes untracked files. Run this manually." >&2
  exit 2
elif echo "$COMMAND" | grep -qE "git worktree (remove|prune)"; then
  echo "Worktree deletion detected. Worktrees may be active in other sessions. Run this manually." >&2
  exit 2
fi

# No match = allow (exit 0)
