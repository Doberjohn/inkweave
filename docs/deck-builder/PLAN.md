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
`parseDreambornCollection(data)` → `[{cardId,quantity}]`. **Format researched 2026-07-31, see [`PHASE2_KICKOFF.md`](PHASE2_KICKOFF.md):** CSV, `Set Number,Card Number,Variant,Count,Name,Color,Rarity`, zero-padded set numbers, two rows per card (normal + foil), `Count: 0` for unowned. `(parseInt(Set Number), Card Number)` joins to `(setCode, number)` as an **exact bijection, 1024/1024, zero unmatched**, so **no name matching is needed**; keep an unmatched path for robustness but do not build fuzzy resolution on spec. Only ~30% of a real collection's owned cards are Core-legal, so the import summary must say so rather than silently discarding the rest. Then populate `collections`. Own/don't-own badges + "only cards I own" filter. **`replacements.ts`**: for an unowned deck card, rank **owned** candidates by (a) synergy-profile similarity vs the deck, (b) role/mechanic overlap (`getCardMechanics`/`getXRoles`), (c) cost+type+ink match. Engine lazy-imported.

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

**Status (2026-07-31): PIVOT — ship the manual builder, stop trying to finish the advisor.** Owner ruling. The advisor half has been parked since 2026-07-28 (below) and the analysis modules are, in the owner's words, "currently dead code" — `analyzers`, `score`, `suggestions`, `vulnerabilities`, `archetype` and `deckSynergy` are built and tested but rendered by nothing (`DeckBuilderPage.tsx` says so in a comment). Note the exception: **`deckStats.ts` is NOT dead** — it is the spine of the shipped builder, driving the count badge, legality errors, the cost curve, and the Duels export gate.

The v1 headline is therefore **the classic manual builder, made good enough to use**, not builder + advisor + score. Three owner-chosen items define that:

1. **Legibility pass** — **effectively DONE 2026-07-31** (`763a7258`..`9b06f35b`). A *design* change; distinct from #544, which is a zero-visual-change tokenization. Contrast was never the problem: `textMuted` measures 6.18-7.36:1, above AA, so the fix was size and weight, and the 188 `textMuted` references stayed out of scope. Shipped: every kit button renders at `FONT_SIZES.lg` (14px) weight 600; the deck toolbar, `/decks` "New deck", and Sign in / Sign out all wear the same 44px-tall recipe; five kit buttons left the `no-raw-duration` ledger on the way through. **`CTA_BASE_STYLE` was extracted** (`8b9b013a`) because anchors were hand-copying `CtaButton`'s padding, height, radius and weight, which is the exact drift the pass had just removed. `display` is deliberately not in it: `CtaButton` needs `flex` so `AppLayout`'s `margin: 0 auto` can centre it, anchors want `inline-flex`.
2. **Desktop nav + Decks link** — **DONE 2026-07-31** (`b7e96868`..`de4ad640`). `/decks` was unreachable on desktop; mobile had carried the tab all along. Design + plan: [`2026-07-31-desktop-nav-redesign-design.md`](2026-07-31-desktop-nav-redesign-design.md).
3. **Dreamborn collection import** — Phase 2 (#452), CSV at `.knowledge/folder/download.csv`. Proposed scope change: ship parser + own/don't-own + "only cards I own" filter against **localStorage first**, deferring the `collections` migration + RLS, so the feature delivers value without a live-DB step. **Start here: [`PHASE2_KICKOFF.md`](PHASE2_KICKOFF.md)** carries the measured CSV format and the verified join (an exact 1024/1024 bijection on `(setCode, number)`, so no name matching is needed). **RULINGS 2026-08-10 (owner), recorded here because the kickoff brief is disposable:** (a) **finish is modelled, not folded** — `normal` and `foil` stay separate quantities behind a `totalOwned()` accessor, since collapsing later is possible and un-collapsing is not, and nothing in the builder consumes finish today; (b) **the import summary names the non-Core remainder**, because only 1014 of 3395 owned rows are Core and silently dropping ~70% of a collection reads as a broken import.

**Decks is now a PUBLIC destination**, not account-scoped: `/decks` is intended to show community decks with a switch to your own. That is what let the nav treat it as a peer of Browse/Playstyles/Vote. The community-decks page itself is unbuilt and belongs to Phase 4 (#454), not here.

**RULING 2026-08-01 (owner), the Decks identity.** `/decks` **is the community hub, with a "Yours" tab.** Settled because three sources disagreed and the ambiguity was blocking the mobile-auth question: PLAN said `/decks` was public, **#454 put the public feed at `/decks/feed`** (implying `/decks` stays personal), and `MobileBottomNav` labels the tab **"Build a deck"** (personal, and an action). Consequences, all of which follow from the ruling and none of which are optional:

- **#454 changes.** There is no `/decks/feed`. The public feed IS `/decks`, and "Yours" is a tab within it. Update the epic's task line before Phase 4 starts.
- **`DecksPage`'s "Your Decks" heading is wrong** and becomes "Decks", with `TabList` (the app-wide tab standard, #468) carrying Yours / community.
- **The mobile nav label "Build a deck" is wrong**, twice over: it now points at a community hub, and it describes an action rather than a destination. `/decks/new` is the builder.
- **Interim, until Phase 4 supplies content:** show only the Yours tab. A visible-but-empty community tab is worse than today's page. The ruling governs naming, routing and nav copy NOW; the second tab appears when it has something in it.

**RULING 2026-08-01 (owner), sign-in placement.** **Contextual, plus the header.** `HeaderAuth` stays in the header's rightmost slot, and `/decks` additionally explains what signing in buys ("keep these decks on your other devices"), because signing in is an **upgrade, not a gate**: the builder already works fully signed out via `deckStorage`'s localStorage drafts, and `useFirstSignInMigration` lifts an anonymous draft into the account on first sign-in. This also **closes the mobile sign-in regression** as a side effect, since `/decks` renders on mobile while `CompactHeader` does not. Nothing in v1 requires auth, including #452's collection import under its localStorage-first scope, so auth gates nothing and should not present itself as a gate.

**Auth moved to the header** (2026-07-31, `7dfb4dd3`/`09f9a52d`). Sign in / Sign out used to live on `/decks`, which made it the only page that could ask you to authenticate. `HeaderAuth` now occupies the header's rightmost slot on every desktop page. It renders **nothing** while `loading`, deliberately: `user` is null during that window, so the naive version flashes "Sign in" and then swaps to "Sign out" for every returning user on every load. It also renders nothing when auth is unconfigured (`enabled: false`), which is how the app degrades without Supabase env. Note the split: `HeaderAuth` calls `useSession()` directly, while `DesktopNav` uses the non-throwing `useIsSignedIn()`. The header now *renders* auth, so demanding a provider is honest and a throw reports a real mounting error; the nav only *reacts* to auth and must not demand one. Design + plan: [`2026-07-31-header-auth-control-design.md`](2026-07-31-header-auth-control-design.md).

**RESOLVED 2026-08-05 (owner ruling): mobile auth is one button on `/decks`.** History, because this lapsed twice and the doc asserted both states at once: `7dfb4dd3` moved auth into the desktop-only header, which removed mobile's only path; `d2e9392f` restored it with a `DeckAccountPanel`; `fab863db` removed that panel by owner request, reopening the hole and quietly invalidating the 2026-08-01 ruling's claim above that `/decks` covers mobile. It covers it again now, by a different mechanism: `AuthButton` (`shared/components/AuthButton.tsx`) holds the button rule, `HeaderAuth` renders it in the header's rightmost slot, and `DecksPage` renders it beside the "Decks" heading on the viewports where the header does not exist. Both sides gate on one predicate, `headerCarriesAuth` in `shared/components/headerChrome.ts`, so the two surfaces cannot both appear.

**RULING 2026-08-05 (owner), publish is not a separate concept.** Save and publish were two names for one thing, and worse, two WRITERS for one column: the builder's `upsertDeck` and a visibility control on `/decks/:id` that called `updateDeck` directly. The builder never re-reads a deck it already holds, so publishing a deck and then saving any later edit wrote the stale `is_public: false` back over it, silently, and dropped the deck out of community decks. Reproduced end to end before the fix.

Visibility is now a **property of the deck**: chosen in the New deck dialog (kept, by owner request), shown and changeable in the builder beside the deck name (`DeckVisibilityToggle`), and persisted by **Save, the only writer**. `/decks/:id` states the current visibility and cannot change it; `updateDeck` has no caller. The word "publish" is gone from the product. Regression guard: the fourth test in `deck-save-share.spec.ts`.

Also fixed here: the deck panel header put the name and the toolbar on one line, and the name lost, collapsing to a bare pencil at panel width. It is two rows now, name plus visibility above, actions below.

**Known limit of that ruling:** `/decks` is the ONLY mobile auth surface. A shared deck link (`/decks/:id`) opened on a phone still offers no way to sign in, which was named and accepted when the ruling was made. Revisit if share links become an acquisition path.

**Fixed alongside it:** `InkGalleryPage` and `InkHubPage` rendered `<CompactHeader>` with no `isMobile` prop. The prop is optional and the guard is truthiness-based, so `undefined` read as desktop and painted the 70px bar on phones, its absolutely-centered nav overlapping the logo, stacked above the mobile bottom nav. They were also, accidentally, the only mobile sign-in in the app, which is why the two changes had to ship together.

**Status (2026-08-06/07): public identity, the deck card, and one way back.** Recorded on 2026-08-10; these five days shipped while the doc stopped at 08-05, and the #474 ledger stopped at 08-01.

- **Every account gets a public name at first sign-in** (`42619260`). Two names with different jobs: `handle` is the unique lowercase identity a future `/u/:handle` is built on, `display_name` is what people read, seeded from it in title case. Generated server-side by a `claim_handle` RPC, never a trigger, because the profiles migration deliberately left the handle null: uniquing inside the signup transaction can raise and break auth entirely, which this project has hit before. Two defects were fixed first, and both generalize. **RLS is ROW-level, so publishing one column publishes the row**: `profiles_select_public_or_own` is `handle is not null or auth.uid() = id`, so the moment a handle existed, anon could also read the `display_name` and `avatar_url` copied from Google/Discord at signup. The signup trigger now writes only the id, keeping the row free of PII so the one-line policy stays the whole story. And **the uniqueness index is the only authority on availability**, so the only correct algorithm is write-and-catch-23505, which has to be server-side or every collision is a round trip. Names come from the game's own vocabulary (6 inks × 37 subtypes × 3 digits ≈ 222,000), minus character and franchise names: a name the user did not choose must not assign anyone a trademarked identity.
- **Deck tiles became real Lorcana cards** (`c741f445`, `ad866b69`, `ccfd3c6f`, `af09df59`). The flat row went to an ink-gradient tile, then to the printed frame for its ink combination with the deck's signature card in the art window. All 21 legal combinations ship (128KB of WebP); the path is derived (lowercase, sort, join) so mono falls out for free and adding a frame is a pure asset drop — **the sort is load-bearing**, since `steel-emerald.webp` would never be found. Every constant in `deckFrame.ts` was measured off the bitmaps, and `deckFrame.assets.test` walks the filesystem because a derived path fails **silently**: a bad `src` renders nothing while the layers above it still look like a card.
- **Two contrast lessons from that frame, both worth reusing.** White on the raw name plate fails the body-text bar on 16 of 21 frames, and the first fix was a 40% scrim on all of them — which made the cards stop reading as Lorcana cards. That was **optimising a summary statistic**: the distribution is bimodal (Amber 2.01-2.59, everything else 3.82-6.37, nothing between), so fifteen frames were being dimmed to rescue six. The shipped version scrims Amber only, at 25%, and targets **the other frames rather than the WCAG number** — matching the set beats matching the standard when the standard would break the relationship the print intended. `inks.includes('Amber') ? 0.25 : 0` also states which ink has the problem, where the flat 40% stated nothing.
- **Hover chrome came off the deck cards** (`af09df59`, owner ruling). The house tile recipe announced itself as a UI control; a card is an object, and the printed frame reads as clickable without it. The keyboard focus ring stayed: hover is a mouse affordance, focus is the only way a keyboard user can see where they are, and removing it would need a visible replacement rather than a deletion.
- **One way back, with a rule that keeps it that way** (`8c62710c`, `a3feb95e`). A census found eleven back affordances in five shapes; `BackLink` now takes `to` XOR `onClick`, `Breadcrumb` joined it, and `inkweave/no-adhoc-back-links` enforces the split. Full contract and the exemption rationales: [`.claude/rules/navigation.md`](../../.claude/rules/navigation.md). **The rule shipped broken** and is the sharper lesson: a literal `0x08` backspace byte sat where `\b` was meant (a heredoc ate the escape), so `Back to<BS>` matched nothing while the arrow alternative still fired — a lint run over the whole codebase therefore looked like a clean bill of health. It has tests now, because a lint rule that silently stops matching is indistinguishable from a codebase that never violates it.
- **Layout-shift work, measured on both paths** (`a3feb95e`, `58b3c91d`). `/decks` and `/decks/:id` load into skeletons that borrow `DECK_TILE_MIN_WIDTH`, `DECK_TILE_GAP` and the frame aspect rather than restating them, since a skeleton that drifts promises a layout and delivers another. The back link is hoisted into `PageShell` rather than given a placeholder: it depends on no data, so it paints with the first frame and cannot move. First tile moves 0px on cold load and on return.
- **A required prop beats an optional one** (`8d9a3ae3`). Every Yours-tab card rendered with an empty art window, and the community tab looked fine by accident — it already needed `getCardById` for its legality filter. `getCardById` is now required on `DeckList`, which makes the same mistake unrepresentable instead of a silent no-op.

**Two capabilities are parked with no entry point.** Neither is a bug, both were named at the time, and both are invisible from the UI:

1. **Nobody can change their display name.** `8d9a3ae3` removed the "You publish as … / Change" row from the Yours tab by owner ruling, and it was `DisplayNameDialog`'s only render site. The dialog and `useProfile` are kept, unreferenced outside `features/profile`. This one has teeth: the name is **auto-generated and public**, stamped on every community deck tile, and its owner cannot edit it.
2. **There is no share control.** `ShareDeckButton` left `DeckViewPage` in `8c62710c` and the component was deleted 2026-08-10 (owner ruling): the URL in the address bar is the share link.

Parked, not deleted: the advisor modules stay in the tree. Do not delete them without a ruling, and do not rebuild a panel without a fresh agreed design.

**Status (2026-07-28): the advisor UI is PARKED, and the builder is two columns.** Two owner rulings supersede the advisor-surface parts of the 2026-07-22 status below. The engine half (archetype, analyzers, vulnerabilities, synergy aggregation, `rankSuggestions`) is built, tested, and unaffected; only the *surface* is unresolved.

- **Advisor parked** (`2b044a9`). Both attempts were rejected by the owner: the numeric panel (0-100 score, per-dimension rings) as "engine vocabulary wearing a UI", and the qualitative rewrite as *"still a huge wall of text. Noone will ever read a single line."* Consequences already applied in code: the Cards/Analysis tab bar and the deck-health cell are **removed**, per-row delete is gone (the stepper's `−` at one copy removes), and `useDeckAnalysis` is **unwired** in `DeckBuilderPage` (it would fetch per-card pair data on every edit for an unread result). The advisor components remain in the codebase, unreachable. **Do not rebuild a panel without a fresh design agreed with the owner.** Rationale plus the 13-tool competitor survey (zero of thirteen ship a working deck score): [`2026-07-24-advisor-tab-redesign-design.md`](2026-07-24-advisor-tab-redesign-design.md).
- **Two-column layout is binding** (`38311c59`, [`BUILDER_LAYOUT.md`](BUILDER_LAYOUT.md)): **left = where cards come from** (every new suggestion / import / guided surface), **right = the deck list and nothing else**. No tabs to reach anything; a mode change swaps the left column in place.
- **Agreed next direction: Guided mode, unbuilt.** A keep/skip stream of engine-found pairings in the LEFT column, deck stays visible on the right; `/decks/new` becomes a Manual/Guided chooser. **The real work is reason quality, not UI.** Suggestions currently fall back to "Synergizes with N deck cards" (`suggestions.ts`) because `PairScore` is typed `(a, b) => number`, so the `ruleName` and `explanation` already present in every precomputed pair are discarded at the boundary in `useDeckAnalysis.ts`. Guided mode only works once each card carries the specific rule that fired.

**Status (2026-07-22): 7 of 11 task issues closed.** *(Superseded in part by the 2026-07-28 rulings above: the tabbed Analysis panel, the Cards-tab health cell, and the three-lens `HealthVariants` dropdown described below are all removed from the product. Kept for provenance.)* Shipped: items 6-18 (auth #463, migrations + repository #464, state #465, routes + mobile tab #466, builder shell + panel #467) plus the brain half of items 20-23 (archetype + analyzers #469, vulnerabilities #470, deckSynergy aggregation). Open: #468 (item 19: only the Characters/Actions/Items/Locations type split remains; the curve strip shipped), #471 (items 23-24 UI: SuggestionList + synergy/key-card surfaces), #472 (item 20's gameplan control, item 25 partially shipped as `ScoreGauge`, item 26's panel composition), #473 (items 27-29). **Item 26 placement revised in build:** the persistent dock was rejected in `2026-07-13-advisor-ui-design.md` in favor of the tabbed Analysis panel plus a Cards-tab health cell. **Lens ruling (2026-07-22): keep all three `HealthVariants` lenses (Priorities / Vitals / Radar) behind the dropdown, Priorities default**; the flat `HealthMeter` is retired, and the panel gets a full per-dimension health list instead (see item 26). Score numerals use `FONTS.body` (Plus Jakarta Sans), not the hero serif. The superseded compact flag-design variant survives at local tag `archive/healthsummary-flag-design` (`3b2b28f`).

6. `supabase.ts` auth. 7. `SessionContext`. 8. `/auth/callback` + migrator. 9. `SignInDialog` + entry points. 10. `profiles` migration+trigger. 11. `decks` migration+RLS. 12. `DeckContext`+`deckStorage.ts`. 13. `deckRepository`. 14. draft→cloud migration. 15. routes+pages. 16. mobile "Decks" tab. 17. `DeckBuilderPage` shell. 18. `DeckPanel`+`DeckCardRow` (enforcement). 19. `DeckStatsBar`. 20. `archetype.ts` + declared-gameplan control. 21. archetype-parameterized analyzers. 22. `vulnerabilities.ts`. 23. deck synergy aggregation. 24. `SuggestionList`+ranking. 25. **`DeckQualityScore` display + breakdown**. 26. `DeckAdvisorPanel`+`VulnerabilityBox`+`ArchetypeBadge`+`ScoreGauge`+full per-dimension health list, composed in the Analysis tab (placement per the 2026-07-13 design doc; persistent dock rejected; mobile sheet deferred until the mobile builder exists). Health cell in the Cards tab = the three `HealthVariants` lenses behind a dropdown, Priorities default (ruling 2026-07-22; replaces the originally-planned flat `HealthMeter`). **[PARKED 2026-07-28: neither the Analysis tab nor the Cards-tab health cell exists any more; item 26 awaits a fresh design that is not number-led. See the Phase 1 status block above.]** 27. `SaveDeckDialog`. 28. `/decks` list. 29. native share link.

**UX note — DeckPanel dead horizontal space (wide screens).** On wide screens the Cards-tab rows leave a large empty gap between the card name and the quantity stepper; Dreamborn fills that space with a cost curve + small charts, Duels.ink leaves it empty. **The data already exists** and is already passed into `DeckPanel` as `stats: DeckStats` (from `calculateDeckStats`, item 2): `costCurve` (cost→count, 7+ bucketed), `inkDistribution` (per ink; dual-ink counts both), `typeDistribution` (per card type), `inkableCount`/`inkCount`. So this is presentation-only — no new backend. Two candidate homes: **(a)** a compact summary strip above the grouped rows inside the Cards tab (mini cost-curve + ink/type pips) — a lightweight fill, decoupled from the full advisor; or **(b)** flesh out the reserved Analysis tab, whose `'Cost curve'` and `'Ink balance'` placeholder zones already earmark exactly these charts — folds into item 26. Relates to items 18/19 and 26. **Candidate (a) shipped as #468 (`e52a8be`):** the Cards-tab strip with the mini cost-curve + ink-split bars (a new `costCurveByInk` field on `DeckStats` feeds the ink split; dual-ink counts toward both inks; each bar glows its dominant ink). Still pending: the type-split pips; candidate (b), the Analysis-tab cost-curve/ink charts, folds into item 26/#472, whose first WIP has since landed (`0586910`/`fd142ea`: `ScoreGauge` + `VulnerabilityBox` in the Analysis tab, lens views in the Cards-tab health cell) while the charts themselves remain unbuilt. **[Updated 2026-07-28: candidate (b) is void, since the Analysis tab was removed with the advisor. The cost-curve strip from candidate (a) survives in the right-hand deck panel; the type-split pips are still the only outstanding piece of #468.]** **[2026-07-30: the strip gained a per-band hover tooltip (ink glyph + name + count), shipped as `a3ed3f84`..`9d9310de` against [`2026-07-30-cost-curve-ink-hover-design.md`](2026-07-30-cost-curve-ink-hover-design.md) and its plan. `InkSegment` now carries a raw `count`; bands are flex items with a `MIN_BAND_PX` floor; the bar's native `title` is gone (it double-fired with the tooltip). Two findings worth carrying: a dual-ink card counts toward BOTH inks, so per-ink counts can sum above a bucket's card count and the owner ruled the plain count ships anyway; and every story in this file had been rendering a flat chart, because the decorator had no height so the bars' percentage heights never resolved. Type-split pips remain the only outstanding piece.]**

### Phase 2 — Collection & Dreamborn Migration
30. `collections` migration+RLS. 31. `CollectionContext`+repo. 32. Dreamborn collection parser + `ImportCollectionDialog`. ~~33. `/collection` page.~~ 34. own/don't-own badges + filter. 35. **replacement suggester** + UI.

**PHASES A AND B SHIPPED 2026-08-10.** #554 (image restore) and the collection dataset + its images (`3291abb`, `b834257`). **Only Phase C remains — the Browse mode toggle and the binder — and it is blocked on the binder design session.**

**RESHAPED 2026-08-10 (owner). Design: [`2026-08-10-collection-view-and-image-pipeline-design.md`](2026-08-10-collection-view-and-image-pipeline-design.md).** Collection viewing moves INTO Browse behind a mode toggle, so **item 33 is dropped** — a separate page would reimplement filter, search, sort and the card modal that Browse already has. Collection mode shows every card from every set (3,242) with owned badges, presented as a paginated binder (layout undesigned; its own session). Non-Core cards are **viewable, never playable**: `CardDataContext` stays Core-only and Browse merges locally, so the deck builder and playstyles cannot see them by construction rather than by rule. Two measured facts that shaped it: the Core file is a faithful strict subset of the LorcanaJSON full export (0 id, field or pair mismatches), and the clean `(set, number)` join is an **artifact of Core-only** — across all 3,242 cards 160 pairs are ambiguous, name resolves 154, and 6 are irreducible. Folded in by owner decision: an **incremental image pipeline** (committed manifest + hash-verified restore from our own CDN), because the upstream URLs are already content-addressed and the pipeline currently discards that, so a cache wipe re-downloads everything from a source that rots. Phase A of that design **shipped 2026-08-10 as #554** (`c4f4038`) — but NOT as designed: the committed manifest it specified cannot work, because AVIF encoding is not reproducible across machines (0 of 1024 local hashes matched production). The deployed `allCards.json` already publishes both the hashes production serves and the source URLs behind them, so it is the manifest; a cache miss restores from our own CDN with the bytes hash-verified. Cold-cache result: 1024 restored, 0 downloaded, 33.5s, output byte-identical to production.

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
- **Stories**: `.stories.tsx` for every new visual component (`check:stories` gate) — deck states, ~~health-cell statuses (`HealthVariants` lenses)~~ *(void: the health cell was removed with the advisor, 2026-07-28)*, `VulnerabilityBox`, `ArchetypeBadge`, `ScoreGauge` + breakdown, own/don't-own badges, replacement row, `/admin/deck-lab` panels.
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
