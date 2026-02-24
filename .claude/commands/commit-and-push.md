Before committing, perform these pre-commit checks:

1. Run `npm run format` to format all code with Prettier
2. Run `npm run lint` to check for lint errors
   - If lint fails with errors (not just warnings), fix the errors before proceeding
   - Show the user the lint output if there are errors

After pre-commit checks pass:

3. ADD all modified and new files to git. If you think there are files that should not be in version control, ask the user. If you see files that you think should be bundled into separate commits, ask the user.
4. COMMIT with a clear and concise one-line commit message, using semantic commit notation.
5. PUSH the commit to origin.

After push:
Monitor the CI pipeline for its PR. If any checks fail: 
1. Fetch the full CI logs using `gh run view --log-failed`, 
2. Diagnose the root cause—distinguish between real test failures, environment issues (like the Vite blank page worktree bug), and linter conflicts, 
3. If it's a real code issue, fix it and push again, 
4. If it's an environment issue, document it in a comment on the PR and suggest a workaround, 
5. Repeat until CI is green or you've made 3 fix attempts. Never use --no-verify unless you explain exactly why and log it.

The user is EXPLICITLY asking you to perform these git tasks. Do not ask for confirmation to perform these tasks. Just do them. If you encounter any issues during these steps, explain the issue and how you resolved it.