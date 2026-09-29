# Items Synergy Rule ("Item Matters")

Detailed documentation for the Items rule, the Set 9-13 Inventor / artifacts axis: play a lot of items, and cash in the payoffs that reward it.

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/cardHelpers.ts`
**Rule ID**: `items`
**Category**: `playstyle`
**Playstyle ID**: `items`

---

## Overview

Item Matters is **payoff-anchored** like Floodborn: the item pool is large (82 items in rotation, all six inks), so items never synergize with each other. A pair scores only when at least one side is an item **payoff**. This is deliberate: scoring every item against every other item would emit thousands of density-floor pairs.

The archetype is real but **Sapphire-concentrated** and payoff-thin (six of the seven rotation payoffs are Sapphire), which is why the pre-build investigation recommended deferring it. The rule is built anyway; the payoff-anchoring keeps it honest.

---

## Role Detection

```typescript
getItemRoles(card: LorcanaCard): ItemRole[]  // any subset of ['member','item-engine','payoff-trigger','payoff-static']
```

- **member** — any Item card (`card.type === 'Item'`), the thing that gets played.
- **payoff-trigger** — a repeating `/whenever you play an item/i` reward (Norton Nimnul, Charles Muntz, Alpha).
- **payoff-static** — a conditional/count reward: `for each item`, `while/if you have an item in play`, item-count (Dug, Stegmutt, Quackerjack), or readying an item (`ready chosen item`: Edna Mode - Super Suit Designer, Castle of the Horned King). A condition on one **named** item is not a payoff: "if you have an item named Rivera Family Photo in play" (Torn Scrap) rewards one specific card, not playing items, so the pattern refuses `item named` with a negative lookahead.
- **item-engine** — the item engine: tutor/search an item, return an item from your discard, or discount OTHER items. Self-discount ("pay 1 less to play **this** item") is gated OUT, so a self-discounting item like Blue Smoke stays a plain member.

Cards are multi-role: an item that recurs items (Shepherd's Journal) is `member` + `item-engine`.

**Excludes item removal.** "Banish chosen item" is anti-item control on the opposite axis; it never matches the play/return/for-each/trigger patterns, so it is naturally excluded (Wildcat, Make the Potion, Judy Hopps get no item role).

---

## Scoring (8/7/6, payoff-anchored, 5-baseline)

`findSynergies` calls `scoreItemPair` only when at least one side is a payoff, so every emitted pair is 8/7/6. Cards are multi-role, so the **highest applicable bucket wins**:

| Pair | Score | Explanation |
|------|-------|-------------|
| item-engine ↔ payoff (trigger or static) | **8** | The item engine floods the board, and every item it plays fires the payoff |
| payoff ↔ payoff | **7** | Two item payoffs stack on the same item flood |
| member ↔ payoff-trigger | **7** | Playing the item fires the repeating "whenever you play an item" payoff |
| member ↔ payoff-static | **6** | The item in play turns on the "have an item in play" payoff |
| item-engine ↔ item-engine / member ↔ item-engine / member ↔ member | (not generated) | Pure density; the engine connections already surface via Ramp / Self-Discard |

### Live distribution

**1,085 unique pairs** after the ink filter (Core pool, sets 9-13 plus the Set 14 preview): 8 = 159 (15%), 7 = 303 (28%), 6 = 623 (57%). The 6-heavy shape is structural: every item satisfies a static "have an item" check, so `member ↔ payoff-static` dominates, the same pattern as Floodborn's `member ↔ buff`.

---

## Card examples by role

Real cards the `getItemRoles` detector tags for each role (names from the live database; effects paraphrased):

| Role | Real cards | What they do |
|------|-----------|--------------|
| **member** | Blue Smoke (Sapphire), Shepherd's Journal (Sapphire), Super Suit (Amethyst) | Item cards, the bodies you flood the board with |
| **item-engine** | Gadget Hackwrench - Resourceful Mechanic (Sapphire), Pluto - Clever Cluefinder (Sapphire), Salvage Operation (Sapphire) | Free-play, recur from discard, or discount other items to keep the flood going |
| **payoff-trigger** | Norton Nimnul - Misanthropic Genius (Sapphire), Charles Muntz - Obsessive Explorer (Sapphire), Alpha - Pack Leader (Sapphire) | Fire an effect whenever you play an item |
| **payoff-static** | Dug - Good Boy (Sapphire), Edna Mode - Super Suit Designer (Sapphire), Stegmutt - Clumsy Dinosaur (Emerald) | Reward having items in play, scale with your item count, or ready an item |

---

## Cross-rule composition

The item engine overlaps existing rules by design, which is why item-engine pairs are dropped from this rule rather than scored at a floor:

- Item **cost-reduction** (Belle, Gadget, Edna) is also Ramp's `cost-reduction` role.
- Item **recursion** (Pluto, Winnie the Pooh - Hungry Bear, Salvage Operation, Shepherd's Journal) is also Self-Discard's `reanimator` role.
- **Ingenious Device** (banish this item, draw) is also Sacrifice's `self-banish`.

Users still see those connections, just under the rule that owns them.

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Items detection')` (6 role tests) and `describe('Items rule (payoff-anchored)')` (6 scoring tests, including the two drop cases that prove the payoff gate). `cardHelpers.test.ts` → `describe('getItemRoles: named-item conditions')` (2 tests) covers the named-item exclusion (Torn Scrap and a fixture) and the item-count and ready-an-item payoffs (a fixture, Edna Mode - Super Suit Designer, Castle of the Horned King).
