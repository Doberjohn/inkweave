---
name: commit-and-push
description: Run pre-commit checks, commit, push, and optionally create a PR. Use when the user wants to commit and push changes.
argument-hint: ["commit message"]
allowed-tools: Read, Grep, Glob, Bash(pnpm:*), Bash(git:*), Bash(USER_APPROVED=1 git:*), Bash(gh:*), Bash(netstat:*), Bash(taskkill:*)
---

# Commit and Push

Validate, commit, and push changes with full pre-commit checks.

## Step 0: PR readiness check

Launch the `pr-ready` agent to run the full validation suite (lint, tests, E2E, branch naming, commit messages). Wait for its report before proceeding.

If the report shows **NOT READY**, fix the blocking issues first. Do NOT proceed to commit with failures.

## Step 0b: Engine validation (conditional)

Check if any files in `packages/synergy-engine/src/` are in the diff:
```bash
git diff --name-only HEAD | grep "packages/synergy-engine/src/"
```

If engine files were changed, launch the `engine-validator` agent to run the full engine pipeline (build → test → precompute → audit scores). Wait for its report before proceeding.

## Step 0c: Supabase validation (conditional)

Check if any files in `supabase/migrations/` are in the diff:
```bash
git diff --name-only HEAD | grep "supabase/migrations/"
```

If migration files were changed, launch the `supabase-validator` agent to run the full Supabase pipeline (integration tests → security advisor → type freshness → schema drift). Wait for its report before proceeding.

## Step 0d: Code complexity validation (always)

Launch the `codescene-validator` agent to analyze the current branch's change set against master using CodeScene MCP. Wait for its report before proceeding.

Handling the verdict:

- **PASSED**: continue to Step 1.
- **NEEDS REVIEW**: inspect the degraded list.
  - If any finding has `change-type = "introduced"` (a **net-new** complexity violation in this branch), treat as BLOCKING. Surface the table to the user and ask whether to refactor before pushing or accept the regression with explicit approval (`CODESCENE_APPROVED=1` in the user's response).
  - If all degraded files are pre-existing hotspots that CI's CodeScene gate will flag regardless of this branch, surface the table, note "pre-existing debt — not introduced by this change set", and proceed.
  - Never silently proceed past a failed gate — the user must see the degraded list before commit.

## Step 1: Review changes

```bash
git status       # Show all modified, staged, and untracked files
git diff         # Show unstaged changes
git log --oneline -5  # Recent commits for message style reference
```

Present a summary of what will be committed. Flag any files that look like they shouldn't be committed (`.env`, credentials, large binaries, unrelated changes).

## Step 2: Commit

If `$ARGUMENTS` is provided, use it as the commit message.
If not, draft a commit message following the project convention:
- Format: `type(scope): description (#issue)`
- Types: feat, fix, refactor, test, docs, perf, infra, chore
- Include issue number if on a feature branch (extract from branch name `feature/<number>-*`)

Stage relevant files (prefer explicit file names over `git add -A`), then commit:

```bash
USER_APPROVED=1 git add <files>
USER_APPROVED=1 git commit -m "<message>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

Use `timeout: 600000` for the commit command (pre-commit hooks run lint + test).

## Step 3: Push

```bash
USER_APPROVED=1 git push -u origin <branch>
```

The husky pre-push hook runs E2E as a safety net.

After pushing, verify with `git log --oneline -3 origin/<branch>`.

## Step 4: PR (if needed)

If on a feature branch and no PR exists for it:
- Check: `gh pr list --head <branch>`
- If none, ask: "Want me to create a PR?"
- If yes, create with `gh pr create` including `Closes #<issue>` in the body.

## Step 5: CI monitoring

After push, check if CI is running:
```bash
gh run list --branch <branch> --limit 3
```

If any checks fail within the session, offer to diagnose with `gh run view --log-failed`.
