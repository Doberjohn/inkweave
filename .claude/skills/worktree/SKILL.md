# Worktree Management
1. List current worktrees with `git worktree list`
2. If creating: `git worktree add ../worktree-<issue> -b feat/<issue-slug> master`
3. If removing: First `cd` out of the worktree, then `git worktree remove ../worktree-<issue> --force`
4. Never attempt to delete a worktree you are currently inside.
5. After removal, clean up with `git worktree prune`
