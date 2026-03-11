---
allowed-tools: Bash(pnpm:*), Bash(node:*), Bash(git diff:*), Bash(wc:*), Bash(cat:*)
description: Rebuild engine + precompute synergies + validate output
---

Rebuild the synergy engine and regenerate all pre-computed synergy data.
Run each step sequentially, stopping if any step fails.

## Steps

1. **Rebuild the engine**
   ```
   pnpm build:engine
   ```
   If this fails, stop and report the error.

2. **Precompute synergies**
   ```
   pnpm precompute-synergies
   ```
   Capture and display the summary output (card count, group count, playstyle count).
   If this fails, stop and report the error.

3. **Validate output**
   Perform a quick sanity check on the generated data:
   - Count total files in `apps/web/public/data/synergies/`
   - Read `_manifest.json` and report how many cards have synergy data
   - Read `_playstyles.json` and report card counts per playstyle
   - Spot-check: pick 3 random card JSON files and verify they have non-empty `groups` arrays

4. **Report summary**
   Display a concise summary:
   - Engine build: OK/FAIL
   - Precompute: OK/FAIL (with counts)
   - Validation: OK/FAIL (with any issues found)
   - If working tree has uncommitted synergy engine changes, remind about running tests

Do NOT commit or push. Just build, generate, and validate.
