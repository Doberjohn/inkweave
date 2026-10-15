# Singer + Songs Synergy Rule

Detailed documentation for the Singer + Songs rule — a direct synergy that pairs characters with the Singer keyword to compatible Song action cards.

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/cardHelpers.ts`
**Rule ID**: `singer-songs`
**Category**: `direct` (pair-specific, bidirectional)

---

## Overview

Singer is a keyword on characters that lets them exert to sing a Song action card for free, as long as the Song's ink cost is within the Singer's numeric threshold. For example, a Singer 5 character can sing any Song costing 5 or less.

Any character can already sing a Song its own printed cost reaches: every Song reads "A character with cost N or more can ⟳ to sing this song for free." So Singer only adds the Songs above that cost, and those are the only Songs the rule pairs: a cost-3 Singer 5 pairs with Songs costing 4 or 5.

This creates a natural pair synergy: Singers want Songs to sing, and Songs benefit from Singers who can sing them without spending ink. Unlike playstyle rules (where density matters), Singer + Songs scores on **value efficiency** — how much ink the Singer saves by singing the Song for free.

### Bidirectional Matching

Both directions are matched:
- **Forward**: Selecting a Singer finds the Songs its Singer lets it sing (printed cost < Song cost ≤ Singer value)
- **Reverse**: Selecting a Song finds the Singers whose Singer lets them sing it (the same gate)

Both directions produce identical scores for the same pair.

### Example

When this example was written, selecting **Powerline - World's Greatest Rock Star** (cost 6, Singer 9) found (some of these cards have since left Core):
- **Grab Your Sword** (cost 7) — score 6 (good savings, 2 ink wasted)
- **A Whole New World** (cost 9) — score 8 (perfect fit, 0 ink wasted)

**Be Our Guest** (cost 2) and **Let It Go** (cost 5) once paired at 5 too, but Powerline's own cost of 6 already sings them, so they no longer pair.

---

## Detection

### Singer Detection

Uses `hasKeyword(card, 'Singer')` — checks if the card's `keywords` array contains an entry starting with "Singer". The numeric threshold is extracted via `getKeywordValue(card, 'Singer')`, which parses the number after the keyword (e.g., "Singer 5" → 5).

**Fallback**: If `getKeywordValue` returns `null` (a Singer keyword without a number, which doesn't exist in the current card pool), the rule falls back to `card.cost` as the Singer value. This is a defensive default, and it pairs the card with no Song: a Singer value equal to the printed cost reaches nothing the cost doesn't.

### Conditional Singer (transformer-synthesized)

Some characters have no Singer keyword but gain one on themselves from ability text. The card data carries no keyword entry for them (the reveal form and the LorcanaJSON source both record only printed keywords), so `transformCard` (`collectKeywords` in `packages/synergy-engine/src/utils/cardTransformer.ts`) synthesizes it, the same way it already synthesizes conditional Shift:

```regex
/this\s+character\b(?:(?!\bcharacters?\b)[^.]){0,60}?\bgains\s+Singer\s+(\d+)/i
```

- Anchored on "this character" with a bounded gap that may not name another character, so a grant to others ("your other characters gain Singer 4", "chosen character gains Singer 5") never counts.
- Scanned over each ability's `effect`/`fullText` and then the card's own `fullText`. The card text matters because reveal-form preview cards carry only keyword-type abilities, so their named-ability text lives solely in `fullText`.
- A native Singer keyword always wins; the conditional value is added only when none exists.

For example **Mickey Mouse - Amber Champion** ("While you have 2 or more other Amber characters in play, this character gains Singer 8") and **Miguel Rivera - Street Musician** ("While you have a song card in your discard, this character gets +1 ◊ and gains Singer 3"); Coverage names every conditional Singer in the pool. They then flow through the standard detection, cost gate and score table below; the synthesized keyword also shows as a plain Singer chip in the web UI and under its Keyword filter, the trade-off already accepted for conditional Shift.

### Song Detection

Uses `isSong(card)` which checks:
1. `card.type === 'Action'` — must be an Action card
2. **AND** either `card.classifications?.includes('Song')` or `textContains(card, 'song')`

This catches Songs via their official classification and via text-based fallback for cards that reference the Song mechanic.

### Cost Gate

The core constraint: `singer.cost < song.cost <= singerValue`. A Singer 5 can sing Songs costing 1-5 but not 6+, and a cost-3 Singer 5 sings the Songs costing 1-3 without its Singer, so it pairs only with Songs costing 4 or 5. `singerUnlocksSong` in `rules.ts` enforces this in both the forward and reverse paths. A conditional Singer is gated on its printed cost the same way.

### Sing Together only

A singer whose text says it "can't sing songs without Sing Together" (`/\bcan't sing songs without Sing Together\b/i`, Meilin Lee - Lead Vocalist) pairs only with songs that have the Sing Together keyword, under the same cost gate. `singerUnlocksSong` in `rules.ts` holds both checks for the forward and reverse paths.

---

## Scoring

Score is based on **threshold utilization** — how efficiently the Singer's capacity is used. A perfect match (Song cost = Singer value) extracts maximum value; a large gap means the Singer could have been singing a more expensive Song instead.

### Score Table

| Diff (Singer value - Song cost) | Score | Display Tier | Rationale |
|--------------------------------|-------|-------------|-----------|
| 0 (exact match) | **8** | Strong | Perfect fit — the Singer sings at full capacity |
| 1 | **7** | Strong | Near-perfect, 1 ink of capacity wasted |
| 2 | **6** | Moderate | Good savings, slight inefficiency |
| 3+ | **5** | Moderate | Functional but the Singer could do better |

<!-- coverage:start scores -->
Counted by `pnpm refresh-rule-coverage` over the Core cards in the synergy pool (sets 9-14).

```chart
{
  "type": "bar",
  "title": "Score distribution (548 unique pairs)",
  "data": {
    "labels": ["5", "6", "7", "8"],
    "datasets": [
      {
        "label": "Pairs",
        "data": [9, 20, 269, 250],
        "backgroundColor": ["#60b5f5", "#60b5f5", "#6ee7a0", "#6ee7a0"]
      }
    ]
  }
}
```
<!-- coverage:end -->

### Why Not Higher Than 8?

Scores 9-10 are reserved for irreplaceable, game-defining synergies (like perfect Shift curves with free cost). Singer + Songs is powerful but fungible — any Singer 5 works equally well with any cost-5 Song. The synergy is about cost efficiency, not unique card interactions.

### Why Not Lower Than 5?

Every pair is a Song the Singer could not sing for free without its Singer, so even the loosest fit (a cost-4 Singer 8 with a cost-5 Song) plays a card for free that would otherwise cost its full ink. That's still a real synergy, just an inefficient one. Below 5 would imply the pairing is barely worth noting, which undersells the "free card" aspect.

### Explanation Template

```
{singer} can sing {song} (cost {songCost}) for free with Singer {value}.
```

`{singer}` and `{song}` are the `{A}`/`{B}` chips: `{A}` is the card whose page shows the tile, so on the Singer's page the line reads "{A} can sing {B} (cost 2) for free with Singer 9." and on the Song's page "{B} can sing {A} (cost 2) for free with Singer 9." The pair view draws each token as its card's chip, and a tile's tooltip writes in the names: "Powerline can sing Be Our Guest (cost 2) for free with Singer 9."

---

## Coverage

<!-- coverage:start coverage -->
- **27 Singers** (Amber 16, Ruby 11), 2 of them conditional: Mickey Mouse - Amber Champion, Miguel Rivera - Street Musician
- **78 Songs** (Amber 20, Emerald 13, Ruby 13, Amethyst 12, Steel 11, Sapphire 9)
- **548 unique pairs** after the engine's ink-compatibility filter (`canShareDeck`), scored as the chart under Score Table shows

```chart
{
  "type": "doughnut",
  "title": "Cards by number of partners (102 cards)",
  "data": {
    "labels": ["1-4 partners (23)", "5-9 partners (35)", "10-14 partners (27)", "15+ partners (17)"],
    "values": [23, 35, 27, 17]
  }
}
```
<!-- coverage:end -->

A conditional Singer's keyword comes from its ability text (see Conditional Singer), not from the card data.

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Singer + Songs')`.

### Gate Tests (3 tests)

| Test | What It Verifies |
|------|-----------------|
| Singer keyword → matches | `matches()` returns true for Singer characters |
| Non-Singer → no match | `matches()` returns false for regular characters |
| Song → matches (reverse) | `matches()` returns true for Song action cards |

### Forward Synergy Tests (6 tests)

| Test | What It Verifies |
|------|-----------------|
| Cost gate filtering | A song above the printed cost found, one above the Singer value excluded |
| Score 8 (diff=0) | Song cost equals Singer value |
| Score 7 (diff=1) | Song cost is Singer value - 1 |
| Score 6 (diff=2) | Song cost is Singer value - 2 |
| Score 5 (diff=3+) | Song cost is Singer value - 3 or more |
| Bidirectional flag | All matches have `bidirectional: true` |

### Reverse Synergy Tests (1 test)

| Test | What It Verifies |
|------|-----------------|
| Song finds Singers | Reverse lookup with cost gating (Singer 5 found, Singer 3 excluded for cost-4 Song) |

### Negative Tests (1 test)

| Test | What It Verifies |
|------|-----------------|
| Non-Action excluded | Character with "song" in text is not matched as a Song |

### Reverse Scoring Symmetry (1 test)

| Test | What It Verifies |
|------|-----------------|
| Reverse score matches forward | Same pair scores identically regardless of lookup direction |

---

### Conditional Singer tests

`packages/synergy-engine/src/__tests__/cardTransformer.test.ts` pins the synthesis (from an ability effect, from `fullText` with no abilities array, native keyword wins, grants to other characters ignored); one integration test in the Singer block of `rules.test.ts` runs Miguel's raw record through `transformCard` and finds a cost-3 song at 8.

### Real-card tests (`singer-songs.test.ts`)

| Test | What It Verifies |
|------|-----------------|
| Sing Together only | Meilin Lee - Lead Vocalist pairs with Un Poco Loco (Sing Together) and not with Heal What Has Been Hurt, from either side |
| Song its cost already sings | 4*Town - Hottest Band of the Year (cost 4) doesn't pair with Education or Elimination (cost 4), from either side |
| Song only Singer reaches | 4*Town pairs with Let It Go (cost 5) at 8, from either side |

## Design Decisions and Rationale

### Why Bidirectional?

Unlike Named Companions (forward-only, because only the referencing card benefits), Singer + Songs is bidirectional because both sides benefit equally: the Singer gets a free exert target, and the Song gets played without spending ink. When browsing Songs, you want to see which Singers can sing them — that's a genuine deck-building question.

### Why Score by Efficiency, Not by Card Power?

The rule scores on cost-gap efficiency rather than evaluating what the Song actually does. This is intentional: a Song's individual power is a card evaluation question, not a synergy question. The synergy is "can this Singer play this Song for free?" — and the answer's quality depends on how much ink is saved, not the Song's text.

### Why Is the Minimum Score 5?

Singer + Songs is a direct rule, not a playstyle rule. Every valid pair represents a concrete mechanical interaction (free play), not just thematic alignment. Even the worst-case pairing (a Song just above the printed cost, well under the Singer value) still means a free card only Singer unlocks, which is worth at least a Moderate score.

### Why Only Songs Above the Printed Cost?

A Song's own text lets any character with cost N or more sing it for free, so a Singer whose printed cost already reaches a Song gets nothing from its keyword there. Pairing those Songs credited Singer with what every character of that cost does: 4*Town - Hottest Band of the Year (cost 4, Singer 5) with Education or Elimination (cost 4) scored 7, and two voters rated it 1. The gate drops those pairs and keeps the Songs only Singer reaches.

A singer whose own text rewards singing (Powerline - World's Greatest Rock Star's MASH-UP, 4*Town's STAR PERFORMANCE) gets that reward from cheaper Songs too, but the reward comes from its sing trigger, not its Singer. The rule pairs no sing trigger with Songs, on a Singer or not: Miguel Rivera - Promising Musician ("Whenever this character sings a song, gain 1 lore") has no Singer, so it has no Singer + Songs pairs.
