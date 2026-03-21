# Close-Session Branch Cleanup

**Date**: 2026-03-21
**Status**: Approved

## Problem

After merging PRs, local branches and stale remote tracking refs accumulate. The `/close-session` skill doesn't clean them up, and `session-start` only reports them. This led to 7+ stale branches and 35+ stale remote refs building up between sessions.

## Solution

Add merged branch cleanup to `/close-session` Step 2 (Session cleanup).

### Behavior

1. Run `git branch --merged master` (exclude `master` itself)
2. If merged branches found: list them, ask user to confirm, then delete with `git branch -d`
3. Run `git remote prune origin` unconditionally (report if refs were pruned)
4. If nothing to clean: skip silently

### Safety

- `git branch -d` refuses to delete unmerged branches (built-in Git safety)
- User confirmation required before deletion
- `git remote prune origin` is non-destructive (removes stale local refs only)
- No hook changes needed (`git branch -d` is not blocked by git-write-protection)
- Worktree handling unchanged (report only, never auto-delete)

## Files Changed

| File | Change |
|------|--------|
| `.claude/skills/close-session/SKILL.md` | Add merged branch + remote prune check to Step 2 |

## Not Changing

- git-write-protection hook (no new blocks needed)
- session-start agent (keeps its reporting role)
- Worktree deletion policy (stays hard-blocked)
