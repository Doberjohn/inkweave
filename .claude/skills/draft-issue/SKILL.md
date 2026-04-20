---
name: draft-issue
description: Draft, evaluate, and publish a GitHub implementation plan issue from the current conversation context. Use when you have agreed on scope and are ready to draft an issue.
argument-hint: [optional: brief title hint]
allowed-tools: Read, Bash(gh:*)
---

# Draft Issue

Turn the current conversation's agreed action points into a scored, publication-ready
GitHub implementation plan issue. Follows the eight-section rubric used by the issue
evaluator.

## Step 1: Extract context from conversation

Read the current conversation history and extract everything needed to draft the issue.
Do not ask the user to repeat themselves — pull it directly from what has been discussed.

Extract:
- **The problem being solved** — why this work exists
- **The agreed approach** — what will be built and how
- **Rejected alternatives** — decisions made and why other paths were not taken
- **Constraints** — technical, operational, or product constraints that bound the solution
- **Codebase details** — file paths, components, scripts, APIs, external systems mentioned
- **Scope boundaries** — what is explicitly in and out of this issue
- **Deferred work** — anything agreed to be a follow-up issue
- **Prerequisites** — access, tools, or knowledge required before starting

If `$ARGUMENTS` is provided, use it as a title hint. Otherwise derive the title from the
agreed scope.

## Step 2: Clarifying questions

Before drafting, identify any gaps that would prevent writing a strong issue.

Ask clarifying questions only when:
- A required section cannot be written without information not present in the conversation
- Two plausible interpretations exist and the wrong one would produce incorrect steps
- A constraint or rollback path was never discussed and cannot be safely inferred

Maximum 3 questions. Do not ask about anything that can be reasonably inferred. Format
each question with the section it unblocks:

```
Before I draft, I need to clarify a few things:

1. [Section: Rollback] If the process fails mid-way, what is the exact rollback
   procedure? Should changes be reverted manually, or is there an automated undo path?

2. [Section: Prerequisites] Does the executor need a specific access role or permission
   level, or is a service key via environment variable sufficient?
```

**WAIT** for answers before proceeding. If no clarifying questions are needed, state
"I have enough context to draft — proceeding." and move to Step 3 immediately.

## Step 3: Draft the issue

Draft the complete issue body using the eight-section structure below. Apply the quality
criteria for each section — do not produce acceptable when strong is achievable from the
available context.

---

**## Context**

State why this process exists, when to trigger it, and what outcome it achieves.

Strong: names specific trigger conditions, explains motivation in terms of the system's
needs, states the outcome that defines success. A developer reading this six months from
now understands without any other context why this work was done.

---

**## Prerequisites**

Checkboxes covering three categories: required access (specific role named), required
tools (specific names and versions where relevant), required knowledge.

Strong: executor can confirm readiness in under two minutes. Nothing left to assumption.

```
- [ ] <specific access requirement — name the role>
- [ ] <specific tool — name and version if relevant>
- [ ] <specific knowledge requirement>
```

---

**## Implementation Steps**

Numbered imperative steps. Every command, file path, SQL statement, or shell invocation
in a fenced code block. Every step that produces observable output includes a verification
instruction. Use phase headers for multi-stage work.

Strong: executor can follow this without opening the codebase directly.

```
**Step N: <what this step achieves>**

<imperative instruction>

```<language>
<exact command or code>
```

**Verify:** <what to run and what to confirm>
```

---

**## Files Affected**

Table split into Created and Modified. Exact file paths. Purpose per file.

```
### Created
| File | Purpose |
|------|---------|
| `exact/path/to/file.ts` | One-line purpose |

### Modified
| File | Change |
|------|--------|
| `exact/path/to/file.ts` | What changes and why |
```

---

**## Testing / Verification**

Pass/fail checkboxes grouped by track or phase. Each checkpoint names a specific
observable outcome.

```
### <Track or phase name>
- [ ] <run X> → <confirm Y is observable>
```

---

**## Acceptance Criteria**

Checkboxes. Outcome-oriented. Pass/fail testable without judgment. No implementation
details. Covers all primary constraints from the agreed scope.

```
- [ ] <observable outcome — either passes or fails>
- [ ] <explicit constraint satisfied, e.g. "no PR required">
```

---

**## Rollback**

Separate instruction per track or phase. Exact command, file change, or dashboard action
per instruction. Covers partial and full rollback.

A single vague sentence like "revert all changes" is not acceptable — it implies safety
without providing it.

```
- **<Track name>:** `<exact command or action>` → <what this undoes>
- **Full rollback:** <ordered steps to undo everything>
```

---

**## References**

Links to related issues or PRs, official documentation for external systems, specific
internal files. All links specific — no homepage links.

---

Title: imperative form — "Add X", "Migrate Y to Z", "Implement X for Y".

## Step 4: Score the draft

Immediately after drafting, score it against the weighted rubric.

```
overall_score = max(
(
(Implementation Steps × 4) +
(Acceptance Criteria  × 4) +
(Rollback             × 4) +
(Context              × 3) +
(Prerequisites        × 3) +
(Testing/Verification × 3) +
(Files Affected       × 2) +
(References           × 2)
) / 25,
0.5
)
```

Present the score card alongside the draft:

```
## Draft issue

<full issue body>

---

## Quality score: <score>/10

| Section | Score | Level | Note |
|---|---|---|---|
| Implementation Steps | <n>/10 | Strong/Acceptable/Poor/Absent | <one sentence> |
| Acceptance Criteria  | <n>/10 | ... | ... |
| Rollback             | <n>/10 | ... | ... |
| Context              | <n>/10 | ... | ... |
| Prerequisites        | <n>/10 | ... | ... |
| Testing/Verification | <n>/10 | ... | ... |
| Files Affected       | <n>/10 | ... | ... |
| References           | <n>/10 | ... | ... |

**Severity findings:** <list if any, or "None">
**What would push this higher:** <specific targeted improvement, or "None" if 10/10>
```

## Step 5: Review and iterate

Ask:
```
Score: <score>/10. Ready to publish, or would you like to change anything?
Specify what to adjust and I will update the draft and re-score.
```

**WAIT** for the user's response.

If the user requests changes:
- Apply the changes precisely
- Re-score the updated draft
- Present the full updated draft and score card
- Ask again: "Updated score: <score>/10. Ready to publish?"

Repeat until the user explicitly approves.

If the user approves with a score below 7.0, surface a warning:

```
Note: This issue scores <score>/10. The quality gate in `implement-issue` will trigger
a rewrite prompt when this issue is picked up. Are you sure you want to publish as-is?
```

**WAIT** for explicit confirmation before publishing below 7.0.

## Step 6: Publish

On approval, create the issue:

```
gh issue create --title "<title>" --body "<approved body>"
```

Present the result:

```
Issue created: #<number> — <title>
<url>

To start implementation: implement-issue <number>
```