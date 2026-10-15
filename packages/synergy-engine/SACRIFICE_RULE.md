# Sacrifice Synergy Rule ("Banish Matters")

Detailed documentation for the Sacrifice rule, a playstyle synergy that detects the aristocrats / "Banish Matters" archetype.

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/cardHelpers.ts`
**Rule ID**: `sacrifice`
**Category**: `playstyle`
**Playstyle ID**: `sacrifice`
**Issue**: [#365](https://github.com/Doberjohn/inkweave/issues/365)

---

## Overview

The Sacrifice archetype is a two-role strategy: **self-banish cards** banish your *own* characters on demand, while **banish-triggers** reward you when one of your characters is banished. The self-banish card lets you cash in a banish-trigger on your terms instead of waiting for the opponent to trade into it.

Like Discard, this is an asymmetric-role playstyle: the self-banish cards *create* the banish that the banish-triggers *exploit*. A deck of all payoffs sits idle waiting for the opponent; a deck of all self-banish cards has nothing to pay off. The combo is the rule.

### Example

**Self-banish**: Hades - Strong Arm: "⟳, 3 ⬡, Banish one of your characters: Banish chosen character."
**Banish-trigger**: Diablo - Obedient Raven: "When this character is banished, you may draw a card."

Hades banishes Diablo on demand → Diablo's trigger fires → draw a card, plus Hades removes an opposing body. The banish-trigger becomes a guaranteed engine instead of a "maybe the opponent trades into it" payoff.

---

## Role Detection

### Architecture

```typescript
getSacrificeRoles(card: LorcanaCard): SacrificeRole[]  // ['self-banish'] | ['banish-trigger'] | [...both] | []
```

A card could in principle hold both roles; Coverage counts any that do. Detection uses a fast pre-filter (`HAS_BANISH_KEYWORD = /banish/i`) before running the patterns.

### banish-trigger (payoff)

```regex
/when(?:ever)?\s+(?:this character|(?:one of\s+)?your(?:\s+other)?(?:\s+\w+)?\s+characters?|a\s+character\s+of\s+yours)\s+(?:is|are|gets?)\s+banished/i
```

Matches a **general (any-cause)** banish trigger on your own side or on this character itself:

| Shape | Example card text |
|-------|-------------------|
| Self | "**When this character is banished**, you may draw a card." (Diablo) |
| Your side | "**Whenever one of your characters is banished**, draw a card." (David Xanatos) |
| Your other side | "Whenever **one of your other characters is banished**, gain 1 lore." (Vinnie) |
| Tribal your side | "Whenever **one of your other Racer characters is banished**, each opponent loses 1 lore." (King Candy - Royal Racer) |

The optional `\w+` slot is load-bearing: it lets tribal triggers (Racer / Illusion / Puppy) count, because a self-banish can banish a Racer just as well as a generic character, so the trigger genuinely fires.

A trigger limited to an opponent's turn ("**During an opponent's turn, when this character is banished**, gain 1 lore.", Rex - Protective Dinosaur) keeps the role but never makes the combo: see [Why an opponent's-turn trigger isn't a combo](#why-an-opponents-turn-trigger-isnt-a-combo).

### self-banish (enabler)

```regex
/banish\s+(?:one of\s+)?(?:your(?:\s+other)?\s+characters?|(?:another\s+)?chosen\s+character\s+of\s+yours)/i
```

Matches banishing one of **your own** characters on demand:

| Example card text | Card |
|-------------------|------|
| "Banish **one of your characters**: Banish chosen character." | Hades - Strong Arm |
| "Banish **chosen character of yours** to draw 2 cards." | Time to Go! |
| "you may banish **another chosen character of yours**." | Sid Phillips - Toy Surgeon |

### What's Excluded

| Excluded | Pattern / reason |
|----------|------------------|
| **Opponent removal** | `banish chosen character` with no "of yours" / "your" gate targets the *opponent* (Energy Blast, Dragon Fire). That is pure removal, a future control axis, not sacrifice. The `of yours` gate is the whole distinction. |
| **"Banished in a challenge" recursion** | `/banished in a challenge/` ("return this card to your hand") is combat-only. A self-banish banishes *outside* combat, so it can never trigger these. Including them would promise a banish combo the cards cannot perform. These belong to the Challenge Matters axis ([#371](https://github.com/Doberjohn/inkweave/issues/371)). |
| **Item / location banish triggers** | "when this item is banished" / "whenever an item is banished" are not character sacrifice. Excluded naturally: the banish-trigger pattern requires `this character` / `your ... characters` / `a character of yours`. |
| **Opponent-side banish triggers** | "whenever an opposing character is banished" rewards the opponent's characters dying (a removal payoff, not your sacrifice). Excluded naturally for the same reason. |

This `banish-trigger` role is a strict **superset** of the Toy rule's tribal-gated `banish-trigger`. Cards in both (Coverage names them) are the normal cross-playstyle composition the engine already does (Toy composes burn/steal/ramp from other playstyles).

---

## Card examples by role

Real cards the `getSacrificeRoles` detector tags for each role (names from the live database; effects paraphrased):

| Role | Real cards | What they do |
|------|-----------|--------------|
| **self-banish** (enabler) | Hades - Strong Arm (Ruby), Retro Evolution Device (Emerald), Glimmer vs Glimmer (Ruby) | Banish one of *your own* characters on demand |
| **banish-trigger** (payoff) | Bruni - Fire Salamander (Amethyst), Emerald Chromicon (Emerald), Tadashi Hamada - Gifted Roboticist (Sapphire) | Fire a bonus when one of your characters is banished, any cause |

---

## Scoring (5/8 matrix)

Applies the project-wide **5-baseline convention** and mirrors the Discard rule's shape exactly (asymmetric banish combo at peak, same-side density at floor).

### Score Table

| Pair Type | Score | Display Tier | Explanation |
|-----------|-------|-------------|-------------|
| self-banish ↔ banish-trigger | **8** | Strong | Win-condition combo: the self-banish card banishes your own payoff body on demand, converting a banish-trigger into a guaranteed, on-your-terms value engine |
| self-banish ↔ a banish-trigger that fires only on an opponent's turn | **5** | Weak | No combo: a self-banish card acts on your own turn, so it never sets the trigger off. The two just share the deck |
| banish-trigger ↔ banish-trigger | **5** | Weak | Parallel payoff density: a board of value-on-banish bodies that each trade independently, no compounding |
| self-banish ↔ self-banish | **5** | Weak | Parallel enablers: two self-banish cards don't compound, you still need a payoff body to banish |

### Live distribution

<!-- coverage:start distribution -->
Counted by `pnpm refresh-rule-coverage` over the Core cards in the synergy pool (sets 9-14).

**389 unique pairs** after the engine's ink-compatibility filter (`canShareDeck`):

| Pair shape | Pairs | Score | Share |
|----------|-----|-----|-----|
| self-banish ↔ banish-trigger | 123 | 8 | 31.6% |
| banish-trigger ↔ banish-trigger | 217 | 5 | 55.8% |
| self-banish ↔ self-banish | 21 | 5 | 5.4% |
| self-banish ↔ an opponent's-turn banish-trigger | 28 | 5 | 7.2% |

Score-8 share next to Discard and Toy: Sacrifice 31.6%, Discard 0.0%, Toy 13.3%.
<!-- coverage:end -->

The score-8 share runs high next to Discard's and Toy's. That is structural, not a defect: with a handful of enablers each pairing against many payoffs, the combo *is* the archetype's identity.

### Token-swapped explanation

The banish-combo string uses the project `{A}`/`{B}` token convention so the **self-banish card** always reads as the actor, regardless of which card the user selected:

```typescript
const selfBanishToken = cardSelfBanish ? '{A}' : '{B}';
const payoffToken = cardSelfBanish ? '{B}' : '{A}';
// `${selfBanishToken} banishes your own character on demand, guaranteeing ${payoffToken}'s banish payoff.`
```

Pairs that aren't a combo score 5 and name both cards. Two banish-triggers read by what each one's trigger watches (`triggersOnAnyBanish`): any of your characters being banished, or only the card itself:

- banish ↔ banish, both watching any of your characters: `"{A} and {B} both benefit when your characters are banished."`
- banish ↔ banish, one of each (David Xanatos - Charismatic Leader with Kuzco - Wanted Llama): `"{A} benefits when your characters are banished, and {B} when it is."`
- banish ↔ banish, both watching only themselves: `"{A} and {B} both benefit from being banished."`
- self-banish ↔ self-banish: `"{A} and {B} both banish your own characters."`
- self-banish ↔ a banish-trigger that fires only on an opponent's turn: `"{A} and {B} both go in a Sacrifice deck."`

---

## Coverage

<!-- coverage:start coverage -->
- **7 self-banish cards** (Ruby 4, Emerald 3): If She Doesn't Scare You, Lonely Grave, Retro Evolution Device, Sid Phillips - Toy Surgeon, The Claw, Time to Go!, Vine Pod
- **22 banish-triggers** (Ruby 7, Sapphire 5, Amethyst 3, Emerald 3, Steel 3, Amber 2)

Cards with a role: 29. Cards with more than one: 0.

Banish-triggers the Toy rule tags too: 4 (Alien - True Believer, Jingle Joe - Sid's Toy, Pterodactyl Janie Doll - Sid's Toy, Rex - Protective Dinosaur).

```chart
{
  "type": "doughnut",
  "title": "Role composition (29 cards)",
  "data": {
    "labels": ["Self-banish cards (7)", "Banish-triggers (22)"],
    "values": [7, 22]
  }
}
```
<!-- coverage:end -->

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Sacrifice rule (Banish Matters)')`, plus `src/__tests__/sacrifice.test.ts` for triggers limited to an opponent's turn.

### Role Detection (8 tests)

| Test | What it verifies |
|------|------------------|
| self-banish from "Banish one of your characters" | Hades - Strong Arm |
| self-banish from "Banish chosen character of yours" | Time to Go! |
| banish-trigger from self-banish | "when this character is banished" (Diablo) |
| banish-trigger from your-side trigger | "whenever one of your characters is banished" (David Xanatos) |
| banish-trigger from tribal trigger | "your other Racer characters is banished" (King Candy) |
| excludes "banished in a challenge" recursion | Iago → no role (defers to #371) |
| excludes opponent removal | "banish chosen character" without "of yours" (Energy Blast) |
| no roles for unrelated / text-less cards | empty arrays |

### Scoring (4 tests)

| Test | What it verifies |
|------|------------------|
| self-banish ↔ banish-trigger → 8 | banish combo, self-banish-as-actor explanation |
| token swap when payoff is the searcher | self-banish card still reads as actor from the reverse direction |
| banish-trigger ↔ banish-trigger → 5 | parallel payoff density |
| self-banish ↔ self-banish → 5 | parallel enablers |

### Opponent's-turn triggers (4 tests, `sacrifice.test.ts`)

Real text of Time to Go!, David Xanatos - Charismatic Leader, Rex - Protective Dinosaur and Donald Duck - Fred Honeywell.

| Test | What it verifies |
|------|------------------|
| reads the turn each trigger can fire on | `banishTriggerFiresOnYourTurn`: David Xanatos yes, Rex and Donald Duck no |
| keeps them as banish-triggers | Rex and Donald Duck stay in the rule |
| keeps the combo for a your-turn trigger | Time to Go! ↔ David Xanatos → 8 |
| a self-banish card with them → 5 | Time to Go! ↔ Rex or Donald Duck → 5 from either side, the same-deck line |

---

## Design Decisions and Rationale

### Why general banish, not "in a challenge"?

The whole value of the rule is the 8-score combo. A "banished *in a challenge*" trigger only fires in combat, so a self-banish card (which banishes outside combat) could never trigger it. Scoring those pairs 8 would be a correctness bug, promising a combo the cards cannot perform. Excluding them also cleanly resolves the boundary that the Challenge Matters candidate ([#371](https://github.com/Doberjohn/inkweave/issues/371)) flagged for the reviewer to set, with zero double-classification.

### Why the "of yours" gate matters

`banish chosen character` (opponent removal) and `banish chosen character of yours` (a self-banish card) differ by two words but are opposite mechanics. The gate keeps removal out of this axis and is the same boundary the Damage Matters candidate ([#368](https://github.com/Doberjohn/inkweave/issues/368)) leans on to separate "damage the opponent" from "sacrifice your own."

### Why an opponent's-turn trigger isn't a combo

You play actions and use ⟳ abilities only on your own turn, and every self-banish card banishes through one of those or an on-play effect: Time to Go! and If She Doesn't Scare You are actions, The Claw, Lonely Grave, Retro Evolution Device and Vine Pod are ⟳ abilities, and Sid Phillips - Toy Surgeon banishes when you play him. A trigger that reads "During an opponent's turn" (Rex - Protective Dinosaur, Scar - Created by the Vine, The Vine - Towering Stalk) or "During opponents' turns" (Donald Duck - Fred Honeywell) can't fire then, so the 8 would promise a combo the cards can't perform.

`banishTriggerFiresOnYourTurn` counts a card's banish triggers against the ones limited to an opponent's turn, so a card with any trigger that can fire on your turn still makes the combo. The others keep the banish-trigger role: they still pay off when the opponent banishes your characters, the same density the other payoffs share.

### Why same-side pairs sit at 5

Two banish-triggers don't compound: each body trades independently, and a second one doesn't multiply the first. Two self-banish cards are parallel enablers that still need a payoff to do anything. Both are deck-share density baseline under the 5-convention, not specific mechanical wins.
