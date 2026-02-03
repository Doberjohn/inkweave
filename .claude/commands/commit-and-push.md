Before committing, perform these pre-commit checks:

1. Run `npm run format` to format all code with Prettier
2. Run `npm run lint` to check for lint errors
   - If lint fails with errors (not just warnings), fix the errors before proceeding
   - Show the user the lint output if there are errors

After pre-commit checks pass:

3. ADD all modified and new files to git. If you think there are files that should not be in version control, ask the user. If you see files that you think should be bundled into separate commits, ask the user.
4. COMMIT with a clear and concise one-line commit message, using semantic commit notation.
5. PUSH the commit to origin.

The user is EXPLICITLY asking you to perform these git tasks.
