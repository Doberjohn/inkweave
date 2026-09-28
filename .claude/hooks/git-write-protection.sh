#!/usr/bin/env bash
# Hook: Block destructive git operations without explicit user approval
# Type: PreToolUse (Bash|PowerShell|Monitor)
#
# Soft block (commit, push): blocked by default, allowed with USER_APPROVED=1 prefix
#   Workflow: hook blocks → Claude presents summary → user says "go ahead" → retry with prefix
#   The prefix counts only as the literal start of a Bash tool call. PowerShell and Monitor
#   calls cannot carry it, so there a commit or push always blocks and moves to Bash.
# Hard block (checkout -- <path>, restore, reset --hard/--mixed, clean -f,
#   worktree remove/prune): always blocked, even with the prefix
# Hard block (piping commit/push): always blocked, INCLUDING with USER_APPROVED=1
#
# The command is parsed, not grepped (lib/shell-command.mjs, #607): git options before
# the subcommand, cd chains, nested shells and runners are seen through, while quoted
# text, heredoc bodies and comments never count. Policy: git-write-protection.mjs.
# Case table: __tests__/hooks.test.mjs, run by `pnpm test:scripts`.
#
# Exit 2 = block (stderr shown to Claude), Exit 0 = allow

HOOK_DIR=${BASH_SOURCE[0]%[/\\]*}
[ "$HOOK_DIR" = "${BASH_SOURCE[0]}" ] && HOOK_DIR=.

IFS= read -r -d '' INPUT
node "$HOOK_DIR/lib/run-hook.mjs" git-write-protection <<<"$INPUT"
STATUS=$?
case $STATUS in 0 | 2) exit "$STATUS" ;; esac

# The policy could not run at all (node or a module missing, a syntax error): fail
# closed for a command that mentions git (GIT too), open for everything else.
shopt -s nocasematch
case $INPUT in
  *git*)
    echo "git-write-protection failed to run its policy (exit $STATUS), so this git command is blocked to be safe. Fix the hook, or run the command manually." >&2
    exit 2
    ;;
esac
exit 0
