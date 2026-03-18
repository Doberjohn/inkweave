# Synergy Scoring System — Design Decisions

This document captures the design rationale for the 1-10 numeric scoring system introduced in #132.
It records decisions made during brainstorming so future contributors understand the "why" behind the design.

## Anchor-Based Scoring

Scores use fixed **anchor points** (odd numbers) with clear definitions. Even numbers were originally
reserved for community voting (#9), but the engine now assigns them for nuanced scoring (e.g., 8 for
gap=1 with one inkable card, 6 for free Shift onto expensive base with condition activation, 10 for
free Shift with condition bonus).

| Score | Label        | Meaning                                                                   |
|-------|--------------|---------------------------------------------------------------------------|
| 1     | Negligible   | Coincidental overlap. Cards share a theme but rarely interact.            |
| 3     | Weak         | Mild situational benefit. You wouldn't pick one because of the other.     |
| 5     | Moderate     | Solid synergy. Worth considering when choosing between similar cards.     |
| 7     | Strong       | Actively want both in the same deck. One improves the other's value.      |
| 9     | Perfect      | Core synergy pair or strategy pillar. Main reason to play these together. |

**10 can be assigned by the engine** when a condition bonus pushes a score 9 pair higher (e.g., free Shift + condition activation). Community voting (#9) can also nudge scores to 10.

## Score Type: `number`

The `score` field is typed as `number`, not a branded integer. The engine assigns integers (1, 3, 5, 7, 9)
but the type allows decimals so community voting (#9) can nudge scores (e.g., 7 → 7.3) without a type migration.

## Cross-Category Comparability

Direct synergy scores and playstyle synergy scores share the same 1-10 scale. Both answer the same
user question: "How much should I care about this synergy when building a deck?"

A direct synergy of 7 and a playstyle synergy of 7 are treated as equivalent in sorting and display.
If playstyle synergies are systematically over/under-valued compared to direct ones, the fix is
adjusting anchor assignments — not splitting into separate scales.

## "Everything is 7" — Playstyle Differentiation

Most playstyle synergies land at 7 because playstyle pairs all reinforce the same strategy equally.
Differentiation *within* a playstyle comes from **card potency** (#136) — a separate axis measuring
how important an individual card is to the strategy, not how well two cards synergize.

Differentiation *across* playstyles (e.g., "Is lore denial stronger than location control?") is
deliberately excluded from engine scoring. Strategy power depends on the meta and shifts with new
sets. Community voting is better positioned to capture this — if players feel lore denial is stronger,
those synergies get upvoted naturally.

## Bidirectional Asymmetry

Some synergies are naturally asymmetric — Card A benefits from Card B more than B benefits from A.
The engine already handles this: each rule's `findSynergies()` runs from one card's perspective.
If the rule matches Card A, but not Card B, only A → B produces a result. No field changes needed.

## Anti-Synergies

Cards that actively work against each other (e.g., "banish all locations" in a location deck) are
not modeled. Absence of a synergy match is sufficient — the engine only reports positive synergies.
Anti-synergies could be a future concept if user demand warrants it, but they require separate UI
treatment and engine logic that would complicate the current system.

## Display Threshold

The engine returns all synergy matches regardless of score. Filtering low-score results (e.g., hiding
score ≤ 2) is a UI decision. The web app can implement a "Show weak synergies" toggle. This keeps
the engine consumer-agnostic — the embeddable widget (#58) or deck builder may want all results.

## Display Precision

- **Grid badge**: Shows tier label only ("Perfect", "Strong", "Moderate", "Weak") derived from score range.
  No raw number displayed. Clean and scannable. Perfect (>=9.5) folds into Strong for filtering.
- **Detail view (#115)**: Shows the actual numeric score alongside the tier badge. Format TBD
  (e.g., "7", "7/10", "7.3") — to be decided when implementing the detail view.

The `getStrengthTier()` utility accepts any `number` (not just integers) from day one, so it
handles both engine-assigned integers and future community-voted decimals.

## Cost Parameters

Location **move cost**, card **play cost**, and support card cost were considered for scoring and
excluded. Move cost is a one-time payment to move a character to a location (not ongoing), so the
difference between moveCost=1 and moveCost=2 is negligible to the synergy relationship. Play cost
and card cost affect card evaluation (future potency in #136), not the synergy between two cards.

`moveCost` is being added to `LorcanaCard` in #132 as a data model improvement (it exists in raw
JSON but wasn't extracted), but it does not influence synergy scores.

## Rule Score Tables

### Rule 1: Shift Targets (Direct)

Scores based on **curve gap** (shift cost - base cost), **inkwell** (fallback utility), and **condition activation** (+1 bonus).

For the full rule documentation with examples, condition matchers, and design rationale, see [`SHIFT_TARGET_RULE.md`](SHIFT_TARGET_RULE.md).

**Standard Shift (gap-based):**

| Curve Gap | Inkable       | Score  | Tier     | Why                                                                |
|-----------|---------------|--------|----------|--------------------------------------------------------------------|
| 1         | Both          | **9**  | Strong   | Perfect on-curve play, both can be inked as fallback               |
| 1         | One           | **8**  | Strong   | Perfect curve, one card is inkable as fallback                     |
| 1         | Neither       | **7**  | Strong   | Perfect curve, but neither is inkable — less flexible off-curve    |
| 2         | Any           | **7**  | Strong   | Smooth curve, one-turn gap                                        |
| 0         | Any           | **5**  | Moderate | Same cost — no ink savings, only skips drying phase                |
| 3         | Any           | **5**  | Moderate | Wide gap — 3 turns between base and shift                         |
| 4+        | Any           | **3**  | Weak     | Poor alignment, rarely worth holding a base this long              |
| Negative  | Any           | **3**  | Weak     | Base costs more than shift — no practical reason to shift "down"   |

**Free Shift (Shift 0, cost-based):**

| Base Cost | Condition? | Score  | Tier     | Why                                                 |
|-----------|-----------|--------|----------|-----------------------------------------------------|
| <= 3      | Yes       | **10** | Perfect  | Free Shift + cheap base + condition enabler         |
| <= 3      | No        | **9**  | Strong   | Free Shift onto early base — extremely powerful     |
| 4-5       | Yes       | **8**  | Strong   | Free Shift + mid base + condition enabler           |
| 4-5       | No        | **7**  | Strong   | Free Shift but base takes until mid-game to deploy  |
| 6+        | Yes       | **6**  | Moderate | Free Shift + expensive base, condition helps        |
| 6+        | No        | **5**  | Moderate | Free Shift but expensive base limits the advantage  |

### Rule 2: Lore Loss (Playstyle: Lore Steal)

Uniform scoring — value comes from density of denial cards, not specific pairs.

| Pairing                 | Score | Tier   | Why                                                                                                                                                                         |
|-------------------------|-------|--------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Any two lore-loss cards | **7** | Strong | Each additional denial card increases strategy consistency. Not 9 because no individual pair is a core combo — it's the accumulation of 6-8 cards that makes the archetype. |

### Rule 3: Location Control (Playstyle: Location Control)

**3a. Support Card paired with a Location Card**

| Role          | Score | Tier     | Example Card                         | Why                                                                            |
|---------------|-------|----------|--------------------------------------|--------------------------------------------------------------------------------|
| at-payoff     | **7** | Strong   | Vanellope Von Schweetz               | Direct payoff for being at a location (draw, lore, stat boosts)                |
| play-trigger  | **7** | Strong   | Elsa - Ice Artisan                   | Triggers on playing a location — repeatable control                            |
| buff          | **7** | Strong   | Fix-It Felix Jr. - Niceland Steward  | Protects or buffs locations, keeps the strategy alive                          |
| location-ramp | **7** | Strong   | Elsa - Concerned                     | Reduces location play cost — accelerates the strategy                          |
| move          | **5** | Moderate | Transport Pod                        | Enables moving characters for free — useful utility but no value on its own    |
| in-play-check | **5** | Moderate | John Silver - Greedy Treasure Seeker | Conditional bonus when a location exists — good when active, nothing otherwise |
| tutor         | **5** | Moderate | The Islands I Pulled From the Sea    | Finds locations for consistency — no direct benefit from them being in play    |
| boost         | **5** | Moderate | Webby's Diary                        | Supports boost mechanic on characters or locations                             |

**3b. Cross-Synergy (Support Card paired with another Support Card)**

| Condition                             | Score | Tier     | Example                                  | Why                                                                |
|---------------------------------------|-------|----------|------------------------------------------|--------------------------------------------------------------------|
| Both high-value roles + complementary | **5** | Moderate | Vanellope (at-payoff) + Launchpad (buff) | Different strategy angles, both want locations in play             |
| Otherwise                             | **3** | Weak     | Transport Pod (move) + Minnie (tutor)    | Loose thematic overlap, minimal benefit without a location present |

### Rule 4: Discard (Playstyle: Discard)

Role-based scoring — enablers that empty the opponent's hand pair with payoffs that capitalize on hand-size advantage.

| Pairing            | Score | Tier   | Why                                                                                    |
|--------------------|-------|--------|----------------------------------------------------------------------------------------|
| Enabler ↔ Payoff   | **8** | Strong | Direct synergy: enabler depletes hand, payoff converts that into advantage              |
| Enabler ↔ Enabler  | **7** | Strong | Both disrupt the opponent's hand, increasing consistency of the denial strategy         |
| Payoff ↔ Payoff    | **7** | Strong | Both reward hand-size advantage, but need enablers to unlock their potential            |

---

## Future: Deck Scoring

The numeric scoring system is foundational for the future deck builder. Deck-level synergy scores
will aggregate individual synergy scores, likely with different formulas per category:

- **Direct synergies**: pair quality × pair count (specific combos in the deck)
- **Playstyle synergies**: density with diminishing returns (8th lore-loss card adds less than the 4th)

Both formulas require numeric scores to work. The shared 1-10 scale across categories means they
can be combined into a single deck score.
