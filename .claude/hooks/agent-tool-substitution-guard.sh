#!/usr/bin/env bash
# Hook: Halt when a sub-agent reports a missing tool
# Type: PostToolUse (Agent)
#
# When a dispatched sub-agent's response indicates a required tool was
# unavailable in its sandbox, surface a warning to the model so it fixes
# the agent's `tools:` frontmatter rather than substituting from the
# main session.
#
# Why: agents are sandboxed checkpoints. Substituting bypasses the
# boundary and leaves the agent silently broken for the next caller.
#
# Exit 2 = warn the model (stderr shown), Exit 0 = allow

INPUT=$(cat)

# Extract the agent's response text. PostToolUse JSON shapes
# tool_response variably (string, object, array) — stringify whatever
# is there so the regex has something to scan.
RESPONSE=$(echo "$INPUT" | node -e "
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try {
      const j = JSON.parse(d);
      const r = j.tool_response;
      if (r == null) { console.log(''); return; }
      if (typeof r === 'string') { console.log(r); return; }
      console.log(JSON.stringify(r));
    } catch { console.log(''); }
  });
")

# Anchored on tool/MCP-specific language so the pattern doesn't trip on
# normal agent prose about 'tools,' 'registered,' or 'available.'
PATTERN='not available in this (environment|session)|not registered in my tool set|is not in my tool set|tools I have access to are[: ]|MCP tool .{1,80} is not available|MCP server .{1,80} not registered'

if echo "$RESPONSE" | grep -qiE "$PATTERN"; then
  cat >&2 <<'EOF'
[agent-tool-substitution-guard] HALT — sub-agent reported a missing tool.

A dispatched sub-agent reported it could not access a required tool. Do NOT
substitute by running the tool yourself from the main session — that bypasses
the agent's checkpoint design and leaves the agent's `tools:` frontmatter
silently broken for the next caller.

Required steps:
  1. Read the agent's frontmatter at .claude/agents/<name>.md
  2. Add the missing tool name to the `tools:` line
  3. Re-invoke the agent end-to-end to verify the fix
  4. Only then proceed with the workflow

Reference: memory/feedback_agent_tool_substitution.md
EOF
  exit 2
fi

exit 0
