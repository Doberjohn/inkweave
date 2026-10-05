---
description: Testing conventions for Inkweave unit and integration test files.
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
---

# Test file conventions

When editing a `*.test.ts` / `*.test.tsx` file, follow Inkweave's testing style:

- Write focused, minimal tests, not exhaustive coverage.
- One test per distinct behavior; no redundant variations.
- Skip trivial edge cases unless they are critical paths.
- Prefer readability over coverage percentage.
- Aim for 5-15 tests per component/hook, not 30+.
- Read fixture and source files at module scope, not inside a test or hook. Vitest times test bodies (5 s) and hooks (10 s) but never the file import, and a cold read on the local HDD can take seconds (#712).
