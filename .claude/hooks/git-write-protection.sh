#!/usr/bin/env bash
# Hook: Block destructive git operations without explicit user approval
# Type: PreToolUse (Bash)
#
# Soft block (commit, push): blocked by default, allowed with USER_APPROVED=1 prefix
#   Workflow: hook blocks → Claude presents summary → user says "go ahead" → retry with prefix
# Hard block (checkout --, restore, reset --hard, clean -f, worktree remove/prune): always blocked
# Hard block (piping commit/push): always blocked, INCLUDING with USER_APPROVED=1
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

# --- Hard block: piping a commit or push hides whether it worked ---
#
# A pipeline reports the LAST command's exit status, so `git push | tail` returns
# tail's success even when the pre-push hook rejected the push. The failure is
# then invisible to anything reading the exit code, and the branch silently does
# not move. This has actually happened, and reading the memory that warns about it
# was not enough — hence a mechanism.
#
# Placed BEFORE the USER_APPROVED checks on purpose: approval is about whether the
# write should happen, not about whether its result may be hidden.
#
# NO ESCAPE HATCH, deliberately. `set -o pipefail` would make a pipeline report
# git's status honestly, but it cannot be used here: USER_APPROVED=1 must be the
# literal first characters of the command, so a `set -o pipefail; ` prefix breaks
# approval instead. Rather than loosen that anchor, there is simply no way to pipe
# a write — and nothing is lost, because the output of a failing commit or push is
# exactly what needs reading, and background runs already capture it to a file.
#
# Only SHELL text is scanned. Heredoc bodies and quoted spans are stripped first,
# because a commit MESSAGE describing this very rule contains the string it
# forbids — the guard blocked its own commit before this was added. `||` is masked
# too, so `git push || echo failed` stays legal; a guard that false-positives on a
# common idiom gets disabled within a week.
#
# Dropping from `<<` onward also drops a pipe placed AFTER a heredoc terminator.
# Accepted: that shape does not occur (push takes no heredoc), and erring toward
# allowing an exotic construct beats blocking every message that quotes the rule.
if echo "$COMMAND" | grep -qE "git (commit|push)"; then
  PIPE_SCAN=$(COMMAND="$COMMAND" node -e "
    let c = process.env.COMMAND || '';
    c = c.replace(/<<-?[ \t]*['\"]?[A-Za-z_][A-Za-z0-9_]*['\"]?[\s\S]*/, ' ');
    c = c.replace(/'[^']*'/g, \" '' \");
    c = c.replace(/\"[^\"]*\"/g, ' \"\" ');
    c = c.replace(/\|\|/g, ' OR ');
    console.log(c);
  ")
  if echo "$PIPE_SCAN" | grep -qE "git (commit|push)[^|]*\|"; then
    echo "Piped git commit/push detected. A pipeline reports the LAST command's exit" >&2
    echo "status, so a rejected pre-commit or pre-push hook looks green — this has" >&2
    echo "happened. Run it unpiped and read the full output; for long runs use a" >&2
    echo "background run and read its output file." >&2
    exit 2
  fi
fi

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
