# Close-Session Branch Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add merged branch cleanup and remote ref pruning to the `/close-session` skill.

**Architecture:** Single markdown edit — add a "Merged branches" bullet to Step 2 of the close-session skill, following the existing pattern of detect → report → act with confirmation.

**Tech Stack:** Claude Code skill (markdown)

**Spec:** `docs/superpowers/specs/2026-03-21-close-session-branch-cleanup-design.md`

---

### Task 1: Add branch cleanup to close-session skill

**Files:**
- Modify: `.claude/skills/close-session/SKILL.md:23-28` (Step 2 bullet list)

- [ ] **Step 1: Add merged branch cleanup bullet to Step 2**

Insert after the "Stashes" bullet (line 27) and before the "Uncommitted work" bullet (line 28):

```markdown
- **Merged branches**: Run `git branch --merged master | grep -v '^\*'` to find branches already merged. If any exist, list them and ask whether to delete. On confirmation, run `git branch -d <branch>` for each. If no merged branches found, skip silently.
- **Stale remote refs**: Run `git remote prune origin` unconditionally. Report if any refs were pruned, otherwise skip silently.
```

- [ ] **Step 2: Verify the edit**

Read the full file to confirm:
- "Merged branches" and "Stale remote refs" bullets sit between "Stashes" and "Uncommitted work"
- No existing content was lost
- Wording follows the same pattern as other bullets (detect, report, act)
- Remote prune is unconditional (not chained to branch deletion confirmation)

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/close-session/SKILL.md
git commit -m "infra(skills): add merged branch cleanup to close-session"
```
