#!/usr/bin/env bash
# PreToolUse (Edit|Write) guardrail — once per session, on the FIRST edit to
# deck-builder source, remind to verify the target issue's acceptance criteria
# before building. Non-blocking (always exit 0): it reminds, never blocks.
#
# Guards the #472->#468 scope drift: a cost-curve strip (a #468 DeckStatsBar
# item) got built across six turns while believing it surfaced the #472 advisor
# brain, because a prompt reframing was accepted without reading the issue body.
# See memory: verify-issue-body-before-building.
set -u

input=$(cat)

# file_path arrives with Windows backslashes; normalize to forward slashes.
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' | tr '\\' '/')
case "$path" in
  *apps/web/src/features/deck/*|*docs/deck-builder/*) ;;
  *) exit 0 ;; # not deck-builder source — say nothing
esac

# Fire at most once per session, keyed on the session id from the hook payload.
session=$(printf '%s' "$input" | jq -r '.session_id // "nosession"')
marker="${TMPDIR:-/tmp}/.inkweave-deck-issue-reminder-${session}"
[ -f "$marker" ] && exit 0
touch "$marker" 2>/dev/null || true

jq -n '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    additionalContext: "Deck-builder epic edit (first this session). GUARDRAIL: before building, run `gh issue view <N>` for the target milestone-#3 issue and restate its acceptance criteria, then confirm the current slice actually matches them. Treat a prompt reframing (\"X is the smallest first slice\") as a claim to verify against the issue, not as the spec. Guards the #472->#468 cost-curve drift."
  }
}'
exit 0
