---
description: Coding conventions for the synergy-engine package source.
paths:
  - "packages/synergy-engine/src/**"
---

# Synergy-engine source conventions

When editing engine source under `packages/synergy-engine/src/`:

- **Rule pattern:** add rules via the `SynergyRule` interface (pluggable rules pattern). Rules run at build time only; the web app consumes pre-computed JSON.
- **Where a rule's code lives:** card-text detection (roles and the patterns behind them) goes in `src/utils/detection/`, one module per rule doc (`*_RULE.md`), so all of a playstyle's rules share one module (every Location Control rule reads `locationControl.ts`, every tribe `tribes.ts`). A direct rule's own few patterns may sit beside the rule in `src/engine/rules.ts`, as in Shift Targets, Singer + Songs, Spike Suit and Free Play. `src/utils/cardHelpers.ts` holds only what several rules share (text normalization, keywords, Shift parsing, card types). Tests go in `src/__tests__/<rule>.test.ts`: CodeScene marks any module over 240 functions, test files included, so never pool one rule's tests into another rule's file.
- **Keep docs in sync:** when you change rule logic, scoring, or explanations, update the matching `packages/synergy-engine/*_RULE.md`. That doc is the rule's authoritative spec. CLAUDE.md carries only a registry row (rule name, playstyle id, doc link); update it only when you add, remove, or rename a rule. **Do not restate rule detail in CLAUDE.md** — it is always-loaded context.
- **New `PlaystyleId`:** two exhaustive `Record`s are keyed on it. A new id needs a `PLAYSTYLE_ROLES` entry (`src/utils/playstyleMechanics.ts`, its page's mechanic tiles) and a `PLAYSTYLE_UI` entry (the web app's `shared/constants/playstyleUi.ts`) or the build fails.
- **The web app runs none of the engine's rules or detectors** (#930): it imports types from the root, card helpers from `./card`, and display text from `./catalog.json`, which `scripts/write-catalog.mjs` writes from `getDisplayCatalog` (`src/engine/displayCatalog.ts`) after every build. Text the app shows goes into the catalog, and anything worked out per card goes into precompute's output (`_playstyleMechanics.json` holds each playstyle card's tile ids).
- **Auto-rebuild:** editing any file here triggers the `engine-auto-rebuild` hook (`pnpm build:engine` + `pnpm precompute-synergies`). No manual rebuild needed.
- **Name both cards with chips:** every explanation names its two cards with the `{A}` and `{B}` tokens, which the pair view draws as card chips and a tile's tooltip fills with names. `{A}` is the searcher (the card whose page shows the tile), `{B}` its partner. Name each card by its role (`tokenPair` in `ruleScoring.ts`), so the words hold from either page: "{A}'s Princess buff powers up {B}." on the payoff's page is "{B}'s Princess buff powers up {A}." on the member's. `getPairSynergies` swaps the tokens on lines from its reverse pass. Tunable texts in `tuning.json` use their own placeholders (`<BASE>`/`<SHIFT>`, `{RAMP}`/`{TRIGGER}`/`{COST}`), and `tuning.test.ts` checks each keeps both. `apps/web/src/shared/constants/__tests__/synergy-description-chips.test.ts` fails on a line that drops either token; only a Location row between two support cards names one card, the one with that row's role.
- **Tests read tuned values from `TUNING`, never as literals.** Admin's tuning editor commits `tuning.json` straight to `master`, so a test that pins one of its scores, lines or names fails on the editor's next edit. CI's `test:perturbed` runs the suite with every editable value changed (`src/__tests__/perturbTuning.ts`, #1015) and fails such a test: it rewords every line, name and tagline down to its placeholders, each named twice, so a check on any part of the wording fails, and it sets Ramp's scores apart, so a test that reads the wrong one of two tied keys fails too. Shift has more tiers than there are scores, so its tests check each tier's line as well as its score. A test that must tell tied keys apart sets scores of its own and restores them, as Ramp's chain-key routing tests do.
- **Coverage stats are generated, never typed.** Member counts, pair counts, and score distributions in `*_RULE.md` go stale on every set rotation. Re-derive them from the live engine; do not hand-transcribe.

## Scoring convention (5-baseline)

All playstyle rules share the same anchor: **5 = neutral default**. Same-axis density / parallel pressure pairs sit at 5. Anything above 5 must justify itself with a specific mechanical interaction (compounding role match, asymmetric kill combo, snowball chain). Audit rule: if you can't articulate why a pair scores above 5 in one sentence, it should probably be at 5.

| Score | Meaning |
|-------|---------|
| 5 | Same-deck density baseline (parallel pressure, no compounding) |
| 6 | Complementary roles on the same axis (e.g., burn ↔ steal) |
| 7 | Mechanical compounding (e.g., steal ↔ steal, member ↔ tribal) |
| 8 | Win-condition combo / peak chain (Discard enabler ↔ payoff, Toy search ↔ banish-trigger) |
| 9 | Snowball chain (none at present: community-vote tuning moved Ramp's deck-ramp ↔ repeating-trigger to 7) |
| 10 | Engine-bonus / community-tuned |

Display tiers: Perfect (>=9.5), Strong (7-9.4), Moderate (4-6.9), Weak (<4). All integers 1-10 are valid.

See `packages/synergy-engine/SCORING_DESIGN.md` for the full design rationale.
