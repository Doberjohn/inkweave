---
name: create-issue
description: Create a GitHub issue with clarifying questions to refine the spec before creation. Use when the user asks to create, file, open, or add a new GitHub issue.
argument-hint: <brief description of what the issue is about>
allowed-tools: Bash(gh:*), Bash(git:*), Read, Grep, Glob
---

# Create Issue

Interactive workflow to refine issue specs through clarifying questions before creating the GitHub issue.

**CRITICAL**: NEVER create the issue immediately. Always go through the clarification steps first, even if the user provides a detailed description upfront. The goal is to pressure-test the spec together.

## Step 1: Understand the intent

If `$ARGUMENTS` is provided, use it as the starting context. Otherwise, ask: "What do you want to create an issue for?"

Before asking questions, quickly gather context:
- Check open issues for duplicates or related work: `gh issue list --state open --limit 50`
- Check recent closed issues for prior art: `gh issue list --state closed --limit 20`
- If the issue relates to existing code, read the relevant files to understand current state

## Step 2: Clarifying questions

Ask the user these questions **one batch at a time** (don't overwhelm with all at once). Adapt based on what they already provided:

### Round 1: Core spec

Present what you understand so far, then ask what's missing:

- **Type**: Is this a feature, bug fix, enhancement, chore, or docs?
- **Problem**: What problem does this solve? (For bugs: what's the expected vs actual behavior?)
- **Scope**: What's in scope and — just as importantly — what's explicitly out of scope?

**WAIT** for the user's response.

### Round 2: Details (adapt to type)

**For features/enhancements:**
- **Acceptance criteria**: What does "done" look like? (suggest 2-3 concrete criteria based on the discussion)
- **Dependencies**: Does this depend on or block other issues? Check the open issues list for connections.
- **Design needed?**: Does this need a mockup/design pass first, or can it go straight to implementation?

**For bugs:**
- **Reproduction steps**: Can you reproduce it consistently? What are the steps?
- **Severity**: Is this blocking, degraded experience, or cosmetic?
- **Workaround**: Is there a workaround users can use in the meantime?

**For chores/docs:**
- **Motivation**: Why now? What prompted this?
- **Verification**: How do we verify it's done correctly?

**WAIT** for the user's response.

### Round 3: Classification

- **Labels**: Suggest appropriate labels based on the issue type and content. Check existing labels first: `gh label list`
- **Milestone**: Does this belong to MVP v1.0 or post-launch? (If MVP, both `mvp` label AND `MVP v1.0` milestone must be set.)
- **Priority**: Is this blocking other work, or can it wait?

**WAIT** for the user's response.

## Step 3: Draft and review

Compose the full issue and present it to the user in this format:

```
## Issue Preview

**Title**: <concise title, imperative mood>
**Labels**: <comma-separated>
**Milestone**: <if applicable>

---

<issue body in markdown — problem statement, acceptance criteria, scope, technical notes>
```

Then ask: "Here's the draft. Want to change anything before I create it?"

**WAIT** for approval. Do not create the issue until the user explicitly approves.

## Step 4: Create the issue

Build the `gh issue create` command with all the refined details:

```bash
SKILL_APPROVED=1 gh issue create --title "..." --body "$(cat <<'EOF'
...
EOF
)" --label "label1,label2" [--milestone "MVP v1.0"]
```

> The `SKILL_APPROVED=1` prefix bypasses the `issue-create-guard` hook, which blocks direct `gh issue create` calls outside this skill.

After creation, display the issue URL.

## Step 5: Next steps

Ask: "Want to start working on this now? I can run `/implement-issue <number>` to set up the branch."
