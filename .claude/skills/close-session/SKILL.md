---
name: close-session
description: Update docs with today's progress before ending session
argument-hint: [summary of today's work]
allowed-tools: Read, Edit, Write, Bash(git:*), Bash(gh:*), Bash(netstat:*), Bash(taskkill:*), Bash(du:*), Bash(find:*), Bash(ls:*), Bash(rm:*), Bash(node scripts/clean-transient.mjs:*)
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

- **Dev servers**: List every listener on the dev ports (5173-5175) and the local E2E range (5200-5299) with its owner's command line. On Windows, through Bash (the project settings already allow `powershell`):
  ```bash
  powershell -NoProfile -Command 'Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in (@(5173..5175) + @(5200..5299)) } | Sort-Object LocalPort -Unique | ForEach-Object { "{0} pid={1} {2}" -f $_.LocalPort, $_.OwningProcess, (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)").CommandLine }'
  ```
  Stop only servers this session started (the command line points into this checkout), with `powershell -NoProfile -Command 'Stop-Process -Id <pid> -Force'`. A server from another checkout is another session's live work: report it instead of killing it. An E2E server lives only as long as its run, so one from this checkout at session end is a leftover from a run that was killed.
- **Worktrees**: `git worktree list`. For each worktree beyond main that is done (its PR merged, or a spike dropped), give the owner the command to run from the main checkout: `pnpm worktree:remove <name>` (add `--dry-run` to see the plan first). Folders under `.claude/worktrees/` that `git worktree list` does not show are leftovers: `pnpm worktree:remove --leftovers --dry-run` lists them, and the same command without `--dry-run` deletes them. The hook blocks Claude from running either, so never remove a worktree yourself.
- **Stashes**: `git stash list`. Warn about unlabeled or stale stashes.
- **Merged branches**: Run `git branch --merged master | grep -v '^\*'` to find branches already merged. If any exist, list them and ask whether to delete. On confirmation, run `git branch -d <branch>` for each. If no merged branches found, skip silently.
- **Stale remote refs**: Run `git remote prune origin` unconditionally. Report if any refs were pruned, otherwise skip silently.
- **Uncommitted work**: If changes exist, ask whether to commit (via `/commit-and-push`), stash with a label, or leave.

## Step 3: Transient file cleanup

Run the cleanup script from the root of this session's checkout. It deletes what passes its guards **without asking**, and lists the rest:

```bash
node scripts/clean-transient.mjs
```

`scripts/clean-transient.mjs` is the source of truth for the tiers (#742). In short:

| Tier | Paths | Deleted without asking when |
|------|-------|-----------------------------|
| E2E artifacts | `apps/web/test-results/`, `apps/web/playwright-report/` | no E2E run is live anywhere on the machine, the newest file is over 30 minutes old, and git ignores it |
| Scratch | `.tmp-*/`, `tmp-*/`, `*.log`, `apps/web/*.log` | git ignores it and the newest file is over a day old |
| Unknown origin | `screenshots/`, and any path above that fails a guard | never: listed as `ask` |
| Protected | `.knowledge/`, `.worktrees/**`, `.claude/worktrees/**`, `apps/web/public/mockups/`, `dist/`, `coverage/`, `reports/`, `node_modules/` | never, and never listed |

A tracked or non-ignored path is always `ask`. If the live-run check fails, it counts as a live run. `--dry-run` prints the same plan and deletes nothing.

Report the `deleted` rows and the `freed` total. Then ask the owner only about the `ask` rows. On their explicit go, delete **only** the paths they approved, one by one, never by glob (`rm -rf <path>`). If they decline or don't answer, leave those paths in place. Delete a protected path **only** if the owner names it.

An E2E folder kept as `E2E run live` may belong to another session's run, since the check is machine-wide. Never delete it by hand to get past the guard.

Sessions write temporary logs, downloads and probe scripts to their **scratchpad directory**, never to `/tmp` or the repo, so nothing outside the tiers above should need cleaning. If this session wrote scratch anywhere else anyway, list it as well.

## Step 4: Update documentation

- **CLAUDE.md**: If changes affect architecture, conventions, or workflow rules, update the relevant sections.
- **MEMORY.md**: Update the "Current State" section with:
  - Current branch and any open worktrees/stashes being intentionally kept
  - What's ready for next session
  - Any blockers or open questions

## Step 5: Session summary

Present a concise summary:

```
## Session Complete
**Accomplished**: <what was done>
**Commits**: <list of commits pushed>
**Open items**: <anything left for next session>
**Cleanup status**: <servers stopped, worktrees noted, transient files removed + space freed, etc.>
```

Ask if the user wants to commit and push any documentation updates.
