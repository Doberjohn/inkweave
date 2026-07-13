# Deck Advisor UI (#472) — Session Design & Definition of Done

_Date: 2026-07-13 · Branch: `deck-builder` · Task: #472 (P1: DeckQualityScore display + DeckAdvisorPanel)_

## Goal

Surface the already-built **v1** deck advisor (`analyzeDeck` → stats / synergy / health / vulnerabilities / archetype / Deck Quality Score) in the deck-builder UI. **Display + wiring only.** The analyzer logic (#469/#470) is closed; this task renders it.

## Placement (decided, after A/B/C exploration)

- **Cards tab** — the strip row splits **2/3 cost curve + 1/3 deck-health summary**. The health summary is a compact *live* preview (score + tier + the sharpest flags); clicking it switches to the Analysis tab. Curve keeps its width; the advisor is always glanceable without a heavy panel or stealing list height.
- **Analysis tab** — the full **`DeckAdvisorPanel`** (the expanded advisor). The Cards / Analysis tabs stay.
- **Rejected:** persistent dock / header-band / split-pane containers (A/B/C) — heavier, steal list space; the summary-strip + tab is lighter and reuses the Analysis tab already wired.

## Components (this session = the full #472 panel)

Sourced from `useDeckAnalysis(deck, getCardById)` → `{analysis, isLoading}` (built).

| Component | Renders | Status |
|---|---|---|
| `ScoreGauge` | Deck Quality Score + glass-box breakdown | **done** |
| `HealthMeter` (per dimension) | analyzer rows (curve/removal/draw/…) + status | to build |
| `VulnerabilityBox` | pool-derived "what to watch for" risks | to build |
| `ArchetypeBadge` | detected archetype + confidence | to build |
| Declared-gameplan selector | overrides the auto archetype → `deck.gameplan` → re-runs `analyzeDeck` | to build |
| `HealthSummary` (Cards-tab 1/3) | compact live preview → links to Analysis tab | to build |
| `DeckAdvisorPanel` | composes the above in the Analysis tab | to build |

## Data flow

`useDeckAnalysis` → DeckPanel → (Cards-tab `HealthSummary`) + (Analysis-tab `DeckAdvisorPanel`). The gameplan selector writes `deck.gameplan` via `useDeck`; the signature change re-runs `analyzeDeck` (debounced).

## Definition of Done (this session)

1. Cards-tab 2/3 : 1/3 split ships; health summary → Analysis tab on click.
2. Analysis tab renders the full `DeckAdvisorPanel` (score + per-dimension health + vulnerabilities + archetype badge + gameplan selector), wired live, **working end-to-end in the running app** (verified on the Analysis tab).
3. Transparent glass box (score breakdown visible).
4. `.stories.tsx` for each new visual component (coverage gate); focused tests; adversarial review; committed; close-out (#474 entry, issue notes, PLAN update).
5. The **removal-universality insight logged** as a Phase-3 calibration input (issue note + memory).

## Out of scope — deferred to Part C / Phase 3 (#453)

- **Analyzer calibration:** weight tuning; per-deck pillar *relevance* (e.g. a legit 0-removal deck should not be penalized on removal); which pillars are conditional vs universal. Needs the human-in-the-loop case library + ground-truth ratings. The v1 archetype-parameterized targets ship as-is; the glass box keeps them honest (you see and can discount a dimension).

## Build sequence

1. **Cards-tab split** — restructure the strip into 2/3 `CostCurveStrip` + 1/3 `HealthSummary`; click → Analysis tab.
2. **Analysis-tab panel** — `ArchetypeBadge` + gameplan selector, `HealthMeter` list, `VulnerabilityBox`, composed with `ScoreGauge` into `DeckAdvisorPanel`.
3. Stories + tests; verify in the running app; adversarial review; commit; close-out + log the calibration insight.
