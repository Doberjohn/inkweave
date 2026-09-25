# Self-Discard Synergy Rule ("Discard Matters" — player-side)

Detailed documentation for the Self-Discard rule, a playstyle synergy that detects the player-side discard-recursion archetype: discard your own cards, then cash them in.

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/cardHelpers.ts`
**Rule ID**: `self-discard`
**Category**: `playstyle`
**Playstyle ID**: `self-discard`

---

## Overview

Self-Discard is the **player-side mirror** of the opponent-facing Discard rule (Rule 4). Where that rule attacks the *opponent's* hand, this one fills your *own* discard on purpose and turns the pile into a resource. Five roles, in two groups.

Bin-fillers:

- **enabler** — a hand-discard outlet (loot, discard-your-hand, discard-as-cost) that fills your own discard.
- **mill** — fills the bin from the *deck* ("put the top N cards of your deck into your discard").

Payoffs:

- **reanimator** — plays or returns a card *from your discard* (the deep recursion payoff).
- **state-payoff** — rewards the discard *event* ("if you discarded a card this turn") or an empty hand (Hellbent).
- **zone-payoff** — rewards the discard as a countable *zone* ("while you have 10 or more cards in your discard", "a song card in your discard", "if 2 or more cards were put into your discard this turn").

The two filler roles are not interchangeable: a hand discard *is* a discard event, so it switches on every payoff; milling never triggers a "when you discard" payoff, so it feeds only the payoffs that read the pile itself. That distinction is what the score matrix encodes.

Like Sacrifice, it is an asymmetric-role playstyle: the fillers *create* the fuel that the payoffs *exploit*. A deck of all reanimators has an empty bin; a deck of all loot has nothing to bring back. The combo is the rule. This rule fills the "recursion role" that `makeSearchPattern` in `cardHelpers.ts` deliberately deferred ("from your discard ... Recursion deserves its own role; see Phase 3").

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

### zone-payoff (the discard as a countable zone)

```regex
in:  /\b(?:a|an|\d+\s+or\s+more|for\s+each)\s+(?:\w+\s+){0,3}?cards?\s+(?:named\s+\w+\s+)?in\s+your\s+discard\b/i
put: /cards?\s+were\s+put\s+into\s+your\s+discard\s+this\s+turn/i
```

The `in your discard` wording keeps this disjoint from the reanimator's `from your discard`: a zone payoff *reads* the pile, a reanimator *empties* it. The `put` pattern covers the trigger family that counts what arrived this turn regardless of how it got there.

| Shape | Example card text | Card |
|-------|-------------------|------|
| Discard count | "While you have **10 or more cards in your discard**, ..." | Pepita - Imelda's Right Hand, Land of the Dead - Marigold Bridge |
| Card-type check | "if there's **a song card in your discard**, ..." | Priya Mangal - Serious Music Lover, Miguel Rivera - Street Musician |
| For-each scaling | "**For each** Alien character **card in your discard**, ..." | Dr. Hamsterviel - Infamous Scientist, Coldstone - Reincarnated Cyborg |
| Put this turn | "If **2 or more cards were put into your discard this turn**, ..." | Helga Sinclair - No Backup Needed, Kida - Discovering the Unknown |

### mill (deck → discard)

```regex
/put\s+the\s+top\s+(?:card|\d+\s+cards)\s+of\s+your\s+deck\s+into\s+your\s+discard/i
```

Deliberately tight: it reads the top-of-deck phrasing only. "Put the rest into your discard" (a look-and-filter effect) and the ambiguous "put it into your discard" stay out, because neither reliably fills the bin.

| Example card text | Card |
|-------------------|------|
| "**put the top 4 cards of your deck into your discard**." | Quackerjack - Loony Toymaker |
| "**put the top card of your deck into your discard**." | Hector Rivera - Street Musician, Jack-Jack Parr - Incredible Potential |

### What's Excluded

| Excluded | Pattern / reason |
|----------|------------------|
| **Opponent discard** | Anything matching `opponent` / `each player` is the Discard rule's domain (attacking *their* hand). The gate keeps the two axes disjoint, exactly the boundary the Discard rule's doc calls out ("self-discard ... belongs to a separate axis"). |
| **Songs as bin-fillers** | A sung song lands in the discard, so in principle every Song feeds a zone payoff. It is not modelled: that would make all 66 Songs bin-fillers and drown the axis in near-baseline pairs, and the Song half of the interaction already has a home in the Singer + Songs rule. |
| **Mill as a hand-discard enabler** | Mill *is* tagged (role `mill`) but is never an `enabler`: it fills the bin from the deck, so it cannot switch on a payoff that needs an actual hand discard. `mill ↔ state-payoff` therefore stays at the 5 baseline, while `enabler ↔ state-payoff` scores 8. |

---

## Card examples by role

Real cards the `getSelfDiscardRoles` detector tags for each role (names from the live database; effects paraphrased):

| Role | Real cards | What they do |
|------|-----------|--------------|
| **enabler** | Maleficent - Vexed Partygoer (Amethyst), Doc - Bold Knight (Steel), Calhoun - Battle-Tested (Amber) | Discard your own cards from hand: loot, discard-your-hand, or discard-as-cost |
| **reanimator** | Wreck-It Ralph - Admiral Underpants (Amber), Merlin's Carpetbag (Sapphire), Stitch - Alien Buccaneer (Emerald) | Play or return a card *from your discard*: the deep recursion payoff |
| **state-payoff** | Jasmine - Inspired Researcher (Sapphire-Steel), Desperate Plan (Steel), Beast's Mirror (Steel) | Rewards the discard event ("discarded a card this turn") or an empty hand (Hellbent) |
| **zone-payoff** | Priya Mangal - Serious Music Lover (Amber), Pain - Running with Scissors (Amethyst), Helga Sinclair - No Backup Needed (Emerald) | Reads the pile itself: a count, a card type sitting there, or what was put there this turn |
| **mill** | Quackerjack - Loony Toymaker (Sapphire), Preston Whitmore - Expedition Financier (Ruby), Remote Inklands - Desert Ruins (Ruby) | Puts cards from the top of your deck into your discard |

---

## Scoring (8/7/6/5 matrix)

Applies the project-wide **5-baseline convention** and mirrors the Sacrifice shape (asymmetric combo at peak, same-axis density at floor), with a `7` for a bin-filler feeding the payoff it fuels and a `6` for the recursion-density case.

### Score Table

| Pair Type | Score | Display Tier | Explanation |
|-----------|-------|-------------|-------------|
| enabler ↔ payoff (reanimator or state) | **8** | Strong | Win-condition combo: discard a card, then replay it from the bin (reanimator) or flip the "discarded this turn" / empty-hand payoff (state) on demand |
| enabler ↔ zone-payoff | **7** | Strong | Mechanical compounding: every hand discard raises the count the payoff reads |
| mill ↔ zone-payoff | **7** | Strong | The deck-side filler stocks the pile the payoff counts, several cards at a time |
| mill ↔ reanimator | **7** | Strong | Mill buries targets the recursion engine then replays |
| reanimator ↔ reanimator | **6** | Moderate | Two recursion engines mining the same discard pile, complementary but not a single combo |
| enabler ↔ enabler / mill ↔ state-payoff / reanimator ↔ state / state ↔ state | **5** | Weak/Moderate | Same-axis density: parallel fillers, or two payoffs that don't amplify each other |

A fill combo sits at 7 rather than 8 because it is compounding, not a closed loop: the filler makes the payoff bigger, but the payoff does not cash the specific card that was filled. That is the difference between "discard Mother Gothel, replay Mother Gothel" (8) and "mill 4, your count-payoff gets bigger" (7).

### Live distribution

Generated from the live engine over the current Core pool (sets 9-13 plus the Set 14 preview): **113 tagged cards** (38 enabler, 49 reanimator, 6 state-payoff, 21 zone-payoff, 6 mill; roles overlap on multi-role cards such as Lyle Tiberius Rourke, who mills *and* reanimates). After the engine's ink-compatibility filter (`canShareDeck`), **5,969 unique pairs**:

| Pair shape | Count | Score | Share |
|------------|-------|-------|-------|
| enabler ↔ payoff (reanimator or state) | 1,995 | 8 | 33.4% |
| enabler ↔ zone-payoff | 704 | 7 | 11.8% |
| mill ↔ reanimator | 267 | 7 | 4.5% |
| mill ↔ zone-payoff | 125 | 7 | 2.1% |
| reanimator ↔ reanimator | 973 | 6 | 16.3% |
| other same-axis | 1,905 | 5 | 31.9% |

The score-8 share runs high, like Sacrifice's, and for the same structural reason: recursion is one of the deepest payoff pools in the game (49 reanimators), so a handful of enablers pair against a large payoff side. The combo *is* the archetype.

Note on ordering: the 7 guard runs before the 6, so a card that both mills and reanimates (Lyle Tiberius Rourke) scores 7 against another reanimator rather than 6. That is deliberate: he does not merely share the bin with it, he fills the bin for it.

### Token-swapped explanation

The combo string uses the project `{A}`/`{B}` convention so the **enabler** always reads as the actor, regardless of which card the user selected:

```typescript
const enablerToken = cardEnabler ? '{A}' : '{B}';
const payoffToken = cardEnabler ? '{B}' : '{A}';
// reanimator payoff: `${enablerToken} discards your own cards so ${payoffToken} can replay them from the discard.`
// state payoff:      `${enablerToken}'s self-discard switches on ${payoffToken}'s discard payoff.`
```

The fill combos follow the same convention, with the **filler** as the actor:

- enabler ↔ zone-payoff: `"{A} fills your discard from hand, switching on {B}'s discard-count payoff."`
- mill ↔ zone-payoff: `"{A} mills your deck into the discard, feeding {B}'s discard-count payoff."`
- mill ↔ reanimator: `"{A} mills cards into your discard for {B} to replay."`

Same-axis pairs use distinct sentences:

- enabler ↔ enabler: `"Both fill your own discard: parallel self-discard outlets."`
- reanimator ↔ reanimator: `"Both replay cards from your discard: two recursion engines sharing one bin."`
- other: `"Same discard-matters axis without compounding."`

---

## Coverage

- **38 enablers** (loot / discard-hand / discard-cost), every ink.
- **49 reanimators** ("from your discard"), the deepest side.
- **21 zone-payoffs** (count / card-type / put-this-turn), added in the Set 14 pass.
- **6 state-payoffs** (discarded-this-turn + Hellbent), the thinnest side.
- **6 mill cards**, the deck-side filler.

```chart
{
  "type": "doughnut",
  "title": "Role Composition (113 cards; multi-role overlap)",
  "data": {
    "labels": ["Reanimator (49)", "Enabler (38)", "Zone-payoff (21)", "State-payoff (6)", "Mill (6)"],
    "values": [49, 38, 21, 6, 6]
  }
}
```

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Self-Discard rule (Discard Matters)')`.

### Role Detection (10 tests)

| Test | What it verifies |
|------|------------------|
| enabler from loot | "draw a card, then choose and discard a card" (Kronk) |
| enabler from discard-your-hand | "Discard your hand" (You Broke My Smolder) |
| reanimator | "play ... from your discard" (Mother Gothel) |
| state-payoff from discarded-this-turn | "discarded a card this turn" (Maximus) |
| state-payoff from Hellbent | "no cards in your hand" (Megavolt) |
| zone-payoff | a count, a card type in the pile, and "put into your discard this turn" all tag `['zone-payoff']` |
| mill | "put the top N cards of your deck into your discard" → `['mill']`, and mill + recursion on one card → `['reanimator','mill']` |
| multi-role | loot + reanimate on one card (Rapunzel & Flynn) → `['enabler','reanimator']` |
| excludes opponent discard | "each opponent ... discards" → no role |
| no roles for unrelated / text-less cards | empty arrays |

### Scoring (5 tests)

| Test | What it verifies |
|------|------------------|
| enabler ↔ reanimator → 8 | win-condition combo, enabler-as-actor explanation |
| enabler ↔ state-payoff → 8 | loot flips the discard-state payoff |
| enabler ↔ enabler → 5 | parallel outlets |
| fill combos → 7 | all three shapes, with the filler as the actor and the token-swap when the payoff is the searcher |
| mill ↔ state-payoff → 5 | milling is not a discard event, so it stays at the baseline |

---

## Design Decisions and Rationale

### Why a new rule, not a role on Discard?

The Discard rule is opponent-facing (make *them* discard, reward *your* hand-size advantage). Self-Discard is the opposite direction (discard *your own*, empty *your* hand). A card that is a payoff in one is an anti-payoff in the other (Hellbent wants an empty hand; Discard's payoff wants a full one). Folding them together would blur two opposite archetypes, so this is a separate playstyle that mirrors Sacrifice.

### Why mill is a bin-filler, not an enabler

Mill fills the bin from the deck, not the hand. It feeds anything that *reads* or *pulls from* the pile (zone payoffs, reanimators), but it does **not** trigger "when you discard" payoffs (Mother Gothel, Maximus), which need an actual hand discard. So it carries its own role rather than joining `enabler`: it scores 7 against zone payoffs and reanimators, and stays at the 5 baseline against state payoffs.

It was excluded outright until the Set 14 pass, on the grounds that the pool was thin and mill had no payoff to point at. The zone-payoff role is that payoff: once the engine could see "10 or more cards in your discard", a mechanic whose entire job is raising that number could no longer be a non-participant.

### Why reanimator ↔ reanimator sits at 6, not 5

Two recursion engines genuinely complement each other, they mine the same bin and give it two ways to convert to board, which is more than parallel density but less than a single enabler→payoff combo. It is the one same-axis case that earns a bump above the 5 baseline.
