# Shift Target Synergy Rule

Detailed documentation for the Shift Target rule — the first and most nuanced synergy rule in Inkweave's engine.

**Source**: `packages/synergy-engine/src/engine/rules.ts`
**Rule ID**: `shift-targets`
**Category**: `direct` (pair-specific, not density-based)

---

## Overview

In Lorcana, **Shift** is a keyword that lets you play a character on top of another character with the same name, paying the Shift cost instead of the full ink cost. The shifted character skips the **drying phase** (it can act immediately), making Shift one of the strongest tempo plays in the game.

The Shift Target rule finds all valid Shift pairs — characters that share a base name where one has the Shift keyword — and scores them based on how naturally they curve together in a game.

### Bidirectional Detection

The rule works in both directions:

- **Forward**: Select a Shift card -> finds all same-named base characters it can shift onto
- **Reverse**: Select a base character -> finds all Shift cards with the same name that can shift onto it

Both directions use the same scoring function (`calculateShiftSynergy`), so scores are always consistent regardless of which card you select first.

```chart
{
  "type": "doughnut",
  "title": "Shift Group Sizes (644 cards)",
  "data": {
    "labels": ["1-4 targets (93.0%)", "5-9 targets (5.3%)", "10-14 targets (1.2%)", "15+ targets (0.5%)"],
    "values": [599, 34, 8, 3]
  }
}
```

### Example

Selecting **Elsa - Ice Maker** (cost 7, Shift 5) finds:
- **Elsa - Snow Queen** (cost 4) — score 9, perfect curve: play on turn 4, Shift next turn

Selecting **Elsa - Snow Queen** (cost 4) finds:
- **Elsa - Ice Maker** (Shift 5) — score 9, same pair, same score

### Shift Variants

`getShiftType` (`utils/cardHelpers.ts`) classifies the Shift keyword into three target kinds so the rule knows what counts as a valid target:

| Keyword | Kind | Valid targets |
|---|---|---|
| `Shift N` | `standard` | same base name (Team compound names like "Belle & Beast" match either half — see below) |
| `Temporary Shift N` | `standard` | same base name; the card returns to hand at end of turn ("Temporary" is a modifier, stripped before classifying) |
| `Combo Shift N` / `Duo Shift N` | `standard` | the named halves of a Team card — flavor labels for a compound-name shift (see below) |
| `X Shift N` (e.g. `Puppy Shift`, `Madrigal Shift`, `Temporary Red Panda Shift`) | `classification` | characters with classification `X` (the prefix may be multiple words) |
| `Universal Shift N` | `universal` | any character |

`classifyShiftKeyword` resolves a keyword in this order: **Universal** → **Team** (card name contains `&`, so any shift label routes to `standard`) → strip a leading **`Temporary `** modifier → **`<classification> Shift N`** → plain **`Shift N`**. Two consequences:

- **"Temporary" is a modifier, not a classification.** It's stripped before the classification match, so `Temporary Shift N` → `standard` and `Temporary Red Panda Shift N` → classification `Red Panda` (rather than a non-existent `Temporary Red Panda` class). The classification prefix may be **multiple words** (`Red Panda`), which the lazy `^(.+?)\s+shift` match handles.
- **"Combo"/"Duo" look like classification prefixes but aren't** — they're flavor labels on Team cards. The reminder text ("named X or Y") isn't visible at classify-time, so the `&` in the card's name is the real signal: Team detection runs before the classification branch and routes `Combo Shift` / `Duo Shift` to `standard`.

#### Team (compound-name) Shift

"Team" Shift cards print a compound name joined by an ampersand — **Belle & Beast**, **Mickey & Minnie**, **Sulley & Boo** — and their reminder text reads "shift onto a character named X **or** Y." The keyword may be plain `Shift N` or a flavor-labelled `Combo Shift N` / `Duo Shift N`; either way the `&` name is what determines targeting, so all of them route to `standard`. A literal same-name match would find neither half, so `standard` targeting routes through `getShiftBaseNames` (`utils/cardHelpers.ts`), which decomposes the shifter's base name on `&` and matches the target against **every** landing name:

```text
getShiftBaseNames("Belle & Beast")            -> ["Belle & Beast", "Belle", "Beast"]
getShiftBaseNames("Carl Fredricksen & Russell") -> ["Carl Fredricksen & Russell", "Carl Fredricksen", "Russell"]
getShiftBaseNames("Ming Lee")                  -> ["Ming Lee"]
```

The split is on `&` only (not spaces or " and "), so multi-word halves stay intact and ordinary names with no ampersand pass through as a single-element list — behaviourally identical to the old exact-match path. Both directions benefit: the Team card finds either base, and either base finds the Team card.

---

## Scoring Architecture

Scoring is split into two phases:

### Phase 1: Base Score (`calculateShiftBaseScore`)

Computes a score from **curve alignment** — how naturally the base card's cost flows into the Shift cost.

The key metric is **curve gap**: `shiftCost - baseCost`

- **Gap 1** = ideal: play base on turn N, Shift next turn on turn N+1
- **Gap 2** = smooth: one turn of waiting, still natural
- **Gap 0** = no savings: Shift costs the same as the base
- **Gap 3+** = slow: opponent has too many turns to remove the base
- **Negative** = nonsensical: base costs more than the Shift

```chart
{
  "type": "line",
  "title": "Scoring Curve — Curve Gap vs Score",
  "data": {
    "labels": ["Negative", "Gap 0", "Gap 1 (no ink)", "Gap 1 (one ink)", "Gap 1 (both ink)", "Gap 2", "Gap 3", "Gap 4+"],
    "datasets": [{
      "label": "Score",
      "data": [3, 5, 7, 8, 9, 7, 5, 3],
      "borderColor": "#d4af37",
      "backgroundColor": "rgba(212, 175, 55, 0.15)",
      "pointBackgroundColor": ["#f59090", "#60b5f5", "#6ee7a0", "#6ee7a0", "#6ee7a0", "#6ee7a0", "#60b5f5", "#f59090"],
      "pointRadius": 6,
      "pointHoverRadius": 8,
      "fill": true,
      "tension": 0.3
    }]
  }
}
```

### Phase 2: Condition Bonus (`baseActivatesShiftCondition`)

Some cards have **conditional Shift** — they only gain the Shift keyword when a game condition is met (e.g., "if a card left a player's discard this turn, this card gains Shift 0"). If the base card's abilities can satisfy that condition, the score gets a **+1 bonus** (capped at 10).

### Orchestrator (`calculateShiftSynergy`)

```
calculateShiftSynergy(shiftCard, baseCard)
  |
  +-- calculateShiftBaseScore(shiftCard, baseCard, shiftCost)  --> {score, reason}
  |
  +-- baseActivatesShiftCondition(shiftCard, baseCard)         --> boolean
  |
  +-- if condition activates: score = min(baseScore + 1, 10)
      append condition explanation to reason
```

---

## Score Table

### Standard Shift (gap-based scoring)

| Score | Curve Gap | Inkwell | Explanation Template | Example |
|-------|-----------|---------|---------------------|---------|
| **9** | 1 | Both inkable | "Perfect curve: play {base} on turn {N}, Shift next turn. Both cards are inkable as fallback." | Elsa - Snow Queen (cost 4, inkable) + Elsa - Ice Maker (Shift 5, inkable) |
| **8** | 1 | One inkable | "Perfect curve: play {base} on turn {N}, Shift next turn. One card is inkable as fallback." | Elsa - Snow Queen (cost 4, not inkable) + Elsa - Ice Maker (Shift 5, inkable) |
| **7** | 1 | Neither inkable | "On curve: Play {base} on turn {N}, Shift next turn. Neither card is inkable — Less flexible if drawn off-curve." | Elsa - Snow Queen (cost 4, not inkable) + Elsa - Ice Maker (Shift 5, not inkable) |
| **7** | 2 | Any | "Smooth curve: {base} flows naturally into Shift within a couple of turns." | Elsa - Snow Queen (cost 4) + Ursula - Sea Witch (Shift 6) |
| **5** | 0 | Any | "Same cost — No ink savings from Shifting, but skips the drying phase." | Elsa - Snow Queen (cost 5) + Elsa - Ice Maker (Shift 5) |
| **5** | 3 | Any | "Wide 3-turn gap — Playable but slow to set up." | Simba - Young Prince (cost 2) + Simba - King (Shift 5) |
| **3** | 4+ | Any | "The cost gap makes it hard to set up {base} in time to shift {shiftCard} onto it." | Ursula - Cauldron Keeper (cost 2) + Ursula - Sea Witch Queen (Shift 8) |
| **3** | Negative | Any | "The cost gap makes it hard to set up {base} in time to shift {shiftCard} onto it." | Base costs more than Shift cost |

```chart
{
  "type": "bar",
  "title": "Shift Target Score Distribution (1,385 matches)",
  "data": {
    "labels": ["3", "5", "7", "8", "9", "10"],
    "datasets": [{
      "label": "Matches",
      "data": [347, 359, 298, 211, 168, 2],
      "backgroundColor": ["#f59090", "#60b5f5", "#6ee7a0", "#6ee7a0", "#6ee7a0", "#fbbf24"]
    }]
  }
}
```

#### Why inkwell matters for gap=1

A gap of 1 is the ideal curve play. But what happens when you draw these cards at the wrong time? **Inkable** cards can be placed face-down as ink — they're never dead draws. This is why:

- Both inkable (score 9): Maximum flexibility. Even if you draw them late, both can become ink.
- One inkable (score 8): Good flexibility. One card has a fallback use.
- Neither inkable (score 7): Perfect tempo, but if you draw them off-curve, both sit dead in hand.

Inkwell only affects gap=1 scoring because that's the tier where the difference between "good synergy" and "great synergy" is meaningful. At wider gaps (2+), the curve alignment itself is the limiting factor, not draw flexibility.

### Free Shift (Shift 0, cost-based scoring)

Free Shift cards use a completely different scoring path because the normal curve gap math breaks down — every gap would be negative.

Instead, scoring is based on **how easy it is to get the base card into play first**:

| Score | Base Cost | Condition Activates? | Explanation Template |
|-------|-----------|---------------------|---------------------|
| **10** | <= 3 | Yes | "Free Shift: Play {base} early, then shift into {shift} for 0 ink. {base} is both a Shift target and enables the free Shift condition." |
| **9** | <= 3 | No | "Free Shift: Play {base} early, then shift into {shift} for 0 ink." |
| **8** | 4-5 | Yes | "Free Shift: Shift {base} into {shift} for 0 ink, but the base takes longer to set up. {base} is both a Shift target and enables the free Shift condition." |
| **7** | 4-5 | No | "Free Shift: Shift {base} into {shift} for 0 ink, but the base takes longer to set up." |
| **6** | 6+ | Yes | "Free Shift but expensive base — Hard to get {base} into play first. {base} is both a Shift target and enables the free Shift condition." |
| **5** | 6+ | No | "Free Shift but expensive base — Hard to get {base} into play first." |

```chart
{
  "type": "bar",
  "title": "Free Shift Scoring — Cost Tier × Condition Bonus",
  "data": {
    "labels": ["Cost 1-3 (cheap)", "Cost 4-5 (mid)", "Cost 6+ (expensive)"],
    "datasets": [
      {"label": "Without condition", "data": [9, 7, 5], "backgroundColor": "#60b5f5"},
      {"label": "With condition (+1)", "data": [10, 8, 6], "backgroundColor": "#fbbf24"}
    ]
  }
}
```

#### Why base cost matters for Shift 0

A free Shift is only as good as how quickly you can set it up:

- **Cheap base (cost 1-3)**: Play the base on turns 1-3, free Shift on the very next turn. Extremely powerful — you get a 5+ cost character for free.
- **Mid base (cost 4-5)**: Takes until mid-game to deploy the base. Still strong, but the opponent has time to respond.
- **Expensive base (cost 6+)**: By the time you can play the base, the free Shift advantage matters less — you're deep into the game where ink is plentiful.

---

## Condition Matcher System

### Purpose

Some Lorcana cards have **conditional Shift** — they don't always have Shift, but gain it when a specific game condition is met. The condition matcher system detects whether a base card's abilities can satisfy that condition, creating a mechanical synergy beyond just sharing a name.

### Architecture

```typescript
interface ShiftConditionMatcher {
  condition: RegExp;    // Matches against the Shift card's text
  satisfiedBy: RegExp;  // Matches against the base card's text
}
```

The `baseActivatesShiftCondition` function:
1. Normalizes both cards' text (collapses newlines)
2. Iterates through all matchers
3. Returns `true` if any matcher's `condition` matches the Shift card AND `satisfiedBy` matches the base card

### Current Matchers

#### Discard Condition

**Shift card text**: "if a card left a player's discard this turn"
```regex
condition: /card left a player's discard/i
```

**Base card text**: Cards that put/return/move/play/banish/shuffle cards from discard
```regex
satisfiedBy: /(?:put|return|move|play|banish|shuffle).*(?:card|cards|character|characters).*from.*discard|from.*discard.*(?:on|to|into|back)|(?:card|character) from.*(?:your|chosen|a|their) (?:player's )?discard/i
```

**Real card example**:
- **Shift card**: Anna - Soothing Sister (cost 5, gains Shift 0 if a card left a player's discard)
- **Base card**: Anna - Little Sister (cost 2, "when you play this character, you may put a card from chosen player's discard on the bottom of their deck")
- **Result**: Score 10 (free Shift onto cheap base + condition activation bonus)

### Adding New Matchers

To add a new condition matcher:

1. Identify the condition text pattern on the Shift card
2. Identify what card abilities could satisfy that condition
3. Add a new entry to `SHIFT_CONDITION_MATCHERS` in `rules.ts`:

```typescript
{
  condition: /your-condition-pattern/i,
  satisfiedBy: /abilities-that-satisfy-it/i,
},
```

4. Add a test case in `packages/synergy-engine/src/__tests__/rules.test.ts`
5. Update the "Current Matchers" section in this document

---

## Conditional Shift Detection in the Loader

**Source**: `apps/web/src/features/cards/loader.ts`

Some cards don't have Shift as a native keyword — they gain it conditionally from ability text. The web loader detects these during card data import.

### How it works

For each card ability, the loader scans the `effect` or `fullText` field for the pattern:

```regex
/gains?\s+Shift\s+(\d+)/i
```

This matches text like:
- "this card gains Shift 0"
- "this character gain Shift 3"

### Native vs Conditional Shift

If a card already has a native Shift keyword (from `ability.type === 'keyword'`), the native value is kept as primary. The conditional Shift is not added as a duplicate.

If no native Shift exists, the conditional value is added to the card's keywords array (e.g., `"Shift 0"`).

### Example

**Anna - Soothing Sister** has no native Shift keyword, but her ability text says:
> "If a card left a player's discard this turn, this card gains Shift 0."

The loader extracts `Shift 0` and adds it to her keywords. The engine then treats her as a Shift card and finds same-named base characters.

---

## Display Tiers

Scores map to visual display tiers in the UI (`apps/web/src/features/synergies/utils/scoreUtils.ts`):

| Tier | Score Range | Color | Background | Short Label |
|------|------------|-------|------------|-------------|
| Perfect | >= 9.5 | `#fbbf24` (gold) | `#3d3010` | Perf |
| Strong | 7 - 9.4 | `#6ee7a0` (green) | `#1a3d1a` | Strong |
| Moderate | 4 - 6.9 | `#60b5f5` (blue) | `#10253d` | Mod |
| Weak | < 4 | `#f59090` (red) | `#3d1a1a` | Weak |

**Note**: Perfect folds into Strong for filtering purposes — selecting "Strong" in the filter also shows Perfect results. This is handled by `TIER_TO_FILTER` in `filterSynergyCards.ts`.

---

## Same-Name Disambiguation in the UI

When two cards in a synergy pair share the same base name (e.g., both are "Elsa"), the UI shows the **version subtitle** to avoid confusion.

**Source**: `apps/web/src/features/synergies/components/SynergyDetailModal.tsx`

### How it works

- The parent component passes `showVersion={cardA.name === cardB.name}` to each `PairCard`
- When `showVersion` is true, the subtitle (derived from `fullName`) is displayed below the card name
- Explanation text uses `card.fullName` (e.g., "Elsa - Ice Maker") instead of `card.name` (e.g., "Elsa") when both cards share a name

### Example

Without disambiguation:
> "Play Elsa on turn 4, Shift into Elsa next turn"

With disambiguation:
> "Play Elsa - Snow Queen on turn 4, Shift into Elsa - Ice Maker next turn"

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Shift Targets')`.

### Matching tests
| Test | What it verifies |
|------|-----------------|
| Find same-named characters for Shift | Forward direction: Shift card finds base characters, ignores different names |
| Find Shift cards when selecting base (reverse) | Reverse direction: base character finds Shift cards |
| Show other Shift cards with same base name | Multiple Shift versions of the same character are found |
| Not match non-Character cards | Actions/Items with Shift keyword are excluded |

### Scoring tests
| Test | Score | Scenario |
|------|-------|----------|
| On-curve inkable base | 9 | Gap=1, both inkable (default fixture) |
| On-curve one inkable | 8 | Gap=1, shift inkable, base not inkable |
| On-curve neither inkable | 7 | Gap=1, both explicitly not inkable |
| CurveGap 2 | 7 | Gap=2, inkable base |
| CurveGap 3 | 5 | Gap=3 (wide, slow setup) |
| CurveGap 4+ | 3 | Gap=4+ (poor alignment) |
| Same cost (gap 0) | 5 | No ink savings |
| Consistent reverse direction | 9 | Forward and reverse produce identical scores |
| Regression: small shift onto cheap base | 9 | Shift 3 onto cost 2 (gap=1, was incorrectly scored 3) |
| Regression: huge shift onto tiny base | 3 | Shift 8 onto cost 2 (gap=6, was incorrectly scored high) |
| Free Shift + condition activation | 10 | Shift 0, cheap base, discard condition satisfied |
| Free Shift onto cheap base | 9 | Shift 0, base cost 2 |
| Free Shift onto mid-cost base | 7 | Shift 0, base cost 4 |
| Free Shift onto expensive base | 5 | Shift 0, base cost 7 |

### Loader tests
Located in `apps/web/src/features/cards/__tests__/loader.test.ts`:
| Test | What it verifies |
|------|-----------------|
| Conditional Shift extraction | "gains Shift 0" in ability text adds `Shift 0` to keywords |

---

## Design Decisions and Rationale

### Why curve gap instead of cost difference?

Early versions scored based on `baseCost - shiftCost` (how much ink you save). This was wrong because:

- **Shift 3 onto cost 2**: Saves 1 ink but the curve is perfect (play on turn 2, Shift on turn 3). Old scoring rated this as weak.
- **Shift 8 onto cost 2**: Saves 6 ink but the curve is terrible (play on turn 2, wait until turn 8). Old scoring rated this as strong.

Curve gap (`shiftCost - baseCost`) correctly captures the actual play pattern: how many turns between playing the base and being able to Shift.

### Why separate Shift 0 scoring?

With Shift 0, every curve gap is negative (0 - baseCost < 0), which would score everything as 3. But free Shift is actually very powerful — the limiting factor is getting the base into play, not the gap. So we use base cost tiers instead.

### Why +1 for condition activation?

The condition bonus is modest (+1) because the condition being satisfiable doesn't mean it will always trigger. It's a meaningful bonus that can push a borderline pair into a higher tier, but it doesn't override the fundamental curve/cost analysis.

### Why fold Perfect into Strong for filtering?

Users think in 3 tiers: "good, okay, bad." The Perfect tier exists for display (gold badge) but would create filter confusion. When someone selects "Strong" they want all the good synergies, including the exceptional ones.
