---
name: implement-issue
description: Set up a feature branch for a GitHub issue with quality gate and full context. Use when starting work on an issue.
argument-hint: <issue-number>
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(gh:*), Bash(netstat:*), Bash(taskkill:*)
---

# Implement Issue

Set up a working branch for a GitHub issue, evaluate the issue quality against the
implementation plan rubric, and gather implementation context.

## Step 0: Session hygiene

Launch the `session-start` agent to check for stale worktrees, branches, stashes, port
conflicts, and open PRs. Present the report before proceeding.

If any finding is **blocking** (active port conflict on a dev port, uncommitted changes on
a branch tied to another issue, open PR awaiting review that the user may have forgotten),
**STOP and surface it explicitly** before proceeding. Ask whether to continue.

If findings are advisory only (stale remote branches, old stashes), note them and proceed.

## Step 1: Resolve the issue

If `$ARGUMENTS` is provided, use it as the issue number.
If not, list open issues and ask the user to pick one:
```
gh issue list --state open --limit 30
```
**WAIT** for the user's response before proceeding.

## Step 2: Fetch issue context

Fetch the issue details including body and recent comments:
```
gh issue view <number> --json title,body,labels,milestone,comments
```

Extract and hold internally (do not present yet):
- Full issue body
- Title and labels
- Last 10 comments — note any design decisions, scope changes, or constraints added
  after the original issue was written
- Linked PRs or related issues mentioned in body or comments

## Step 3: Evaluate issue quality

Evaluate the issue body against the eight-section implementation plan rubric below.
Score each section, calculate the weighted overall score, identify severity findings,
and decide whether to proceed or trigger the soft gate.

### Rubric

Score each section 0–10. A section that does not exist scores 0.

**Section weights:**

| Section | Weight | Critical if absent |
|---|---|---|
| Implementation Steps | 4 | Yes — without steps this is not a runbook |
| Acceptance Criteria | 4 | Yes — no definition of done |
| Rollback | 4 | Yes — production process is dangerous without it |
| Context | 3 | Important — future developers cannot understand why |
| Prerequisites | 3 | Important — process cannot be safely started |
| Testing / Verification | 3 | Important — no way to confirm success |
| Files Affected | 2 | Supporting |
| References | 2 | Supporting |

**Scoring per section:**

Implementation Steps
- Strong (8-10): Numbered imperative steps, code block per command/SQL/path, expected output per step, verification instruction per step, logically ordered
- Acceptable (5-7): Numbered and ordered but missing code blocks, expected output, or per-step verification
- Poor (1-4): Prose bullets or vague descriptions, no commands, cannot be followed without prior knowledge
- Absent (0): Section does not exist

Acceptance Criteria
- Strong (8-10): Checkboxes, outcome-oriented, pass/fail testable, no implementation details, covers all primary constraints
- Acceptable (5-7): Checkboxes present but one or more criteria are vague or a primary constraint is missing
- Poor (1-4): Prose statements, no checkboxes, not independently testable
- Absent (0): Section does not exist

Rollback
- Strong (8-10): Separate instruction per track or phase, exact command or file per instruction, covers partial and full rollback
- Acceptable (5-7): Present but covers only one track when multiple exist, or partially specific
- Poor (1-4): Single vague sentence such as "revert all changes" — worse than absent because it implies safety without delivering it. Flag as severity 4.
- Absent (0): Section does not exist

Context
- Strong (8-10): States why the process exists, when to trigger it, what outcome it achieves
- Acceptable (5-7): Covers why and when but one element is missing or vague
- Poor (1-4): Single sentence, no trigger conditions, no motivation
- Absent (0): Section does not exist

Prerequisites
- Strong (8-10): Checkboxes covering required access (specific roles), required tools (specific names), required knowledge
- Acceptable (5-7): Checkboxes present but one category missing or items vague
- Poor (1-4): General statement, no checkboxes, no specific named requirements
- Absent (0): Section does not exist

Testing / Verification
- Strong (8-10): Pass/fail checkboxes grouped by track or phase, observable objective outcomes, covers success and failure
- Acceptable (5-7): Checkboxes present but subjective language or a track is missing
- Poor (1-4): Single vague sentence, no checkboxes, no observable outcomes
- Absent (0): Section does not exist

Files Affected
- Strong (8-10): Split into Created and Modified, exact file paths, purpose per file
- Acceptable (5-7): Files listed but paths partial or purpose absent
- Poor (1-4): Directory names or component names, no exact paths
- Absent (0): Section does not exist

References
- Strong (8-10): Links to related issues/PRs, official docs for external systems, specific internal files — all links specific
- Acceptable (5-7): Present but incomplete
- Poor (1-4): One or two vague links that do not materially help an executor
- Absent (0): Section does not exist

### Scoring formula

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

Round to two decimal places.

### Severity findings

For each issue found, assign:
- Severity 4 — Catastrophic: blocks safe execution or creates production risk
- Severity 3 — Major: significant confusion or unsafe inference required
- Severity 2 — Minor: inconvenience but does not block execution
- Severity 1 — Cosmetic: does not affect execution

Key severity 4 triggers:
- Rollback present but single vague sentence
- Acceptance Criteria as prose with no checkboxes
- Implementation Steps as bullets with no commands

### Decision after scoring

**If overall_score >= 7.0:**
Present a compact quality note in the Step 6 brief and proceed to Step 4. Format:
```
Issue quality: <score>/10 — <one-line assessment>
Gaps noted: <severity findings if any, or "None">
```

**If overall_score < 7.0:**
Stop. Do not proceed to branch setup. Present the full evaluation:

```
## Issue quality gate: <score>/10

This issue does not meet the 7.0 threshold for safe implementation.
Proceeding risks Claude Code making unsafe assumptions in the gaps below.

**Section scores:**
<section> | <score>/10 | <level> | <one-sentence note>
...

**Severity findings:**
Sev <N> | <section> | <description>
...

**Rewritten issue:**
<complete rewritten issue using the eight-section structure, filled with all
available context from the original body, comments, and linked issues>
```

Then ask:
"This rewrite addresses the gaps above. Approve it and I will update the GitHub issue
before creating the branch — or paste your edits and I will apply them."

**WAIT** for explicit approval before proceeding.

On approval:
```
gh issue edit <number> --body "<approved body>"
```

Then proceed to Step 4.

## Step 4: Read project conventions

Read `CLAUDE.md` to establish:
- Branch naming convention for this project
- Architecture overview relevant to the issue
- Any workflow rules that affect implementation

Use the branch naming convention from CLAUDE.md in Step 5. If CLAUDE.md does not specify
a branch naming convention, fall back to `feature/<number>-<slugified-title>` (lowercase,
hyphens, max 40 chars for slug).

## Step 5: Branch setup

1. Ensure on `master` and up to date:
```
git checkout master && git pull origin master
```

2. Generate branch name using the convention from Step 4.

3. Check if branch already exists:
```
git branch --list 'feature/<number>-*'
git ls-remote --heads origin 'feature/<number>-*'
```

4. If exists: `git checkout <branch>` (and pull if remote tracking exists)
5. If new: `git checkout -b <branch>`

## Step 6: Summary

Present the full brief:

```
## Ready to implement #<number>: <title>

**Branch**: `<branch>`
**Labels**: <labels>
**Issue quality**: <score>/10 — <one-line assessment>

**Key requirements**:
<2-4 bullet points from issue body — acceptance criteria and constraints>

**Context from comments**:
<notable decisions, scope changes, or constraints added after the original issue>

**Suggested approach**:
<brief suggestion grounded in the issue content and CLAUDE.md architecture only>
```

Then ask: "Ready to start, or do you want to discuss the approach first?"