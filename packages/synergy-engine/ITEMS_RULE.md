# Items Synergy Rule ("Item Matters")

Detailed documentation for the Items rule, the Set 9-13 Inventor / artifacts axis: play a lot of items, and cash in the payoffs that reward it.

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/detection/items.ts`
**Rule ID**: `items`
**Category**: `playstyle`
**Playstyle ID**: `items`

---

## Overview

Item Matters is **payoff-anchored** like Floodborn: the item pool is large and spans every ink (Coverage counts it), so items never synergize with each other. A pair scores only when at least one side is an item **payoff**. This is deliberate: scoring every item against every other item would emit thousands of density-floor pairs.

The archetype is real but **Sapphire-concentrated** and payoff-thin (Coverage counts the payoffs per ink), which is why the pre-build investigation recommended deferring it. The rule is built anyway; the payoff-anchoring keeps it honest.

---

## Role Detection

```typescript
getItemRoles(card: LorcanaCard): ItemRole[]  // any subset of ['member','item-engine','payoff-trigger','payoff-static']
```

- **member** — any Item card (`card.type === 'Item'`), the thing that gets played.
- **payoff-trigger** — a repeating `/whenever you play an item/i` reward (Norton Nimnul, Charles Muntz, Alpha).
- **payoff-static** — a conditional/count reward: `for each item`, `while/if you have an item in play`, item-count (Dug, Ariel - Collector of Oddities), or readying an item (`ready chosen item`: Edna Mode - Super Suit Designer, Castle of the Horned King). A condition on one **named** item is not a payoff: "if you have an item named Rivera Family Photo in play" (Torn Scrap) rewards one specific card, not playing items, so the pattern refuses `item named` with a negative lookahead. Nor is a count of item cards **in your discard** ("For each item card in your discard", Stegmutt - Clumsy Dinosaur; "for each item card put into your discard this way", Quackerjack - Loony Toymaker): no item you play reaches it, so the `for each item` branch refuses `item card(s) in/put into your discard`.
- **item-engine** — the item engine: tutor/search an item, return an item card from your discard **to your hand**, or discount OTHER items. Self-discount ("pay 1 less to play **this** item") is gated OUT, so a self-discounting item like Blue Smoke stays a plain member. Moving item cards from your discard to the bottom of your deck (Stegmutt's cost) brings none back, so it is not recursion; Darkwing Duck - Dashing Gadgeteer, who does that and then plays an item from your discard, stays an engine through the play branch.

Cards are multi-role: an item that recurs items (Shepherd's Journal) is `member` + `item-engine`.

**Excludes item removal.** "Banish chosen item" is anti-item control on the opposite axis; it never matches the play/return/for-each/trigger patterns, so it is naturally excluded (Wildcat, Make the Potion, Judy Hopps get no item role).

---

## Scoring (8/7/6/5, payoff-anchored, 5-baseline)

`findSynergies` calls `scoreItemCards` only when at least one side is a payoff. It drops a plain item that a payoff which only readies an item can't use (below), then scores the pair by its roles with `scoreItemPair`, so every emitted pair is 8/7/6, except two payoffs that reward the same items (5, below). Cards are multi-role, so the **highest applicable bucket wins**:

| Pair | Score | Explanation (from the first card's page) |
|------|-------|-------------|
| item-engine ↔ payoff (trigger or static) | **8** | `{A} helps you play more items, and they activate {B}.` |
| payoff ↔ payoff, neither an item | **5** | `{A} and {B} both go in an item deck.` |
| member ↔ payoff-trigger | **7** | `Playing {A} triggers {B}'s "whenever you play an item" ability.` |
| member ↔ payoff-static | **6** | `{A} can activate {B}'s item ability.` |
| item-engine ↔ item-engine / member ↔ item-engine / member ↔ member | (not generated) | Pure density; the engine connections already surface via Ramp / Self-Discard |
| plain item with no exert ability ↔ a payoff that only readies an item | (not generated) | Readying an item with no ⟳ ability does nothing |

**A payoff that only readies an item.** Edna Mode - Super Suit Designer ("⟳ — Ready chosen item.") and Castle of the Horned King - Bastion of Evil ("you may ready chosen item") pay off only an item that exerts to use an ability, which readying lets you use again. `readiesItemsOnly` finds them (readying is their only item payoff), and `hasExertAbility` reads an item's ⟳. An item with no ⟳ (Potato, Snow Fort, Merida's Bow, whose ability banishes it) gains nothing, so the pair is dropped. An item engine or payoff next to them still scores by its roles.

**Two payoffs score what each card's ability gives the other** (`scorePayoffPair`, shared with Floodborns and the classification tribes). No payoff is an item today, so neither counts the other: Norton Nimnul - Misanthropic Genius and Alpha - Pack Leader both reward each item you play, and two payoffs on one axis don't multiply each other (the reason Discard's payoff pairs moved from 7 to 5, `SCORING_DESIGN.md`), so they sit at 5. An item that becomes a payoff would score as a member with the other payoff (7 or 6), and two such items that each count the other at 7.

`{A}` is the card whose page shows the tile and `{B}` its partner; the UI draws each as its card's chip. A line names each card in its role, so on the other card's page the tokens swap: on Norton Nimnul's page, Gadget Hackwrench's tile reads `{B} helps you play more items, and they activate {A}.`

### Live distribution

<!-- coverage:start distribution -->
Counted by `pnpm refresh-rule-coverage` over the Core cards in the synergy pool (sets 9-14).

**986 unique pairs** after the engine's ink-compatibility filter (`canShareDeck`):

| Score | Pairs | Share |
|-----|-----|-----|
| 8 | 153 | 15.5% |
| 7 | 380 | 38.5% |
| 6 | 417 | 42.3% |
| 5 | 36 | 3.7% |
<!-- coverage:end -->

The 6-heavy shape is structural: every item satisfies a static "have an item" check, so `member ↔ payoff-static` dominates, the same pattern as Floodborn's `member ↔ buff`. The 5s are the payoff pairs.

---

## Card examples by role

Real cards the `getItemRoles` detector tags for each role (names from the live database; effects paraphrased):

| Role | Real cards | What they do |
|------|-----------|--------------|
| **member** | Blue Smoke (Sapphire), Shepherd's Journal (Sapphire), Super Suit (Amethyst) | Item cards, the bodies you flood the board with |
| **item-engine** | Gadget Hackwrench - Resourceful Mechanic (Sapphire), Pluto - Clever Cluefinder (Sapphire), Salvage Operation (Sapphire) | Free-play, recur from discard, or discount other items to keep the flood going |
| **payoff-trigger** | Norton Nimnul - Misanthropic Genius (Sapphire), Charles Muntz - Obsessive Explorer (Sapphire), Alpha - Pack Leader (Sapphire) | Fire an effect whenever you play an item |
| **payoff-static** | Dug - Good Boy (Sapphire), Edna Mode - Super Suit Designer (Sapphire), Hiro Hamada - Pioneering Inventor (Sapphire) | Reward having items in play, scale with your item count, or ready an item |

---

## Cross-rule composition

The item engine overlaps existing rules by design, which is why item-engine pairs are dropped from this rule rather than scored at a floor:

- Item **cost-reduction** (Belle, Gadget, Edna) is also Ramp's `cost-reduction` role.
- Item **recursion** (Pluto, Winnie the Pooh - Hungry Bear, Salvage Operation, Shepherd's Journal) is also Self-Discard's `reanimator` role.
- **Ingenious Device** (banish this item, draw) is also Sacrifice's `self-banish`.
- **Stegmutt - Clumsy Dinosaur** and **Quackerjack - Loony Toymaker** count item cards in your discard, which no role here fills. Self-Discard carries them: Stegmutt is a `zone-payoff`, Quackerjack a `mill`.

Users still see those connections, just under the rule that owns them.

---

## Coverage

<!-- coverage:start coverage -->
| Role | Cards | Cards per ink |
|----|-----|-------------|
| member | 98 | Sapphire 25, Emerald 19, Amethyst 16, Steel 15, Amber 12, Ruby 11 |
| item-engine | 17 | Sapphire 15, Emerald 2 |
| payoff-trigger | 4 (Alpha - Pack Leader, Ariel - Collector of Oddities, Charles Muntz - Obsessive Explorer, Norton Nimnul - Misanthropic Genius) | Sapphire 4 |
| payoff-static | 6 (Ariel - Collector of Oddities, Baymax - Lab Assistant, Castle of the Horned King - Bastion of Evil, Dug - Good Boy, Edna Mode - Super Suit Designer, Hiro Hamada - Pioneering Inventor) | Sapphire 5, Emerald 1 |

Payoffs (`payoff-trigger` or `payoff-static`): 9 (Sapphire 8, Emerald 1). Payoff anchoring skips the 6,216 pairs among the other tagged cards (members and item engines) that could share a deck.
<!-- coverage:end -->

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/items.test.ts` under `describe('Items detection')` (6 role tests) and `describe('Items rule (payoff-anchored)')` (6 scoring tests, including the two drop cases that prove the payoff gate). `cardHelpers.test.ts` → `describe('getItemRoles: named-item conditions')` (2 tests) covers the named-item exclusion (Torn Scrap and a fixture) and the item-count and ready-an-item payoffs (a fixture, Edna Mode - Super Suit Designer, Castle of the Horned King). Five more tests in `items.test.ts`, on real card text, cover the discard counts and the deck-bottom cost (Stegmutt and Quackerjack gain no payoff, Stegmutt gains no engine role, and Ariel - Collector of Oddities, Winnie the Pooh - Hungry Bear and Darkwing Duck - Dashing Gadgeteer keep theirs), and the payoffs that only ready an item: Edna Mode and Castle of the Horned King pair with Scream Canister at 6 and not with Potato, from either side. A fifth test scores Norton Nimnul and Alpha - Pack Leader at the same-deck 5 from either side.
