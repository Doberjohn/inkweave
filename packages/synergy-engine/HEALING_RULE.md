# Healing Synergy Rule ("Heal Matters")

Detailed documentation for the Healing rule, a playstyle synergy that detects the "Heal Matters" archetype: remove damage from your own characters, then cash in the payoffs that reward healing.

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/cardHelpers.ts`
**Rule ID**: `healing`
**Category**: `playstyle`
**Playstyle ID**: `healing`

---

## Overview

The Heal Matters archetype is a two-role, enabler-to-payoff strategy: **healers** remove damage from your *own* characters, and **heal-payoffs** reward you each time you do. A healer clears damage on demand, converting a "whenever you remove damage" payoff into a repeatable value engine.

Like Sacrifice and Discard, this is an asymmetric-role playstyle: the healers *create* the removal event that the payoffs *exploit*. A deck of all payoffs has nothing to trigger them; a deck of all healers has nothing to pay off. The combo is the rule, so it is **payoff-anchored** — two plain healers never synergize with each other.

**Why key healing on the mechanic, not Madrigals?** Encanto is the flavor home of healing, but only ~12% of healers (7 of 58) carry the Madrigal classification, and every payoff is worded generically ("remove damage from one of your characters"). So this rule keys on the mechanic, not a subtype, the same reason Sacrifice keys on "of yours" text rather than a classification. The family itself is now its own playstyle, the `madrigal` tribe ([TRIBES_RULE.md](TRIBES_RULE.md)), keyed on its "another Madrigal in play" payoffs. The two complement each other: Julieta's Arepas sits in both.

### Example

**Healer**: Healing Touch (Amber): "Remove up to 3 damage from chosen character."
**Heal-payoff**: Grand Pabbie - Oldest and Wisest (Sapphire): "Whenever you remove 1 or more damage from one of your characters, gain 2 lore."

Healing Touch clears damage -> Grand Pabbie's trigger fires -> gain 2 lore. The payoff becomes a repeatable engine instead of waiting on incidental combat healing.

---

## Role Detection

### Architecture

```typescript
getHealRoles(card: LorcanaCard): HealRole[]  // ['healer'] | ['heal-payoff'] | [...both] | []
```

A card can be both roles (Ohana Means Family removes damage AND draws for each point removed). Detection uses a fast pre-filter (`HAS_HEAL_KEYWORD = /remove|damage removed/i`) before running the patterns.

### healer (enabler)

```regex
/remove (?:up to \d+|all|\d+) damage from/i
```

Matches an outlet that removes damage from a character. Because it begins with `remove`, it can never match `move`, so a "move ... damage" clause on the same card cannot fabricate a false healer.

| Example card text | Card |
|-------------------|------|
| "**Remove up to 3 damage from** chosen character." | Healing Touch |
| "**Remove all damage from** chosen character of yours." | Ohana Means Family |
| "...you may **remove all damage from** this character." | Isabela Madrigal - Perfectly in Control |

### heal-payoff (payoff)

```regex
/whenever you remove damage|when you remove damage|if you removed damage|for each \d+ damage removed|damage removed this way|remove 1 or more damage/i
```

Matches a benefit gated on the removal event:

| Shape | Example card text |
|-------|-------------------|
| Repeating trigger | "**Whenever you remove 1 or more damage** from one of your characters, gain 2 lore." (Grand Pabbie) |
| Count payoff | "...gain 1 lore **for each 1 damage removed**." (Isabela Madrigal - Caring Cultivator) |
| This-way count | "Draw a card **for each 1 damage removed this way**." (Ohana Means Family) |

### What's Excluded

| Excluded | Pattern / reason |
|----------|------------------|
| **Move-damage** | "move ... damage from X to Y" relocates damage, the opposite mechanic. The pure-mover guard (`/\bmove\b[^.]*\bdamage\b/i`) drops a card ONLY when it has neither a remove clause nor a payoff, so a dual card that both moves and separately removes damage stays a healer. |
| **Steel "no damage / undamaged" statics** | "deals no damage" / "while undamaged" is a different axis; none match the remove/payoff patterns, so they are excluded naturally (0 wrongly tagged). |

---

## Card examples by role

Real cards the `getHealRoles` detector tags (names from the live database; effects paraphrased):

| Role | Real cards | What they do |
|------|-----------|--------------|
| **healer** (enabler) | Healing Touch (Amber), Baymax - Personal Healthcare Companion (Sapphire), Grand Pabbie's healers pool (Amber/Sapphire) | Remove damage from one of your characters |
| **heal-payoff** (payoff) | Grand Pabbie - Oldest and Wisest (Sapphire), Aurora - Waking Beauty (Amber), Pepa Madrigal - Calm Before the Storm (Amethyst) | Fire a bonus whenever you remove damage |
| **both** | Ohana Means Family (Amber), Julieta's Arepas (Sapphire), Antonio Madrigal - Animal Doctor (Sapphire) | Remove damage AND reward the same removal |

---

## Scoring (7/8 matrix)

Applies the project-wide **5-baseline convention**. Because the rule is payoff-anchored, every emitted pair has at least one payoff, so scores resolve to 8 or 7 (the healer-healer density baseline is never emitted).

### Score Table

| Pair Type | Score | Display Tier | Explanation |
|-----------|-------|-------------|-------------|
| healer <-> heal-payoff | **8** | Strong | Win-condition combo: the healer clears damage on demand, firing the payoff engine each time |
| heal-payoff <-> heal-payoff | **7** | Strong | Two heal engines compound on the same board |
| healer <-> healer | (not generated) | - | Payoff-anchored: two enablers with no payoff to fire are dropped |

### Live distribution

58 healers + 14 heal-payoffs (7 pure payoff + 7 dual-role healer+payoff) = 65 distinct participating cards. After the engine's ink-compatibility filter (`canShareDeck`), **755 unique pairs**:

| Pair shape | Count | Score | Share |
|------------|-------|-------|-------|
| healer <-> heal-payoff | 666 | 8 | 88% |
| heal-payoff <-> heal-payoff | 89 | 7 | 12% |

1,142 healer <-> healer pairs are dropped (payoff-anchored). The high 8-share is structural: healers vastly outnumber payoffs (58 vs 14), so most emitted pairs are a healer feeding a payoff, which *is* the archetype's identity.

```chart
{
  "type": "doughnut",
  "title": "Role Composition (65 cards)",
  "data": {
    "labels": ["Healers only (51)", "Payoffs only (7)", "Both roles (7)"],
    "values": [51, 7, 7]
  }
}
```

### Token-swapped explanation

The healer-payoff string uses the project `{A}`/`{B}` token convention so the **healer** always reads as the actor, regardless of which card the user selected:

```typescript
const healerToken = cardPayoff ? '{B}' : '{A}';
const payoffToken = cardPayoff ? '{A}' : '{B}';
// `${healerToken} clears damage off your characters, firing ${payoffToken}'s heal payoff.`
```

The payoff-payoff pair uses a distinct sentence: `"Both reward removing damage: two heal engines that compound on the same board."`

---

## Coverage

- **58 healers**, Amber/Sapphire-heavy: Amber 27, Sapphire 21, Ruby 4, plus dual-inks (Amber-Steel 2, Amber-Ruby 1, Amber-Sapphire 1, Emerald-Sapphire 1, Sapphire-Steel 1).
- **14 heal-payoffs** (7 pure payoff, 7 dual-role): Amber, Sapphire, Amethyst, and the Amber-Sapphire Set-13 Madrigal Family card.
- 7 of 58 healers are Madrigal (12%) — confirms this is a mechanic axis, not a tribe.

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Healing rule (Heal Matters)')`.

### Role Detection (4 tests)

| Test | What it verifies |
|------|------------------|
| healer from "remove up to N damage from" | Healing Touch |
| heal-payoff from "whenever you remove ... damage" | Grand Pabbie |
| dual-role healer + heal-payoff | Ohana Means Family |
| excludes pure move-damage / text-less / unrelated | empty arrays |

### Rule Matching (1 test)

| Test | What it verifies |
|------|------------------|
| matches healers and payoffs, not unrelated | rule `matches` predicate |

### Scoring (4 tests)

| Test | What it verifies |
|------|------------------|
| healer <-> heal-payoff -> 8 | healer-as-actor explanation |
| token swap when payoff is the searcher | healer still reads as actor from the reverse direction |
| heal-payoff <-> heal-payoff -> 7 | two engines compound |
| does not pair two plain healers | payoff-anchored drop |

---

## Design Decisions and Rationale

### Why payoff-anchored?

Healers vastly outnumber payoffs (58 vs 14). If two healers paired at a density baseline of 5, the rule would emit ~1,600 low-signal healer-healer pairs that tag half the Amber/Sapphire pool. Anchoring on the payoff (like Floodborn and Items) keeps the rule to the mechanical win: a healer feeding a payoff.

### Why a mechanic, not a Madrigal tribe?

Only 12% of healers are Madrigal, and every payoff reads "remove damage from one of your characters" with no classification gate. Keying on the mechanic captures the whole archetype (Baymax, Aurora, Grand Pabbie, the Chromicons) that a Madrigal tribe would miss.

### Why the scoped move-damage guard?

Moving damage is the opposite of removing it, but a card can do both in different clauses (Isabela Madrigal - Perfectly in Control moves damage onto herself, then removes all damage from herself). A coarse whole-card move exclusion would wrongly drop that genuine healer, so the guard fires only when the card is a *pure* mover with no remove clause and no payoff.
