---
name: implement-issue
description: Set up a feature branch for a GitHub issue with full context. Use when starting work on an issue.
argument-hint: <issue-number>
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(gh:*), Bash(netstat:*), Bash(taskkill:*)
---

# Implement Issue

Set up a working branch for a GitHub issue and gather implementation context.

## Step 0: Session hygiene

Launch the `session-start` agent to check for stale worktrees, branches, stashes, port conflicts, and open PRs. Present the report before proceeding.

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

Extract and present:
- **Title** and **labels**
- **Requirements** from the issue body (acceptance criteria, scope, constraints)
- **Recent comments** (last 10) — note any design decisions, edge cases, or follow-up context
- **Linked PRs** or related issues mentioned in body/comments

## Step 3: Branch setup

1. Ensure we're on `master` and up to date: `git checkout master && git pull origin master`
2. Generate branch name: `feature/<number>-<slugified-title>` (lowercase, hyphens, max 40 chars for slug)
3. Check if branch exists locally or on remote:
   - Local: `git branch --list 'feature/<number>-*'`
   - Remote: `git ls-remote --heads origin 'feature/<number>-*'`
4. If exists: `git checkout <branch>` (and pull if remote tracking exists)
5. If new: `git checkout -b <branch>`

## Step 4: Project context

Read `CLAUDE.md` to refresh on project conventions, architecture, and workflow rules.

## Step 5: Summary

Present a concise implementation brief:

```
## Ready to implement #<number>: <title>
**Branch**: `feature/<number>-<slug>`
**Labels**: <labels>
**Key requirements**: <2-4 bullet points from issue body>
**Context from comments**: <notable decisions or constraints, if any>
**Suggested approach**: <brief suggestion based on issue + codebase knowledge>
```

Then ask: "Ready to start, or do you want to discuss the approach first?"
