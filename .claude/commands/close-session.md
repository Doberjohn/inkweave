---
allowed-tools: Read, Edit, Write, Bash(git:*)
description: Update docs with today's progress before ending session
argument-hint: [summary of today's work]
---

# Close Session - Update Documentation

Before ending this session, update the necessary documentation with today's progress.

## Context

Today's work summary: $ARGUMENTS

## Tasks

1. **Review what was done today**
   - Check recent commits: `git log --oneline -10`
   - Check current status: `git status`

2. **Update TASK.md** (if it exists)
   - Mark completed items as done
   - Add any new tasks discovered during work
   - Update progress notes

3. **Update CLAUDE.md** (if relevant changes were made)
   - Add new patterns, conventions, or architecture decisions
   - Document any new commands or scripts added
   - Update project structure if files/folders were reorganized

4. **Update PLANNING.md** (if it exists and relevant)
   - Update roadmap progress
   - Note any architectural decisions made
   - Document any deferred work or tech debt

5. **Create a brief session summary**
   - What was accomplished
   - What's ready for next session
   - Any blockers or open questions

After updating docs, ask if the user wants to commit and push the documentation updates.
