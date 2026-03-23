# Singer + Songs Synergy Rule

Detailed documentation for the Singer + Songs rule — a direct synergy that pairs characters with the Singer keyword to compatible Song action cards.

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/cardHelpers.ts`
**Rule ID**: `singer-songs`
**Category**: `direct` (pair-specific, bidirectional)

---

## Overview

Singer is a keyword on characters that lets them exert to sing a Song action card for free, as long as the Song's ink cost is within the Singer's numeric threshold. For example, a Singer 5 character can sing any Song costing 5 or less.

This creates a natural pair synergy: Singers want Songs to sing, and Songs benefit from Singers who can sing them without spending ink. Unlike playstyle rules (where density matters), Singer + Songs scores on **value efficiency** — how much ink the Singer saves by singing the Song for free.

### Bidirectional Matching

Both directions are matched:
- **Forward**: Selecting a Singer finds all Songs it can sing (cost ≤ Singer value)
- **Reverse**: Selecting a Song finds all Singers that can sing it (Singer value ≥ Song cost)

Both directions produce identical scores for the same pair.

### Example

Selecting **Powerline - World's Greatest Rock Star** (Singer 9) finds:
- **Be Our Guest** (cost 2) — score 5 (functional, 7 ink wasted)
- **Let It Go** (cost 5) — score 5 (functional, 4 ink wasted)
- **Grab Your Sword** (cost 7) — score 6 (good savings, 2 ink wasted)
- **A Whole New World** (cost 9) — score 8 (perfect fit, 0 ink wasted)

---

## Detection

### Singer Detection

Uses `hasKeyword(card, 'Singer')` — checks if the card's `keywords` array contains an entry starting with "Singer". The numeric threshold is extracted via `getKeywordValue(card, 'Singer')`, which parses the number after the keyword (e.g., "Singer 5" → 5).

**Fallback**: If `getKeywordValue` returns `null` (a Singer keyword without a number, which doesn't exist in the current card pool), the rule falls back to `card.cost` as the Singer value. This is a defensive default.

### Song Detection

Uses `isSong(card)` which checks:
1. `card.type === 'Action'` — must be an Action card
2. **AND** either `card.classifications?.includes('Song')` or `textContains(card, 'song')`

This catches Songs via their official classification and via text-based fallback for cards that reference the Song mechanic.

### Cost Gate

The core constraint: `song.cost <= singerValue`. A Singer 5 can sing Songs costing 1-5 but not 6+. This is enforced in both the forward and reverse paths.

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

### Why Not Higher Than 8?

Scores 9-10 are reserved for irreplaceable, game-defining synergies (like perfect Shift curves with free cost). Singer + Songs is powerful but fungible — any Singer 5 works equally well with any cost-5 Song. The synergy is about cost efficiency, not unique card interactions.

### Why Not Lower Than 5?

Even a Singer 9 singing a cost-1 Song saves 1 ink and gets a free card played. That's still a real synergy — just an inefficient one. Below 5 would imply the pairing is barely worth noting, which undersells the "free card" aspect.

### Explanation Template

```
{singer.fullName} (Singer {value}) can sing {song.fullName} (cost {songCost}) for free
```

Example: "Powerline - World's Greatest Rock Star (Singer 9) can sing Be Our Guest (cost 2) for free"

---

## Coverage

Based on the current Core format card pool:
- **16 Singers** (mostly Amber/Ruby)
- **72 Songs** (distributed across all inks)
- **872 valid pairs** (after cost gating)

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
| Cost gate filtering | Cheap song found, expensive song excluded |
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

## Design Decisions and Rationale

### Why Bidirectional?

Unlike Named Companions (forward-only, because only the referencing card benefits), Singer + Songs is bidirectional because both sides benefit equally: the Singer gets a free exert target, and the Song gets played without spending ink. When browsing Songs, you want to see which Singers can sing them — that's a genuine deck-building question.

### Why Score by Efficiency, Not by Card Power?

The rule scores on cost-gap efficiency rather than evaluating what the Song actually does. This is intentional: a Song's individual power is a card evaluation question, not a synergy question. The synergy is "can this Singer play this Song for free?" — and the answer's quality depends on how much ink is saved, not the Song's text.

### Why Is the Minimum Score 5?

Singer + Songs is a direct rule, not a playstyle rule. Every valid pair represents a concrete mechanical interaction (free play), not just thematic alignment. Even the worst-case pairing (Singer 9 + cost-1 Song) still means a free card — that's worth at least a Moderate score.
