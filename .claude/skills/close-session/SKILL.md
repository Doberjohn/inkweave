---
name: close-session
description: Update docs with today's progress before ending session
argument-hint: [summary of today's work]
allowed-tools: Read, Edit, Write, Bash(git:*), Bash(gh:*), Bash(netstat:*), Bash(taskkill:*)
---

# Close Session

Clean up and document before ending the session.

## Step 1: Review what was done

```bash
git log --oneline -10    # Recent commits
git status               # Uncommitted changes
```

If `$ARGUMENTS` is provided, use it as context for what was accomplished.

## Step 2: Session cleanup

Check each and report findings:

- **Dev servers**: Check ports 5173-5175 for running processes. On Windows: `netstat -ano | findstr ":5173 "`. Kill stale processes.
- **Worktrees**: `git worktree list`. If worktrees exist beyond main, remind user to clean up (NEVER remove without explicit confirmation).
- **Stashes**: `git stash list`. Warn about unlabeled or stale stashes.
- **Uncommitted work**: If changes exist, ask whether to commit (via `/commit-and-push`), stash with a label, or leave.

## Step 3: Update documentation

- **CLAUDE.md**: If changes affect architecture, conventions, or workflow rules, update the relevant sections.
- **MEMORY.md**: Update the "Current State" section with:
  - Current branch and any open worktrees/stashes being intentionally kept
  - What's ready for next session
  - Any blockers or open questions

## Step 4: Session summary

Present a concise summary:

```
## Session Complete
**Accomplished**: <what was done>
**Commits**: <list of commits pushed>
**Open items**: <anything left for next session>
**Cleanup status**: <servers stopped, worktrees noted, etc.>
```

Ask if the user wants to commit and push any documentation updates.
