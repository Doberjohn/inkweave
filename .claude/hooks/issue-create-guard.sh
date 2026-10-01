#!/usr/bin/env bash
# Hook: Redirect direct gh issue create to /draft-issue skill
# Type: PreToolUse (Bash|PowerShell|Monitor)
#
# Catches `gh issue create` (and its alias `gh issue new`) and points to the
# /draft-issue skill, which scores the draft against an 8-section rubric and
# publishes on approval.
#
# Bypass: SKILL_APPROVED=1 prefix, as the literal start of a Bash tool call (the
# skill itself uses it). PowerShell and Monitor calls cannot carry it, so there this
# always blocks.
# The command is parsed, not grepped (lib/shell-command.mjs, #607), so a PR body or
# a commit message that mentions the command never blocks. Policy: issue-create-guard.mjs.
#
# Exit 2 = block (stderr shown to Claude), Exit 0 = allow

HOOK_DIR=${BASH_SOURCE[0]%[/\\]*}
[ "$HOOK_DIR" = "${BASH_SOURCE[0]}" ] && HOOK_DIR=.

IFS= read -r -d '' INPUT
node "$HOOK_DIR/lib/run-hook.mjs" issue-create-guard <<<"$INPUT"
STATUS=$?
case $STATUS in 0 | 2) exit "$STATUS" ;; esac

# The policy could not run at all: fail closed for a command that has gh as a word
# followed by issue (in any case), open for everything else. The command is the
# payload's "command" field, with JSON line-break and tab escapes read as spaces;
# without one, the whole payload is checked.
shopt -s nocasematch
FIELD='"command"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)"'
if [[ $INPUT =~ $FIELD ]]; then COMMAND=${BASH_REMATCH[1]}; else COMMAND=$INPUT; fi
COMMAND=${COMMAND//\\[nrt]/ }
GH_ISSUE='(^|[^[:alnum:]_-])gh([^[:alnum:]_]|$).*issue'
if [[ $COMMAND =~ $GH_ISSUE ]]; then
  echo "issue-create-guard failed to run its policy (exit $STATUS), so this gh command is blocked to be safe. Fix the hook, or run the command manually." >&2
  exit 2
fi
exit 0
