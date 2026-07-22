# Inkweave Deck Builder + Live Synergy Advisor — Master Plan

## Context

Inkweave has, until now, been a *read-only* synergy explorer: pick a card, see what pairs with it. Every rule, playstyle, and score we built was groundwork for the feature this plan describes — **a deck builder that actively guides players toward good decks**, using our synergy engine plus a research-grounded, rotation-proof model of what makes a Lorcana deck strong — and a **Deck Quality Score** that a human progressively calibrates and that other sites can embed.

The goal is not "another Dreamborn." It is: a builder where synergy detection (35 rules, 21 playstyles) drives live suggestions; a **deck-health advisor** that names what a deck lacks and what it's *vulnerable to*; a Dreamborn **collection** import that turns our engine into a migration tool (owned-card replacements); and an explainable **Inkweave Engine Score** the creator tunes via a human-in-the-loop loop and third parties can display.

**Product decisions locked in with the user:**
- **v1 headline = builder + live advisor + a composite Deck Quality Score**, on **Supabase Auth + cloud decks**. Social later.
- **Auth**: Supabase Auth, **Google + Discord** (none today).
- **Build flow**: **freeform builder + always-on advisor**, with a "deck core" (mark key cards) seeding suggestions.
- **Rules**: Core pool (Sets 9-13) — 60 min, ≤4 per unique `fullName`, ≤2 inks. **Enforcement split (revised in build):** the ≤4-copy cap is a hard block at the pool tile (the + goes inert); the **≤2-ink limit is advisory** — any ink is freely addable and going over two surfaces as a legality error (`calculateDeckStats.legalityErrors`) in the panel footer, rather than dimming/disabling off-ink pool cards. The pool's ink *filter* still uses deck-legality semantics (with two inks selected, a card's inks must be a subset of them).
- **Archetype**: **auto-detected + optional user-declared gameplan** (sharpens validation, esp. Ramp).
- **Matchups / meta**: **deferred** — scraped meta is stale; user gathers Set-13 meta after competitive play. Near-term advice is **intrinsic** (archetype + composition + vulnerabilities).
- **Collection** (Phase 2): per-user Collection entity, Dreamborn import, own/don't-own indicators, synergy-driven replacement suggestions.
- **Deck Quality Score learning**: **transparent weighted scorer + case library** (glass-box calibration + precedent retrieval; **not** ML).
- **External Engine Score**: **standalone package + hosted endpoint + embeddable widget** (the project's first serverless).
- **Interop**: import + export deck formats (Dreamborn / Pixelborn / TTS) + shareable links.
- **Mobile**: **full build-on-mobile** — first-class ergonomics.

**Guiding principle:** the advisor and score are **pool-driven, archetype-parameterized, and explainable — never hardcoded to a snapshot, never a black box.** Vulnerabilities derive from the live pool; targets from the archetype; matchups wait for real data; the score traces to arithmetic + named precedents. Correct across rotations, defensible to a competitive player.

**Memory corrections (actioned during Phase 0/1; kept for provenance):** `docs/deck-builder-resurrection-map.md` doesn't exist (old builder reconstructed from `e5ad4b4^`); "852 cards with synergies" is stale (~1024 Core / ~1278 synergy files); `CLAUDE.md:8` still lists "deck builder."

---

## Part A — The Deck-Health Framework (research payoff)

Computed from card fields (`cost`, `inkwell`, `type`, `classifications`, `strength`, `willpower`, `lore`, `keywords`, `text`) + precomputed synergy data. **Three tiers + a composite score.**

### Tier 1 — Hard rules (enforced)
| Rule | Value | Compute |
|---|---|---|
| Deck size | ≥60 (competitive = exactly 60) | `sum(quantity)` |
| Copy limit | ≤4 per **unique `fullName`** (*Stitch - Rock Star* ≠ *Stitch - Carefree Surfer*) | group by `fullName` |
| Ink limit | ≤2 inks (dual-ink counts as **both**) | union of `getInks` / pairwise `canShareDeck` |

### Tier 2 — Archetype-parameterized soft heuristics
**Classifier runs first.** Archetype ∈ `aggro | tempo | midrange | control | combo | ramp`, **auto-detected** (curve center + role densities + avg lore/cost), **overridable by `deck.gameplan`**. Each archetype supplies its own target profile.

Baseline (midrange; archetypes shift the dials):
| Dimension | Target (sourced) | Compute | Variance |
|---|---|---|---|
| Inkable ratio | 44-48 (official 47-49 / 11-13 uninkable) | `inkwell===true` count | aggro tolerates 18-20 uninkable |
| Curve shape | peak 2-3, front-load 1-4 (1→6-10,2→10-14,3→8-14,4→6-10,5→4-8,6+→4-8) | `cost` histogram | **ramp inverts** (below); control flatter |
| Card draw (pillar) | **≥4 floor (official)**; 6-10 *(soft)* | `getCardMechanics`⊇`'draw'` | control high |
| Removal (pillar) | **≥4 floor (official)**; ~6-10 *(soft)* | **new `getRemovalRoles`** | control 8-12, aggro ≤4 |
| Actions+Songs cap | ≤~25% (~15); song deck 12-15 | `type==='Action'` count | control 14-16 |
| Card-type mix | 22-26 char / 12-15 action / 4-6 item+loc | count by `type` | aggro chars 24-28; control 18-20 |
| Rule of Eight | core plan ≥8 interchangeable (~65% opening-7) | group by role/keyword/classification | universal |
| Consistency | exactly 60, ~15-20 distinct, favor 4-ofs | playset vs singleton share | universal |
| Lore output | enough board lore to race | `sum(lore×qty)` characters | aggro high, control low |
| Shift-target coverage | Shift card needs same-named base | `getShiftBaseNames` presence | universal |
| Synergy density | high aggregate, few weak links | precomputed `pairs` | universal |

**Ramp special validation:** when ramp is the plan, the curve analyzer **stops penalizing a gap** and validates the **curve-jump payoff** (ramp cost + amount → enough impactful bodies at the ramped-to ink). Each archetype can register plan-specific checks (aggro early pressure; combo payoff + Rule-of-Eight enablers).

**Hypergeometric reference (verified):** opening-7 P(≥1): 4-of 39.9%, 3-of 31.5%, 2-of 22.1%, 1-of 11.7%. Rule of Eight: 8 copies 65.4% (~90% fully mulliganed). 46 inkable → P(≥3) 99.4%.

### Tier 3 — Vulnerabilities / "What to watch for" (pool-derived, meta-free)
**Auto-derive a hoser catalog from the current Core pool** (scan conditional/mass removal via `getRemovalRoles`, extract each trigger condition: `low-strength ≤N`, `evasive`, `bodyguard`, `damaged`, `high-cost ≥N`, `mass`), then compute the deck's **exposure** and surface the sharp ones: *"68% of your characters have ≤2 strength — a low-strength wipe (Under the Sea-type) blows you out."* No hardcoded card names (survives rotation). Precomputed to `public/data/hosers.json` (hybrid: auto-derived + small curated override).

### Composite: Deck Quality Score (v1 output; calibrated in Part C)
`DeckQualityScore ∈ 0-100 = Σ(weightᵢ × dimensionScoreᵢ)` over the Tier-2 dimensions (normalized 0-1) + archetype coherence − vulnerability penalty. **Every score returns a breakdown** (per-dimension contribution + reasons). Weights/thresholds live in a versioned, snapshot-guarded config (`scoring.json`, extending `tuning.json`). Ships with default weights in v1; Part C makes it learn.

### Pros/cons + matchups
Pros/cons from analyzer statuses + archetype. **Matchups deferred** to Phase 6 (no meta-weighting until Set-13 data); near-term hints are intrinsic + framed as estimates.

---

## Part B — Architecture (grounded in exploration)

- **Stack**: static Vite SPA on Vercel, **no serverless yet** — browser → Supabase (anon key). CSP allows `connect-src https://*.supabase.co` + `img-src https:`. React Compiler on (avoid manual memo, #291). No store lib: **Context + URL params + localStorage**.
- **Engine client-safe** (zero-dep, ~88 KB, pure). Deck synergy uses **precomputed pairwise JSON** (`pairs[other].aggregateScore`, `_playstyles.json`, `_pairs_index.json`); lazy-import engine only for preview/hypothetical/replacement scoring.
- **Reuse (don't rebuild)**: `BrowseCardGrid`, `CardGrid`, `CardTile`, `BrowseToolbar`, `FilterDialog`/filter groups/`SortSelect`/`Chip`, `SearchBottomSheet`, `SynergyGroup`/`SynergyCard`/`StrengthBadge`, `CardModalContext`, theme tokens, `useResponsive`/`useFilterParams`/`useDialogFocus`. Inline styles (no Tailwind). **No `backdrop-filter: blur`** (WebKit E2E trap).

### Supabase schema (JSONB card lists; timestamp-convention migrations)
- `profiles` (`id → auth.users`, `handle` unique-nullable, `display_name`, `avatar_url`), RLS public-read/owner-write + `handle_new_user()` trigger.
- `decks` (`id`, `owner_id`, `name`, `gameplan text?`, `inks text[]`≤2, `cards jsonb`=`[{cardId,quantity,isCore}]`, `is_public` default false, `slug` later), owner-scoped RLS + `updated_at` trigger.
- **`collections`** (Phase 2; `owner_id` PK, `cards jsonb`=`[{cardId,quantity}]`, `source`, `updated_at`), owner-only RLS.
- **`analysis_cases`** (Phase 3; `id`, `owner_id`, `deck_snapshot jsonb`, `fingerprint jsonb`, `dimension_scores jsonb`, `analyzer_score`, `human_score`, `corrections jsonb`, `notes`, `config_version`, `created_at`), owner-only RLS.
- `deck_favorites` (Phase 4) + `deck_stats` view.
- Regenerate `database.types.ts` after each migration.

### Auth wiring
`supabase.ts`: add `auth:{persistSession, autoRefreshToken, detectSessionInUrl, flowType:'pkce', storageKey:'inkweave:auth'}`; keep env gate. `SessionContext`/`useSession` in `AppLayout`; `signInWithOAuth('google'|'discord',{redirectTo:${origin}/auth/callback})`. `/auth/callback` page → session → draft migrator → `/decks`. `SignInDialog` from `CompactHeader` + `/decks` header. **No CSP change** (top-level nav; token exchange + avatars already allowed). **Manual dashboard steps**: enable providers, set Site URL + redirect allowlist.

### Routing & nav
Zero-prop lazy routes: `/decks`, `/decks/new`, `/decks/:id`, `/decks/:id/edit` (`DeckOwnerGate`), `/auth/callback`, `/collection` (P2), `/decks/import` (P5), `/u/:handle` (P4), `/admin/deck-lab` (P3, `AdminGate`). **Mobile nav**: replace "vote" primary tab with "Decks" (keeps `POS_4`; vote reachable elsewhere).

### State
`DeckContext`/`useDeck` (under `CardDataProvider`): `addCard`/`removeCard`/`setQuantity`/`markCore`/`setGameplan`/`renameDeck`/`clearDeck`; debounced localStorage draft (`deckStorage.ts`, voteStorage pattern) + Supabase sync when authed. First-sign-in draft→cloud migration (idempotent). `CollectionContext`/`useCollection` (P2). `SessionContext` (P1).

### Live advisor engine — `apps/web/src/features/deck/analysis/`
Pure, unit-testable. `analyzeDeck(deck, cards, {precomputedPairs, hosers, collection?, scoringConfig, cases?}) → {stats, health, vulnerabilities, suggestions, qualityScore}`.
- `archetype.ts` first → `{detected, confidence}`; `deck.gameplan` overrides.
- `deckSynergy.ts`: aggregate `pairs` → overall, `keyCards`, `weakLinks`; `_playstyles.json` density.
- Health analyzers (§A Tier 2), archetype-parameterized.
- `vulnerabilities.ts` (§A Tier 3) from `hosers.json`.
- `score.ts`: composite (§A) + breakdown; precedent anchoring when `cases` present (Part C).
- **NEW `getRemovalRoles`** in `packages/synergy-engine/src/utils/cardHelpers.ts` (fills the one engine gap): `banish | conditional-banish | damage | debuff | bounce`; excludes self-banish; reuses `getActionDamage`/`isMultiTargetDamageAction`/`getBounceRoles`; **emits the condition** feeding the hoser catalog. Own tests.
- `suggestions.ts`: `canShareDeck`-filtered candidates, `totalScore = synergyWithDeck (core ×2) + gapWeight × fillsAGap (incl. vulnerability mitigation)`. Merida-Wisp→`getBeckonEnablerTier`; Shift→`getShiftBaseNames`; Singer→on-curve `isSong`.

### Collection & migration (Phase 2) — `features/deck/collection/`
`parseDreambornCollection(data)` → `[{cardId,quantity}]` (research the export format), resolve via name/set index, report unmatched → populate `collections`. Own/don't-own badges + "only cards I own" filter. **`replacements.ts`**: for an unowned deck card, rank **owned** candidates by (a) synergy-profile similarity vs the deck, (b) role/mechanic overlap (`getCardMechanics`/`getXRoles`), (c) cost+type+ink match. Engine lazy-imported.

---

## Part C — Deck Quality Score & Human-in-the-Loop Calibration

**Learning = a self-calibrating glass box + a memory of precedents. No ML.**

**1. Transparent, versioned score** (§A composite). Weights/thresholds in `scoring.json` (snapshot-guarded, `/admin/tuning`-style). Each score stamps its `config_version` → reproducible ("Engine Score v3").

**2. Case capture (the labeled memory).** `analysis_cases` (Supabase, owner-only). You review an analysis (score + breakdown + reasons), enter your **ground-truth score** + per-dimension right/wrong + notes → a case is stored with the deck's **fingerprint**.

**3. Deck fingerprint** (for similarity): `{ archetype, bucketed dimension scores, dominant playstyles (`_playstyles.json` ∩ deck), key-card synergy signature (top `keyCards`' rule ids), inks, curve centroid }`. Distance = weighted L2.

**4. Two explainable learning channels:**
- **Global calibration:** across cases, compute per-dimension error (analyzer vs human); least-squares fit of weights **or** guided manual edits from an aggregate error report (*"removal overweighted 8% across 40 cases"*). Versioned + reversible (snapshot-guarded); each change bumps `config_version`. You approve every change.
- **Local precedents:** on a new analysis, kNN-retrieve nearest cases by fingerprint; **anchor** the raw score toward their human scores (confidence-weighted by neighbor count/similarity) and **replay their notes** as advice (*"decks like this you rated ~7; you flagged single-2-of-payoff reliance"*). This is the "recognizes patterns it has seen."

**5. Calibration tool** — `/admin/deck-lab` (`AdminGate`): paste/import a deck → score + breakdown + nearest precedents → enter score + corrections + notes → save case. A "Calibrate" view shows the aggregate error report + proposes weight adjustments you approve/reject (versioned).

**6. External "Inkweave Engine Score" (widget + hosted endpoint; the project's FIRST serverless):**
- **`inkweave-deck-score` package** (standalone, zero-dep like the engine): pure `scoreDeck(cards, config) → {score, breakdown, configVersion}`.
- **Hosted endpoint** (Supabase Edge Function **or** Vercel Function — decided at build): `POST /deck-score` → versioned `{score, breakdown, configVersion}`; needs the Core card DB + precomputed inputs bundled/fetchable at the edge; rate-limited like `submit_vote`.
- **Embeddable widget** (JS snippet / iframe) third parties drop in; requires `frame-ancestors`/CSP work.

**Cold-start:** default-weight formula until cases exist; your calibration bootstraps it; precedents kick in as cases accumulate.

---

## Part D — Phased roadmap (each bullet ≈ one PR-sized issue, in dependency order)

### Phase 0 — Foundations

**Status: shipped.** Items 1-5 landed via PR #480; issues #458-#462 closed 2026-07-11. Follow-up #475 (Hunny Sage ink exemption, surfaced during #467) remains open under this phase's epic; note its pool-gating half is stale, since the pool no longer disables off-ink cards.

1. `features/deck/types.ts` (Deck+`gameplan`, DeckCard, DeckStats, DeckHealth, Vulnerability, Suggestion, Archetype+`'ramp'`, QualityScore, AnalysisCase, DeckFingerprint) + `calculateDeckStats` tests.
2. `deck-analysis` scaffold + `deckStats.ts` + tests.
3. **`getRemovalRoles`** engine detector (+ condition extraction) + tests. *(engine auto-rebuild/validator.)*
4. `scripts/precompute-hosers.mjs` → `hosers.json` + build wiring.
5. `scoring.json` default config + `score.ts` composite (transparent, versioned) + tests.

### Phase 1 — v1: Builder + Live Advisor + Quality Score + Auth

**Status (2026-07-22): 7 of 11 task issues closed.** Shipped: items 6-18 (auth #463, migrations + repository #464, state #465, routes + mobile tab #466, builder shell + panel #467) plus the brain half of items 20-23 (archetype + analyzers #469, vulnerabilities #470, deckSynergy aggregation). Open: #468 (item 19: only the Characters/Actions/Items/Locations type split remains; the curve strip shipped), #471 (items 23-24 UI: SuggestionList + synergy/key-card surfaces), #472 (item 20's gameplan control, item 25 partially shipped as `ScoreGauge`, item 26's panel composition), #473 (items 27-29). **Item 26 placement revised in build:** the persistent dock was rejected in `2026-07-13-advisor-ui-design.md` in favor of the tabbed Analysis panel plus a Cards-tab health cell. **Lens ruling (2026-07-22): keep all three `HealthVariants` lenses (Priorities / Vitals / Radar) behind the dropdown, Priorities default**; the flat `HealthMeter` is retired, and the panel gets a full per-dimension health list instead (see item 26). Score numerals use `FONTS.body` (Plus Jakarta Sans), not the hero serif. The superseded compact flag-design variant survives at local tag `archive/healthsummary-flag-design` (`3b2b28f`).

6. `supabase.ts` auth. 7. `SessionContext`. 8. `/auth/callback` + migrator. 9. `SignInDialog` + entry points. 10. `profiles` migration+trigger. 11. `decks` migration+RLS. 12. `DeckContext`+`deckStorage.ts`. 13. `deckRepository`. 14. draft→cloud migration. 15. routes+pages. 16. mobile "Decks" tab. 17. `DeckBuilderPage` shell. 18. `DeckPanel`+`DeckCardRow` (enforcement). 19. `DeckStatsBar`. 20. `archetype.ts` + declared-gameplan control. 21. archetype-parameterized analyzers. 22. `vulnerabilities.ts`. 23. deck synergy aggregation. 24. `SuggestionList`+ranking. 25. **`DeckQualityScore` display + breakdown**. 26. `DeckAdvisorPanel`+`VulnerabilityBox`+`ArchetypeBadge`+`ScoreGauge`+full per-dimension health list, composed in the Analysis tab (placement per the 2026-07-13 design doc; persistent dock rejected; mobile sheet deferred until the mobile builder exists). Health cell in the Cards tab = the three `HealthVariants` lenses behind a dropdown, Priorities default (ruling 2026-07-22; replaces the originally-planned flat `HealthMeter`). 27. `SaveDeckDialog`. 28. `/decks` list. 29. native share link.

**UX note — DeckPanel dead horizontal space (wide screens).** On wide screens the Cards-tab rows leave a large empty gap between the card name and the quantity stepper; Dreamborn fills that space with a cost curve + small charts, Duels.ink leaves it empty. **The data already exists** and is already passed into `DeckPanel` as `stats: DeckStats` (from `calculateDeckStats`, item 2): `costCurve` (cost→count, 7+ bucketed), `inkDistribution` (per ink; dual-ink counts both), `typeDistribution` (per card type), `inkableCount`/`inkCount`. So this is presentation-only — no new backend. Two candidate homes: **(a)** a compact summary strip above the grouped rows inside the Cards tab (mini cost-curve + ink/type pips) — a lightweight fill, decoupled from the full advisor; or **(b)** flesh out the reserved Analysis tab, whose `'Cost curve'` and `'Ink balance'` placeholder zones already earmark exactly these charts — folds into item 26. Relates to items 18/19 and 26. **Candidate (a) shipped as #468 (`e52a8be`):** the Cards-tab strip with the mini cost-curve + ink-split bars (a new `costCurveByInk` field on `DeckStats` feeds the ink split; dual-ink counts toward both inks; each bar glows its dominant ink). Still pending: the type-split pips; candidate (b), the Analysis-tab cost-curve/ink charts, folds into item 26/#472, whose first WIP has since landed (`0586910`/`fd142ea`: `ScoreGauge` + `VulnerabilityBox` in the Analysis tab, lens views in the Cards-tab health cell) while the charts themselves remain unbuilt.

### Phase 2 — Collection & Dreamborn Migration
30. `collections` migration+RLS. 31. `CollectionContext`+repo. 32. Dreamborn collection parser + `ImportCollectionDialog`. 33. `/collection` page. 34. own/don't-own badges + filter. 35. **replacement suggester** + UI.

### Phase 3 — Deck Quality Score Calibration (human-in-the-loop)
36. `analysis_cases` migration+RLS. 37. fingerprint module + kNN retrieval. 38. `/admin/deck-lab` case-capture tool. 39. aggregate error report + versioned weight-calibration view. 40. precedent anchoring + note-replay wired into the live advisor.

### Phase 4 — Social layer
41. `deck_favorites`+`deck_stats`. 42. `/decks/feed`. 43. favorites UI+counts. 44. copy-a-deck. 45. `/u/:handle` + handle uniqueness. 46. trending precompute.

### Phase 5 — Interop depth
47. `ImportDeckDialog` (Dreamborn/Pixelborn/TTS **deck-list** parsers, shared name index). 48. export serializers. 49. `decks.slug` short links. 50. deep-link import.

### Phase 6 — Advisor depth + meta (gated on Set-13 data)
51. full pros/cons. 52. `precompute-meta.mjs` against the **Set-13** pipeline. 53. meta-weighted `MatchupBox` (hedged, dated). 54. copy tuning via `/admin/tuning`. 55. opening-hand/mulligan simulator. 56. explain-suggestion/vulnerability drilldowns.

### Phase 7 — External Inkweave Engine Score (first serverless)
57. `inkweave-deck-score` standalone package. 58. hosted scoring endpoint (Supabase Edge Function **or** Vercel Function — decide at build) + rate-limiting. 59. embeddable widget + `frame-ancestors`/CSP + docs. 60. versioned score contract + integration tests.

---

## Part E — Decisions & defaults (recommendations; veto any at review)
1. **Mobile nav**: demote "vote" for "Decks" (vote reachable from card modals/playstyle pages).
2. **Cloud decks private by default**; **collections + analysis_cases owner-only** (no public sharing).
3. **Archetype**: auto-detect always on; declared `gameplan` optional, overrides when set.
4. **Score in v1** (default weights); **calibration is Phase 3** (before broad/public score exposure); **external Engine Score is Phase 7**, once the score is trusted — reorderable if you want it sooner.
5. **Handles**: derive from OAuth; require unique `@handle` only at profile publish (Phase 4).
6. **Anon drafts**: soft cap (~10 local decks) + sign-in nudge.
7. **Meta/matchups**: deferred to Phase 6 (Set-13 data); near-term advice intrinsic.
8. **Vulnerability catalog**: auto-derived from pool + small curated override; precomputed.
9. **Serverless choice** (Supabase Edge Function vs Vercel Function) for the Engine Score endpoint: decided at Phase 7 build (leaning Supabase Edge Function to keep everything in one backend).

---

## Verification (per phase, end-to-end)
- **Unit (5-15 focused tests each, `.claude/rules/tests.md`)**: `deckStats` (60/≤2-ink/≤4-per-fullName), **`getRemovalRoles`** (hard/conditional banish, burn, self-banish NOT matching, bounce, condition extraction), `archetype` (aggro/control/**ramp** + declared override; ramp curve-jump not penalized), `vulnerabilities` (exposure from fixture `hosers.json`), `deckSynergy`, `suggestions` (Merida/Singer/vulnerability-mitigation), `replacements` (unowned→owned same-role ranking), `score` (deterministic given config + version stamp), `fingerprint`+kNN (nearest-case retrieval), `calibration` (fixture cases → expected weight shift + rollback), collection + deck-list parsers, `deckStorage`.
- **Stories**: `.stories.tsx` for every new visual component (`check:stories` gate) — deck states, health-cell statuses (`HealthVariants` lenses, per the 2026-07-22 item-26 ruling), `VulnerabilityBox`, `ArchetypeBadge`, `ScoreGauge` + breakdown, own/don't-own badges, replacement row, `/admin/deck-lab` panels.
- **E2E (chromium local / +webkit +mobile-chrome elsewhere)**: build→60→legality green; declare gameplan→advice changes; score+breakdown render; save (stub session); share opens fresh; import collection→badges→replacement; deck-lab: analyze→enter score→case saved→precedent surfaces next time. `data-testid`s; **no blur**; no hover-only affordances.
- **Supabase**: regenerate types + `pnpm test:supabase` + `get_advisors` after each migration; Phase 7 endpoint gets its own integration test + rate-limit test.
- **Engine change**: auto-rebuild hook + `engine-validator`; CodeScene `analyze_change_set` (base `origin/master`) before push.
- **Manual**: Google+Discord sign-in on a preview deploy; Dreamborn collection import vs a real export; Engine Score widget embedded on a scratch page.

## Critical files
- `apps/web/src/shared/lib/supabase.ts` — auth options (linchpin).
- `apps/web/src/router.tsx` — new lazy routes + `DeckOwnerGate`.
- `apps/web/src/shared/components/MobileBottomNav.tsx` — "Decks" tab + arc-position tables.
- `packages/synergy-engine/src/utils/cardHelpers.ts` — `getRemovalRoles` (+ conditions); reuse `canShareDeck`, `getBeckonEnablerTier`, `getShiftBaseNames`, `getBounceRoles`, `getActionDamage`, `getRampRoles`/`isDeckRamp`.
- `apps/web/src/features/synergies/hooks/usePrecomputedSynergies.ts` — `fetchCardSynergies` reuse for aggregation + replacements.
- `supabase/migrations/` — `profiles` / `decks` / `collections` / `analysis_cases` / `deck_favorites`.
- `scripts/precompute-hosers.mjs` (new); later `scripts/precompute-meta.mjs` (P6).
- `packages/synergy-engine/src/data/tuning.json` + new `scoring.json` — versioned score config (extends the `/admin/tuning` pattern).
- New `packages/inkweave-deck-score/` (P7) + first serverless surface (Supabase Edge Function or Vercel `api/`).
- Pattern refs: `shared/contexts/CardDataContext.tsx`, `features/voting/lib/voteStorage.ts`, `features/admin-*` (for `/admin/deck-lab`), old builder via `git show e5ad4b4^:apps/web/src/features/deck/hooks/useDeckBuilder.ts`.
