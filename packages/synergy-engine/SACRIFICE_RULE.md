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

A card could in principle be both roles; none currently are (the two roles live on different cards). Detection uses a fast pre-filter (`HAS_BANISH_KEYWORD = /banish/i`) before running the patterns.

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

This `banish-trigger` role is a strict **superset** of the Toy rule's tribal-gated `banish-trigger`. A few Sid's Toys (Babyhead, Jingle Joe, Pterodactyl Janie Doll) appear in both, which is the normal cross-playstyle composition the engine already does (Toy composes burn/steal/ramp from other playstyles).

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
| banish-trigger ↔ banish-trigger | **5** | Weak | Parallel payoff density: a board of value-on-banish bodies that each trade independently, no compounding |
| self-banish ↔ self-banish | **5** | Weak | Parallel enablers: two self-banish cards don't compound, you still need a payoff body to banish |

### Live distribution (Set 12)

7 self-banish cards + 40 banish-triggers = 47 cards. After the engine's ink-compatibility filter (`canShareDeck`), **846 unique pairs**:

| Pair shape | Count | Score | Share |
|------------|-------|-------|-------|
| self-banish ↔ banish-trigger | 243 | 8 | 28.7% |
| same-side (banish ↔ banish, self-banish ↔ self-banish) | 603 | 5 | 71.3% |

The score-8 share (~29%) runs higher than Discard's ~10% or Toy's ~16%. That is structural, not a defect: with only 7 enablers each pairing against 40 payoffs, the combo *is* the archetype's identity. (Raw, pre-ink-filter the split is 280 / 801.)

### Token-swapped explanation

The banish-combo string uses the project `{A}`/`{B}` token convention so the **self-banish card** always reads as the actor, regardless of which card the user selected:

```typescript
const selfBanishToken = cardSelfBanish ? '{A}' : '{B}';
const payoffToken = cardSelfBanish ? '{B}' : '{A}';
// `${selfBanishToken} banishes your own character on demand, guaranteeing ${payoffToken}'s banish payoff.`
```

Same-side pairs use distinct sentences:

- banish ↔ banish: `"Both pay off when your characters are banished: a board that trades into value."`
- self-banish ↔ self-banish: `"Both banish your own characters: parallel self-banish cards."`

---

## Coverage

- **7 self-banish cards** (Ruby 5, Emerald 2): Hades - Strong Arm, Glimmer vs Glimmer, Time to Go!, Retro Evolution Device, Lonely Grave, The Claw, Sid Phillips - Toy Surgeon
- **40 banish-triggers** spanning all 6 inks: Amethyst 10, Amber 10, Ruby 10, Steel 7, Emerald 6, Sapphire 5

```chart
{
  "type": "doughnut",
  "title": "Role Composition (47 cards)",
  "data": {
    "labels": ["Banish-triggers (40)", "Self-banish cards (7)"],
    "values": [40, 7]
  }
}
```

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Sacrifice rule (Banish Matters)')`.

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

---

## Design Decisions and Rationale

### Why general banish, not "in a challenge"?

The whole value of the rule is the 8-score combo. A "banished *in a challenge*" trigger only fires in combat, so a self-banish card (which banishes outside combat) could never trigger it. Scoring those pairs 8 would be a correctness bug, promising a combo the cards cannot perform. Excluding them also cleanly resolves the boundary that the Challenge Matters candidate ([#371](https://github.com/Doberjohn/inkweave/issues/371)) flagged for the reviewer to set, with zero double-classification.

### Why the "of yours" gate matters

`banish chosen character` (opponent removal) and `banish chosen character of yours` (a self-banish card) differ by two words but are opposite mechanics. The gate keeps removal out of this axis and is the same boundary the Damage Matters candidate ([#368](https://github.com/Doberjohn/inkweave/issues/368)) leans on to separate "damage the opponent" from "sacrifice your own."

### Why same-side pairs sit at 5

Two banish-triggers don't compound: each body trades independently, and a second one doesn't multiply the first. Two self-banish cards are parallel enablers that still need a payoff to do anything. Both are deck-share density baseline under the 5-convention, not specific mechanical wins.
