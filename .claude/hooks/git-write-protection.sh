#!/usr/bin/env bash
# Hook: Block destructive git operations without explicit user approval
# Type: PreToolUse (Bash|PowerShell|Monitor)
#
# Soft block (commit, push): blocked by default, allowed with USER_APPROVED=1 prefix
#   Workflow: hook blocks → Claude presents summary → user says "go ahead" → retry with prefix
#   The prefix counts only as the literal start of a Bash tool call. PowerShell and Monitor
#   calls cannot carry it, so there a commit or push always blocks and moves to Bash.
# Hard block (checkout -- <path>, restore, reset --hard/--mixed, clean -f,
#   worktree remove/prune, and the worktree remover `pnpm worktree:remove` or
#   scripts/remove-worktree.mjs, #686): always blocked, even with the prefix
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
# closed for a command that has git as a word (GIT too) or names the worktree remover,
# open for everything else. The command is the payload's "command" field, with JSON
# line-break and tab escapes read as spaces; without one, the whole payload is checked.
# The remover's names are matched before that: they hold no backslash, so no escape can
# split them, while reading `\\remove` as `\r` + `emove` would.
shopt -s nocasematch
FIELD='"command"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)"'
if [[ $INPUT =~ $FIELD ]]; then COMMAND=${BASH_REMATCH[1]}; else COMMAND=$INPUT; fi
REMOVER='worktree:remove|remove-worktree\.mjs'
NAMES_REMOVER=
[[ $COMMAND =~ $REMOVER ]] && NAMES_REMOVER=1
COMMAND=${COMMAND//\\[nrt]/ }
GIT_WORD='(^|[^[:alnum:]_-])git([^[:alnum:]_]|$)'
if [[ -n $NAMES_REMOVER || $COMMAND =~ $GIT_WORD ]]; then
  echo "git-write-protection failed to run its policy (exit $STATUS), so this git or worktree-remover command is blocked to be safe. Fix the hook, or run the command manually." >&2
  exit 2
fi
exit 0
