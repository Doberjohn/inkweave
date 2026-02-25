# Implement Issue Command

    When starting a new session, follow this systematic approach:

    ## 0. Session Hygiene (Run First)
    Before anything else, clean up leftover state from previous sessions:

    - **WORKTREES**: Run `git worktree list`. If stale worktrees exist (not the main tree), ask the user whether to remove them with `git worktree remove --force <path>` and delete their branches with `git branch -D <branch>`.
    - **BRANCHES**: Run `git branch`. If feature branches exist that aren't the current branch, list them and ask the user which to delete.
    - **STASHES**: Run `git stash list`. If stashes exist, show them and ask whether to drop them.
    - **PORTS**: Check ports 5173-5175 for running dev servers. On Windows: `netstat -ano | findstr ":5173 "`. Kill any stale processes.
    - **REPORT**: Summarize what was found and cleaned. If everything is clean, say "Session hygiene: clean."

    ## 1. Issue Selection & Branch Setup
    After hygiene is done, help the user pick what to work on:

    1. Make sure we're on `master` and up to date: `git checkout master && git pull origin master`
    2. List open issues: `gh issue list --state open --limit 40`
    3. **ASK the user**: "Which issue number do you want to work on? (or 'skip' to stay on master)"
    4. **WAIT** for the user's response. Do NOT proceed until they answer.
    5. If the user provides an issue number:
       a. Fetch the issue title: `gh issue view <number> --json title,labels -q '.title'`
       b. Generate a branch name: `feature/<number>-<slugified-title>` (lowercase, hyphens, max 40 chars for the slug portion)
       c. Check if this branch already exists locally (`git branch --list 'feature/<number>-*'`) or on remote (`git ls-remote --heads origin 'feature/<number>-*'`)
       d. If exists: `git checkout <branch-name>`
       e. If not: `git checkout -b <branch-name>`
       f. Confirm: "Working on #<number>: <title> on branch `<branch-name>`"
    6. If the user says "skip", stay on master and proceed.

    ## 2. Project Overview & Structure
    - **READ** the README.md and CLAUDE.md files in the project's root folder.
    - **RUN** `git ls-files` to get a complete file inventory and understand the project structure.

    ## 3. Core Documentation
    - **READ and UNDERSTAND** the PLANNING.md file for:
      - Project architecture and design decisions
      - Technology stack and dependencies
      - Build, test, and deployment instructions
      - Future considerations and roadmap
    - **READ and UNDERSTAND** the TASK.md file for:
      - Completed work and implementation status
      - Current blockers or known issues
      - Next steps and priorities

    ## 4. Testing & Quality
    - **EXAMINE** test files to understand:
      - Testing patterns and frameworks used
      - Test coverage expectations
      - Integration vs unit test separation

    ## 5. Development Workflow
    - **CHECK** for automation files:
      - CI/CD pipelines (.github/workflows, .gitea/workflows)
      - Development environment setup
      - Code quality tools (linting, formatting configurations)

    ## 6. Documentation Maintenance
    - **UPDATE TASK.md** with each substantial change made to the project
    - **UPDATE PLANNING.md** if changes affect architecture or workflows

    ## 7. Knowledge Validation
    Before proceeding with any work, confirm understanding by being able to answer:
    - What is the primary purpose of this project?
    - How do I build, test, and run it locally?
    - What are the main architectural components and their responsibilities?
    - What's the current implementation status and what's next?
