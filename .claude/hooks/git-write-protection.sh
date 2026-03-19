#!/usr/bin/env bash
# Hook: Block destructive git operations without explicit user approval
# Type: PreToolUse (Bash)
#
# Blocks: git commit, push, checkout --, restore, reset --hard, clean -f
# Allows: git status, diff, log, branch, stash list, fetch, worktree list, add
#
# When blocked, Claude Code shows the reason and the user can approve/deny
# via the tool approval prompt — keeping the human always in the loop.

INPUT=$(cat)

# Extract the command from the Bash tool input
COMMAND=$(echo "$INPUT" | node -e "
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try {
      const j = JSON.parse(d);
      console.log(j.command || '');
    } catch { console.log(''); }
  });
")

# Check for destructive git operations
if echo "$COMMAND" | grep -qE "git commit( |$|\")"; then
  echo "BLOCK: Git commit detected. Present a summary of changes and get explicit user approval first."
elif echo "$COMMAND" | grep -qE "git push( |$|\")"; then
  echo "BLOCK: Git push detected. Get explicit user approval first. (E2E runs automatically via pre-push hook.)"
elif echo "$COMMAND" | grep -qE "git checkout -- "; then
  echo "BLOCK: Destructive git checkout detected. This discards uncommitted changes. Get explicit user approval first."
elif echo "$COMMAND" | grep -qE "git restore "; then
  echo "BLOCK: git restore detected. This can discard changes. Get explicit user approval first."
elif echo "$COMMAND" | grep -qE "git reset --(hard|mixed)"; then
  echo "BLOCK: Destructive git reset detected. This can lose commits/changes. Get explicit user approval first."
elif echo "$COMMAND" | grep -qE "git clean -[a-zA-Z]*f"; then
  echo "BLOCK: git clean -f detected. This permanently deletes untracked files. Get explicit user approval first."
elif echo "$COMMAND" | grep -qE "git worktree (remove|prune)"; then
  echo "BLOCK: Worktree deletion detected. Worktrees may be active in other CLI sessions. Get explicit user confirmation first."
fi

# No output = allow the command to proceed
