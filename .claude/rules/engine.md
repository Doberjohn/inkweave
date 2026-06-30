---
description: Coding conventions for the synergy-engine package source.
paths:
  - "packages/synergy-engine/src/**"
---

# Synergy-engine source conventions

When editing engine source under `packages/synergy-engine/src/`:

- **Rule pattern:** add rules via the `SynergyRule` interface (pluggable rules pattern). Rules run at build time only; the web app consumes pre-computed JSON.
- **5-baseline scoring discipline:** 5 = neutral same-deck-density default. Anything above 5 must justify itself with a specific mechanical interaction in one sentence. If you can't articulate why a pair scores above 5 in one sentence, it should be 5. (Full anchor table: CLAUDE.md "Scoring convention (5-baseline)".)
- **Keep docs in sync:** when you change rule logic, scoring, or explanations, update the matching `packages/synergy-engine/*_RULE.md` and the "Synergy Rules" section of CLAUDE.md (score tables, matchers, explanation templates, display tiers).
- **Auto-rebuild:** editing any file here triggers the `engine-auto-rebuild` hook (`pnpm build:engine` + `pnpm precompute-synergies`). No manual rebuild needed.
