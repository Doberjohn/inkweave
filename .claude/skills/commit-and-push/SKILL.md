---
name: commit-and-push
description: Run pre-commit checks, commit, push, and optionally create a PR. Use when the user wants to commit and push changes.
argument-hint: ["commit message"]
allowed-tools: Read, Grep, Glob, Bash(pnpm:*), Bash(git:*), Bash(USER_APPROVED=1 git:*), Bash(gh:*), Bash(netstat:*), Bash(taskkill:*)
---

# Commit and Push

Validate, commit, and push changes with full pre-commit checks.

## Step 1: Pre-commit checks

Run these in parallel and fix any errors before proceeding:

```bash
pnpm run lint    # 0 errors required (warnings OK)
pnpm run test    # All unit tests must pass
```

If lint or tests fail, fix the issues and re-run. Do NOT proceed to commit with failures.

## Step 2: Review changes

```bash
git status       # Show all modified, staged, and untracked files
git diff         # Show unstaged changes
git log --oneline -5  # Recent commits for message style reference
```

Present a summary of what will be committed. Flag any files that look like they shouldn't be committed (`.env`, credentials, large binaries, unrelated changes).

## Step 3: Commit

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

## Step 4: Pre-push E2E

Run E2E tests before pushing to catch rendering regressions:

```bash
pnpm --filter inkweave-web test:e2e --project chromium
```

This takes ~30-90 seconds. If E2E fails, diagnose and fix before pushing.

## Step 5: Push

```bash
USER_APPROVED=1 git push -u origin <branch>
```

The husky pre-push hook also runs E2E — this is the safety net.

After pushing, verify with `git log --oneline -3 origin/<branch>`.

## Step 6: PR (if needed)

If on a feature branch and no PR exists for it:
- Check: `gh pr list --head <branch>`
- If none, ask: "Want me to create a PR?"
- If yes, create with `gh pr create` including `Closes #<issue>` in the body.

## Step 7: CI monitoring

After push, check if CI is running:
```bash
gh run list --branch <branch> --limit 3
```

If any checks fail within the session, offer to diagnose with `gh run view --log-failed`.
