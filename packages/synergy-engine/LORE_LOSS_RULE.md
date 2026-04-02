# Rule 3: Lore Loss (Playstyle: Lore Denial)

Cards that make the opponent lose lore reinforce the same denial strategy. Every lore-denial card synergizes with every other lore-denial card — the more denial cards in a deck, the more consistently the strategy works.

## Detection

**Pattern**: `/(?:each |chosen |all )?opponents? loses? (?:\d+ )?lore/i`

Applied against all text sections of a card. The regex handles:

| Variant | Example text |
|---------|-------------|
| Simple | "chosen opponent loses 1 lore" |
| Each | "each opponent loses 2 lore" |
| All | "all opponents lose 1 lore" |
| Plural | "opponents lose lore" |
| No amount | "opponent loses lore equal to the damage" |
| Chosen | "chosen opponent loses 1 lore" |

### What's excluded

- **Self lore loss**: Cards where *you* lose lore (not opponent) — the regex requires "opponent"
- **Conditional prevention**: Cards that *prevent* lore loss — they don't contain "opponent loses"
- **Lore gain**: Cards that give lore — completely different pattern

## Scoring

All pairs score **7** (Strong). This is uniform by design.

**Rationale**: Lore denial is a density-based strategy. Individual pair interactions don't matter — what matters is *how many* denial cards are in the deck. Having 5 lore-denial cards is better than 3, regardless of which specific cards they are. The score reflects that any two denial cards reinforce the same game plan.

Future card potency scoring (#136) may differentiate by looking at how much lore each card removes (1 vs 2 vs variable) or how easy it is to trigger.

## Explanation Template

```
"Both {cardA} and {cardB} make the opponent lose lore"
```

All explanations use the same template since the synergy mechanism is identical for every pair.

## Coverage

| Metric | Value |
|--------|-------|
| Cards matching | 19 |
| Total pairs | 342 (19 × 18 = 342 bidirectional) |
| Score range | 7–7 |
| Playstyle ID | `lore-denial` |

### All Lore Denial Cards

| Card | Set |
|------|-----|
| A Pirate's Life | Shimmering Skies |
| Beast - Aggressive Lord | Shimmering Skies |
| Brom Bones - Burly Bully | Shimmering Skies |
| Donald Duck - Pie Slinger | Into the Inklands |
| Donald Duck - Daisy's Date | Into the Inklands |
| Flotilla - Coconut Armada | Ursula's Return |
| Gloyd Orangeboar - Fierce Competitor | Archazia's Island |
| Jasmine - Rebellious Princess | Ursula's Return |
| LeFou - Cake Thief | Archazia's Island |
| Nani's Payback | Azurite Sea |
| Negaduck - Public Enemy Number One | Azurite Sea |
| Olaf - Snowman of Action | Azurite Sea |
| Rapunzel - Letting Down Her Hair | Shimmering Skies |
| Scrooge McDuck - Ebenezer Scrooge | Azurite Sea |
| Stabbington Brother - With a Patch | Ursula's Return |
| Taffyta Muttonfudge - Crowd Favorite | Into the Inklands |
| The Matchmaker - Unforgiving Expert | Ursula's Return |
| The Sword Released | Into the Inklands |
| Thievery | Ursula's Return |

## Group Size

All 19 cards have exactly 18 synergy matches each (every other denial card). This creates one large, uniform group per card — there are no sub-groupings or tiers within lore denial.

```chart
{
  "type": "doughnut",
  "title": "Lore Denial — Score Distribution (342 pairs)",
  "data": {
    "labels": ["Score 7 — Strong (100%)"],
    "values": [342]
  }
}
```

## Design Rationale

### Why uniform scoring?

Most synergy rules differentiate pairs by *how well* two specific cards work together. Lore denial is different — it's a **deck archetype**, not a pair interaction. The synergy isn't "these two cards combo" but "these two cards pursue the same win condition."

This mirrors how competitive Lorcana players think about lore denial. When building a denial deck, you want *density* — fill the deck with as many denial effects as possible. The specific pairing doesn't matter; each additional denial card makes the strategy more consistent.

### Why score 7 specifically?

Score 7 is the lower bound of "Strong" tier. This communicates:

- **Strong enough to recommend**: If you're building a denial deck, these cards belong together
- **Not overstated**: The synergy is strategic, not mechanical — there's no direct card-to-card interaction like Shift or Singer

### Future improvements

- **Card potency scoring** (#136): Weight by lore removed (1 vs 2 vs variable), trigger difficulty, and body stats
- **Cross-archetype synergy**: Some denial cards also fit other archetypes (e.g., Taffyta is also Location Control). Cross-archetype value could boost scores
- **Ink-aware scoring**: Denial cards in the same ink could score higher (easier to include in the same deck)

## Test Coverage

6 test cases in `rules.test.ts`:

| Test | What it verifies |
|------|-----------------|
| Match with lore loss text | Thievery, Jasmine, Flotilla all match |
| No false positives | Cards without lore loss text don't match |
| No amount variant | "loses lore equal to..." still matches |
| Synergy discovery | Finds other denial cards as score-7 synergies |
| Self-exclusion | Selected card not included in its own synergies |
| Bidirectional flag | All matches marked as bidirectional |
