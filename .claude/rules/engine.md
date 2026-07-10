---
description: Coding conventions for the synergy-engine package source.
paths:
  - "packages/synergy-engine/src/**"
---

# Synergy-engine source conventions

When editing engine source under `packages/synergy-engine/src/`:

- **Rule pattern:** add rules via the `SynergyRule` interface (pluggable rules pattern). Rules run at build time only; the web app consumes pre-computed JSON.
- **Keep docs in sync:** when you change rule logic, scoring, or explanations, update the matching `packages/synergy-engine/*_RULE.md`. That doc is the rule's authoritative spec. CLAUDE.md carries only a registry row (rule name, playstyle id, doc link); update it only when you add, remove, or rename a rule. **Do not restate rule detail in CLAUDE.md** — it is always-loaded context.
- **New `PlaystyleId`:** the web UI has exhaustive `Record`s keyed on it. A new id needs `PLAYSTYLE_UI`, `ROLE_CONFIGS`, and `STRUCTURAL_ROLE_DISPLAY` entries or the build fails.
- **Auto-rebuild:** editing any file here triggers the `engine-auto-rebuild` hook (`pnpm build:engine` + `pnpm precompute-synergies`). No manual rebuild needed.
- **Coverage stats are generated, never typed.** Member counts, pair counts, and score distributions in `*_RULE.md` go stale on every set rotation. Re-derive them from the live engine; do not hand-transcribe.

## Scoring convention (5-baseline)

All playstyle rules share the same anchor: **5 = neutral default**. Same-axis density / parallel pressure pairs sit at 5. Anything above 5 must justify itself with a specific mechanical interaction (compounding role match, asymmetric kill combo, snowball chain). Audit rule: if you can't articulate why a pair scores above 5 in one sentence, it should probably be at 5.

| Score | Meaning |
|-------|---------|
| 5 | Same-deck density baseline (parallel pressure, no compounding) |
| 6 | Complementary roles on the same axis (e.g., burn ↔ steal) |
| 7 | Mechanical compounding (e.g., steal ↔ steal, member ↔ tribal) |
| 8 | Win-condition combo / peak chain (Discard enabler ↔ payoff, Toy search ↔ banish-trigger) |
| 9 | Snowball chain (Ramp deck-ramp ↔ repeating-trigger) |
| 10 | Engine-bonus / community-tuned |

Display tiers: Perfect (>=9.5), Strong (7-9.4), Moderate (4-6.9), Weak (<4). All integers 1-10 are valid.

See `packages/synergy-engine/SCORING_DESIGN.md` for the full design rationale.
