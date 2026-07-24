# Analysis-tab redesign: verdict → add → health → details

**Date:** 2026-07-24
**Status:** Approved design, pre-implementation
**Supersedes the layout of:** the #472 Analysis-tab composition (`DeckAdvisorPanel`) and the interim `SynergySurface` (#471 Part B, to be removed)
**Relates to:** [`PLAN.md`](PLAN.md) items 24-26, [`2026-07-13-advisor-ui-design.md`](2026-07-13-advisor-ui-design.md)

## Context

The deck builder's **Analysis tab** is meant to answer three questions for someone
mid-build: *how good is my deck, what's wrong with it, and what should I add?* The
current tab stacks four separate boxes (archetype + gameplan, Deck Quality Score
gauge, per-dimension health grid, vulnerabilities), and the #471 Part-B
`SynergySurface` piled abstract metrics on top ("72 / 100 density", "key cards",
"8 links", "weak links"). The owner's verdict: **it's incomprehensible** — data that
only makes sense to whoever wrote the scoring pipeline. If the builder can't parse it,
neither can a user.

This redesign reorganizes the **whole tab** into one coherent story, in priority
order, and moves every jargon-laden metric either into plain language or behind a
"details" disclosure. The analysis *engine* is unchanged — `DeckAnalysis` already
carries everything needed (`quality`, `health`, `synergy`, and, since #471 Part A,
`suggestions`). This is a **presentation** redesign.

## Goal

Someone who has never read the code opens the Analysis tab and, within a few seconds,
understands: *is my deck in good shape, what should I add next and why, and what's its
main weakness* — without encountering a single unexplained number.

## The design: four zones, top to bottom

### Zone 1 — Verdict line

A single row giving instant orientation:

- **Left:** the archetype + the declared-gameplan selector (the existing
  `ArchetypeBadge` + gameplan `SortSelect`, unchanged as a control).
- **Right:** the Deck Quality Score as a **plain tier word + number** — e.g.
  `Strong · 78`. Tier from `quality.score`:

  | Score | Tier |
  |-------|------|
  | 80-100 | Excellent |
  | 65-79 | Strong |
  | 45-64 | Solid |
  | 25-44 | Rough |
  | 0-24 | Needs work |

  (Tiers are display-only; the number stays authoritative. Cutoffs live in one
  `scoreTier(score)` helper so they're tunable.)

This **replaces the full `ScoreGauge` at the top** of the tab — the gauge and its
"why this score?" math move into Zone 4.

### Zone 2 — "Add these" (the hero)

The tab's primary value. Renders the top **4** of `analysis.suggestions` (already
ranked by `rankSuggestions`, capped at 12 in the pipeline). Each row:

- a small card thumbnail (`smallImageUrl`, 46×21, the deck-row crop `58% 4%`),
- the card name,
- **one** plain-English reason (the suggestion's primary reason, reworded — see
  mapping below),
- an `Add` button that adds a copy to the deck (`onIncrement(cardId)`); it disables
  when the card is already at 4 copies.

**Empty state** (deck too small / no suggestions): "Add a few more cards and I'll
suggest what fits." — an invitation, not an error.

**Reason copy.** `rankSuggestions` emits reason strings; a view-layer
`describeReason` reformats the primary one for humans. The raw → shown mapping:

| Raw reason (engine) | Shown to the user |
|---------------------|-------------------|
| `Synergizes with N deck cards` | Works with N of your cards |
| `Fills removal gap` | Adds removal you're short on |
| `Fills card-draw gap` | Adds card draw you're short on |
| `Fills curve hole at cost X` | Fills a gap at X cost |
| `BECKON enabler for Merida` | Feeds your Merida engine |
| `Shift target for a card in the deck` | A Shift target for your deck |
| `On-curve Song for a Singer` | A song your singers can play free |

Only the **primary** reason shows (reasons are ordered; gap-filling is prepended).
One line, truncated with ellipsis if needed.

### Zone 3 — Health at a glance

A compact strip, no jargon:

- a row of **dimension dots** — one dot per `health.analyzers` entry, colored by
  `status` (good = success, warn = warning, bad = danger), each with a short label
  (curve, removal, draw, synergy, …),
- a single **"biggest issue" callout** — the worst-status analyzer's `message`, or
  the top vulnerability, phrased as one line (e.g. "Weak to board wipes"). Omitted
  when nothing is wrong.

### Zone 4 — Details (collapsed by default)

A single disclosure ("Details" / chevron). Collapsed on open — the builder gets
actions first, depth on demand. Expands to the **existing** #472 content, relabeled
in plain language:

- the full **Deck Quality Score** gauge + "why this score?" → `ScoreMathModal`
  (existing `ScoreGauge` moves here),
- the **per-dimension health** breakdown (existing `HealthGrid`),
- **vulnerabilities** (existing `VulnerabilityBox`),
- **"Consider cutting"** — the deck's low-connection cards, from
  `synergy.weakLinks`, each resolved to a card row with a plain "connects to little"
  note. This is the *only* surviving use of the synergy data in the UI.

The abstract synergy metrics (`overallScore` as "density", `keyCards`, per-card
"N links") are **removed from the user-facing UI entirely**. They remain in
`DeckAnalysis` for the pipeline/tests; they are simply not rendered.

## Components

### New
| Component | Purpose |
|-----------|---------|
| `SuggestionList` | Zone 2: renders `Suggestion[]` as add-rows (thumbnail, name, reason, Add). Reuses the deck-row thumbnail treatment. |
| `SuggestionRow` (internal to `SuggestionList`) | one suggestion row; kept small to hold CodeScene complexity down (see the #468 `DeckCardRow` extraction precedent). |
| `VerdictLine` | Zone 1: archetype + gameplan control + tier·score. |
| `HealthGlance` | Zone 3: dimension dots + biggest-issue callout. |
| `describeReason(reason: string): string` | the raw→friendly reason mapping (pure, table-driven, unit-tested). |
| `scoreTier(score: number): string` | score→tier word (pure, unit-tested). |

### Reorganized (moved, not deleted)
`DeckAdvisorPanel` is rewritten as the four-zone composition. `ScoreGauge`,
`HealthGrid`, `VulnerabilityBox`, `ScoreMathModal`, `ArchetypeBadge` all survive and
are rendered inside the new zones (mostly Zone 4). The gameplan `SortSelect` stays in
Zone 1.

### Removed
`SynergySurface.tsx` + its story + test (the confusing #471 Part-B surface). Its data
need is met by the "Consider cutting" list built directly from `synergy.weakLinks`.

## Data flow

Everything is already on `DeckAnalysis` (no engine/pipeline change):

- Zone 1 tier ← `quality.score`; archetype ← `health.archetype` / gameplan.
- Zone 2 ← `analysis.suggestions` (top 4); each resolved via `getCardById`
  (threaded to the Analysis tab in #471 Part B — that plumbing stays). `Add` ←
  the deck's existing `onIncrement`, also threaded down.
- Zone 3 ← `health.analyzers` (dots) + worst analyzer / `health.vulnerabilities`
  (callout).
- Zone 4 ← `quality` (gauge + math), `health.analyzers` (HealthGrid),
  `health.vulnerabilities` (VulnerabilityBox), `synergy.weakLinks` (cuts).

`DeckPanel` / `AnalysisTab` must also receive `onIncrement` for the Add buttons (it
already receives it for the Cards tab; thread it into `AnalysisTab`).

## Interactions

- **Add** → `onIncrement(cardId)`; the suggestion list reacts on the next analysis
  pass (debounced 300ms, as today). Button disabled at 4 copies.
- **Details** → local `useState` expand/collapse; collapsed by default.
- **Why this score?** → the existing `ScoreMathModal`, opened from inside Details.
- **Gameplan** → the existing selector; changing it re-runs analysis (deck signature
  changes), refreshing every zone.

## Non-goals (YAGNI)

- No click-to-open-detail on suggestion rows in v1 (the value is *Add*; detail can
  come later). An "i"/details affordance is deferred unless the review calls for it.
- No re-ranking controls, filters, or "why ranked here" expansion in v1.
- No mobile layout (the builder is desktop-only until the mobile builder exists).
- No change to `rankSuggestions` / `aggregateDeckSynergy` / scoring — presentation
  only.

## Testing

- `describeReason` + `scoreTier`: pure unit tests over the mapping tables + boundaries.
- `SuggestionList`: renders N rows with reason + Add; empty state; Add fires
  `onIncrement`; disabled at 4 copies.
- `HealthGlance`: dot colors track status; callout shows worst issue; hidden when clean.
- `DeckAdvisorPanel`: the four zones render in order; Details collapsed by default,
  expands to gauge/health/vulnerabilities/cuts.
- Stories for `SuggestionList`, `VerdictLine`, `HealthGlance`, and the composed
  `DeckAdvisorPanel` (populated / empty / low-score).
- All in Inkweave's real theme (dark + gold), verified against the design tokens; the
  claude.ai-styled brainstorm mockup was for structure only.

## Open questions for review

1. **Suggestion count** — 4 in Zone 2, or 5-6? (More = more scrolling before Details.)
2. **"Consider cutting"** — keep it in Details, or drop it for v1 (weak-links can be
   noisy on a legal 60-card deck)?
3. **Tier cutoffs** — the table above is a first pass; do the words/ranges feel right?
