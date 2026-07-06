# Self-Discard Synergy Rule ("Discard Matters" — player-side)

Detailed documentation for the Self-Discard rule, a playstyle synergy that detects the player-side discard-recursion archetype: discard your own cards, then cash them in.

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/cardHelpers.ts`
**Rule ID**: `self-discard`
**Category**: `playstyle`
**Playstyle ID**: `self-discard`

---

## Overview

Self-Discard is the **player-side mirror** of the opponent-facing Discard rule (Rule 4). Where that rule attacks the *opponent's* hand, this one discards your *own* cards on purpose and turns the discard pile into a resource. Three roles:

- **enabler** — a hand-discard outlet (loot, discard-your-hand, discard-as-cost) that fills your own discard.
- **reanimator** — plays or returns a card *from your discard* (the deep recursion payoff).
- **state-payoff** — rewards the discard *event* ("if you discarded a card this turn") or an empty hand (Hellbent).

Like Sacrifice, it is an asymmetric-role playstyle: the enabler *creates* the fuel that the payoffs *exploit*. A deck of all reanimators has an empty bin; a deck of all loot has nothing to bring back. The combo is the rule. This rule fills the "recursion role" that `makeSearchPattern` in `cardHelpers.ts` deliberately deferred ("from your discard ... Recursion deserves its own role; see Phase 3").

### Example

**Enabler (loot)**: Scrooge McDuck - S.H.U.S.H. Agent (Emerald): "When you play this character, draw a card, then choose and discard a card."
**Reanimator**: Mother Gothel - Evil as Ever (Emerald): "When you discard this card, you may play this character from your discard."

Loot Mother Gothel into the discard → she replays herself for free. The loot digs for what you need *and* stocks the bin; the reanimator cashes it. Same-ink Emerald.

---

## Role Detection

### Architecture

```typescript
getSelfDiscardRoles(card: LorcanaCard): SelfDiscardRole[]  // any subset of ['enabler','reanimator','state-payoff']
```

A card can be multi-role: `Rapunzel & Flynn Rider - Unlikely Pair` loots (enabler) *and* replays discarded characters (reanimator). Detection uses a fast pre-filter (`HAS_SELF_DISCARD_KEYWORD = /discard|no cards in/i`) before the patterns.

### enabler (self-discard outlet from hand)

Three sub-patterns, all gated against opponent-facing discard:

```regex
loot: /draw\s+(?:a|an|\d+)\s+cards?,?\s+then\s+(?:choose and\s+)?discard/i
hand: /discard\s+your\s+hand/i
cost: /(?:you may\s+)?discard\s+(?:a|an|another|\d+)\s+(?:\w+\s+){0,2}?cards?\b/i
gate: !(/opponent|each player|challenging player|that player/i)
```

| Shape | Example card text | Card |
|-------|-------------------|------|
| Loot | "draw a card, **then choose and discard a card**." | Kronk - Meat Hut Cook |
| Discard hand | "**Discard your hand.** Draw 2 cards." | You Broke My Smolder |
| Discard as cost | "**discard a card** to ..." | (discount / cost outlets) |

The discard-as-cost pattern is intentionally kept tight (`{0,2}` words between "discard a" and "card"), so it catches generic "discard a card" costs without over-tagging narrow conditional costs. The only rotation card it leaves half-tagged is The Queen - Conceited Ruler (a "discard a Princess or Queen character card" cost); widening it to `{0,4}` would promote exactly one card to `enabler` and bump 49 pairs (measured), so it stays tight.

### reanimator (recursion payoff)

```regex
/(?:play|return|put)\b[^.]{0,60}\bfrom your discard\b/i
```

Matches playing, returning, or putting a card **from your discard**:

| Example card text | Card |
|-------------------|------|
| "you may **play this character from your discard**." | Mother Gothel - Evil as Ever |
| "**return a character card from your discard** to your hand." | The Queen - Conceited Ruler, Taran - Pig Keeper |
| "you may **play that character from your discard**." | Rapunzel & Flynn Rider |

The `[^.]{0,60}` window keeps the verb and "from your discard" inside one clause, so a card can't match by having "play" in one sentence and "from your discard" in an unrelated one.

### state-payoff (discard event / empty hand)

```regex
/discarded\s+a\s+card\s+this\s+turn|no cards in (?:your )?hand/i
```

| Shape | Example card text | Card |
|-------|-------------------|------|
| Discarded this turn | "**If you discarded a card this turn**, ..." | Maximus - Relentless Stallion, Discarded Armor |
| Hellbent | "**While you have no cards in your hand**, ..." | Megavolt - Electrical Menace, Gizmoduck |

### What's Excluded

| Excluded | Pattern / reason |
|----------|------------------|
| **Opponent discard** | Anything matching `opponent` / `each player` is the Discard rule's domain (attacking *their* hand). The gate keeps the two axes disjoint, exactly the boundary the Discard rule's doc calls out ("self-discard ... belongs to a separate axis"). |
| **Mill (deck → discard)** | "put the top N of your deck **into** your discard" fills the bin from the *deck*, not the hand, and never triggers a "when you discard" payoff. It matches neither `enabler` (no hand-discard) nor `reanimator` (the pattern requires "**from** your discard", not "into"). Mill is a distinct, currently-thin mechanic (3 cards in the 9-13 rotation). |

---

## Card examples by role

Real cards the `getSelfDiscardRoles` detector tags for each role (names from the live database; effects paraphrased):

| Role | Real cards | What they do |
|------|-----------|--------------|
| **enabler** | Maleficent - Vexed Partygoer (Amethyst), Doc - Bold Knight (Steel), Calhoun - Battle-Tested (Amber) | Discard your own cards from hand: loot, discard-your-hand, or discard-as-cost |
| **reanimator** | Wreck-It Ralph - Admiral Underpants (Amber), Merlin's Carpetbag (Sapphire), Stitch - Alien Buccaneer (Emerald) | Play or return a card *from your discard*: the deep recursion payoff |
| **state-payoff** | Jasmine - Inspired Researcher (Sapphire-Steel), Desperate Plan (Steel), Beast's Mirror (Steel) | Rewards the discard event ("discarded a card this turn") or an empty hand (Hellbent) |

---

## Scoring (8/6/5 matrix)

Applies the project-wide **5-baseline convention** and mirrors the Sacrifice shape (asymmetric combo at peak, same-axis density at floor), with a `6` for the recursion-density case.

### Score Table

| Pair Type | Score | Display Tier | Explanation |
|-----------|-------|-------------|-------------|
| enabler ↔ payoff (reanimator or state) | **8** | Strong | Win-condition combo: discard a card, then replay it from the bin (reanimator) or flip the "discarded this turn" / empty-hand payoff (state) on demand |
| reanimator ↔ reanimator | **6** | Moderate | Two recursion engines mining the same discard pile, complementary but not a single combo |
| enabler ↔ enabler / reanimator ↔ state / state ↔ state | **5** | Weak/Moderate | Same-axis density: parallel outlets, or two payoffs that don't amplify each other |

### Live distribution

142 tagged cards (59 enabler, 78 reanimator, 8 state-payoff; roles overlap on multi-role cards). After the engine's ink-compatibility filter (`canShareDeck`), **7,613 unique pairs**:

| Pair shape | Count | Score | Share |
|------------|-------|-------|-------|
| enabler ↔ payoff | 4,213 | 8 | 55.3% |
| reanimator ↔ reanimator | 2,031 | 6 | 26.7% |
| other same-axis | 1,369 | 5 | 18.0% |

The score-8 share (~55%) runs high, like Sacrifice's, and for the same structural reason: recursion is one of the deepest payoff pools in the game (78 reanimators), so a handful of enablers pair against a large payoff side. The combo *is* the archetype.

### Token-swapped explanation

The combo string uses the project `{A}`/`{B}` convention so the **enabler** always reads as the actor, regardless of which card the user selected:

```typescript
const enablerToken = cardEnabler ? '{A}' : '{B}';
const payoffToken = cardEnabler ? '{B}' : '{A}';
// reanimator payoff: `${enablerToken} discards your own cards so ${payoffToken} can replay them from the discard.`
// state payoff:      `${enablerToken}'s self-discard switches on ${payoffToken}'s discard payoff.`
```

Same-axis pairs use distinct sentences:

- enabler ↔ enabler: `"Both fill your own discard: parallel self-discard outlets."`
- reanimator ↔ reanimator: `"Both replay cards from your discard: two recursion engines sharing one bin."`
- other: `"Same discard-matters axis, no compounding."`

---

## Coverage

- **59 enablers** (loot / discard-hand / discard-cost), every ink.
- **78 reanimators** ("from your discard"), the deepest side, peaks in Set 12.
- **8 state-payoffs** (discarded-this-turn + Hellbent), thin and mostly Set 13.

```chart
{
  "type": "doughnut",
  "title": "Role Composition (142 cards; multi-role overlap)",
  "data": {
    "labels": ["Reanimator (78)", "Enabler (59)", "State-payoff (8)"],
    "values": [78, 59, 8]
  }
}
```

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Self-Discard rule (Discard Matters)')`.

### Role Detection (9 tests)

| Test | What it verifies |
|------|------------------|
| enabler from loot | "draw a card, then choose and discard a card" (Kronk) |
| enabler from discard-your-hand | "Discard your hand" (You Broke My Smolder) |
| reanimator | "play ... from your discard" (Mother Gothel) |
| state-payoff from discarded-this-turn | "discarded a card this turn" (Maximus) |
| state-payoff from Hellbent | "no cards in your hand" (Megavolt) |
| multi-role | loot + reanimate on one card (Rapunzel & Flynn) → `['enabler','reanimator']` |
| excludes opponent discard | "each opponent ... discards" → no role |
| excludes mill | "into your discard" (Quackerjack) → no role |
| no roles for unrelated / text-less cards | empty arrays |

### Scoring (3 tests)

| Test | What it verifies |
|------|------------------|
| enabler ↔ reanimator → 8 | win-condition combo, enabler-as-actor explanation |
| enabler ↔ state-payoff → 8 | loot flips the discard-state payoff |
| enabler ↔ enabler → 5 | parallel outlets |

---

## Design Decisions and Rationale

### Why a new rule, not a role on Discard?

The Discard rule is opponent-facing (make *them* discard, reward *your* hand-size advantage). Self-Discard is the opposite direction (discard *your own*, empty *your* hand). A card that is a payoff in one is an anti-payoff in the other (Hellbent wants an empty hand; Discard's payoff wants a full one). Folding them together would blur two opposite archetypes, so this is a separate playstyle that mirrors Sacrifice.

### Why mill is excluded

Mill fills the bin from the deck, not the hand. It feeds reanimators that *pull* from the discard, but it does **not** trigger "when you discard" payoffs (Mother Gothel, Maximus) which need an actual hand-discard. With only 3 mill cards in the current rotation, lumping it in would add almost nothing while blurring the rule's identity. Mill can earn its own axis if it ever grows.

### Why reanimator ↔ reanimator sits at 6, not 5

Two recursion engines genuinely complement each other, they mine the same bin and give it two ways to convert to board, which is more than parallel density but less than a single enabler→payoff combo. It is the one same-axis case that earns a bump above the 5 baseline.
