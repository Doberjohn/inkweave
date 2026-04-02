#!/usr/bin/env bash
# Hook: Redirect direct gh issue create to /create-issue skill
# Type: PreToolUse (Bash)
#
# Catches direct `gh issue create` commands and reminds to use the
# /create-issue skill for proper spec refinement.
#
# Bypass: SKILL_APPROVED=1 prefix (used by the skill itself)
# Exit 2 = block (stderr shown to user), Exit 0 = allow

INPUT=$(cat)

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

if echo "$COMMAND" | grep -qE "(^|[ ;|&])gh issue create"; then
  if echo "$COMMAND" | grep -qE "^SKILL_APPROVED=1 "; then
    exit 0
  fi
  echo "Use /create-issue to refine the spec with clarifying questions first. The skill will call gh issue create when ready." >&2
  exit 2
fi

exit 0
