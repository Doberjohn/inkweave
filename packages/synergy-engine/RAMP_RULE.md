# Ramp Synergy Rule

Detailed documentation for the Ramp rule — a playstyle synergy that detects mana acceleration strategies.

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/cardHelpers.ts`
**Rule ID**: `ramp`
**Category**: `playstyle`
**Playstyle ID**: `ramp`

---

## Overview

The Ramp archetype is a three-role strategy: **inkwell ramp** cards put extra cards into your inkwell (getting you ahead on mana), **inkwell triggers** fire effects whenever a card enters your inkwell, and **cost reduction** cards discount other cards you play. Together they form an acceleration engine that lets you deploy powerful cards ahead of curve.

The strongest synergy is between inkwell ramp and inkwell triggers — each extra ink fires every trigger on board, creating a multiplicative effect. Cost reduction provides a parallel acceleration path that stacks with ramp but operates independently.

### Example

**Ramp**: Mama Odie - Mystical Maven — "Whenever you play a song, put the top card of your deck into your inkwell."
**Trigger**: Jafar - Power-Hungry Vizier — "During your turn, whenever a card is put into your inkwell, deal 1 damage to chosen character."
**Discount**: Lantern — "⟳ — You pay 1 ⬡ less for the next character you play this turn."

Mama Odie inks on each song → Jafar deals 1 damage per ink → Lantern discounts your next play. Triple acceleration.

---

## Role Detection

### Architecture

Detection uses the same pattern as the Discard rule: a `getRampRoles(card)` function returns an array of `RampRole` values (`'inkwell-ramp' | 'inkwell-trigger' | 'cost-reduction'`). A fast pre-filter (`/inkwell|you pay \d+.*less/i`) skips cards without relevant keywords.

All regex matching operates on **normalized text** (`card.text.replace(/\n/g, ' ')`) to handle multi-line card text.

### Role 1: Inkwell Ramp

Cards that put extra cards into YOUR inkwell, Sapphire's identity mechanic. Two sub-types (Coverage counts each):

**Deck Ramp** — Top of deck → inkwell. Free mana with no card cost.
- Pattern: `put the top card of your deck into your inkwell`
- Pattern: `look at the top X cards...put...into your inkwell`
- Pattern: `put up to X cards from your discard into your inkwell`

**Self-Sacrifice** — Hand/board card → inkwell. Trades a card for speed.
- Pattern: `put a card from your hand into your inkwell`
- Pattern: `put chosen character of yours into your inkwell`
- Pattern: `put this card into your inkwell`
- Pattern: `additional card...into your inkwell`

### Critical Exclusion: Opponent Ink

Cards that put stuff into the **opponent's** inkwell are **removal**, not ramp. They do NOT fire your inkwell triggers and do NOT give you more ink.

**Excluded pattern**: `into its/their player's inkwell` — unless the card also puts cards into YOUR inkwell.

Examples: Hide Away, Wipe Out!, Let It Go, Hades - Infernal Schemer.

### Role 2: Inkwell Triggers

Cards with "whenever a card is put into your inkwell" effects. Two timing variants:

**Repeating** — Fire every time a card enters your inkwell.
- Pattern: `whenever a card is put into your inkwell` (without "once" qualifier)
- Included the **Coil cycle** (one item per ink color, a designed-in archetype signal) until its set rotated out of Core.

**Once-per-turn** — Fire only on the first ink event per turn.
- Pattern: `once during your turn, whenever a card is put into your inkwell`

**Variant wordings** (also detected):
- `whenever you put a card into your inkwell` (Fairy Godmother's Wand)
- `when you put a card into your inkwell` (Chicha)

### Role 3: Cost Reduction Grants

Cards that reduce the cost of OTHER cards you play, leaning Amber (its support identity).

**Detection**: `you pay X ⬡ less` — but NOT `you pay X ⬡ less to play this` (which is self-discount, excluded).

Three activation patterns (same synergy behavior, affects scoring nuance):
- **Exert-activated**: `⟳ — You pay X less` (Pluto, Lantern)
- **Quest-activated**: `Whenever this character quests, you pay X less` (Huey, Aurora)
- **Passive**: `While/For each...you pay X less` (Yokai, Gadget)

---

## Card examples by role

Real cards the `getRampRoles` detector tags for each role (names from the live database; effects paraphrased):

| Role | Real cards | What they do |
|------|-----------|--------------|
| **inkwell-ramp** | Donald Duck - Focused Flatfoot (Sapphire), Tipo - Growing Son (Sapphire), All Funned Out (Sapphire) | Put an extra card into your inkwell: off the top of your deck, from hand, or by sinking one of your own characters |
| **inkwell-trigger** | Rafiki - Ethereal Guide (Amethyst), Owl - Pirate Lookout (Amber), Raya - Kumandran Rider (Ruby) | Fire a bonus whenever a card enters your inkwell: draw, shrink an opposing character, or ready one of yours |
| **cost-reduction** | Iago - Fake Flamingo (Emerald), Owl Island - Secluded Entrance (Emerald), Yokai - Intellectual Schemer (Emerald-Sapphire) | Cut future costs: the next action, the first action each turn, or Shift characters |

---

## Scoring (5–9 chain ladder + density baseline)

The rule applies the project-wide **5-baseline scoring convention**: 5 = neutral default (parallel acceleration / same-axis density, no compounding), 6+ = specific mechanical interaction. The chain ladder (Ramp↔Trigger, scored 7–9) is the only real mechanical chain in the playstyle and is preserved at full strength.

### Score Table

| # | Pair | Score | Example |
|---|------|-------|---------|
| 1 | Deck Ramp ↔ Repeating Trigger | **9** | Mama Odie + Jafar — every free ink fires the trigger (snowball) |
| 2 | Deck Ramp ↔ Once/turn Trigger | **8** | One Jump Ahead + Raya Kumandran — free ink, capped trigger |
| 3 | Self-Sacrifice ↔ Repeating Trigger | **8** | Winnie the Pooh + Rafiki — hand→ink fires every event |
| 4 | Self-Sacrifice ↔ Once/turn Trigger | **7** | Cinderella + Dawson — card cost + capped trigger |
| 5 | Cost Reduction ↔ Cost Reduction (overlap) | **6** | Pluto + Huey — same target type, real stacking discount |
| 6 | Ramp ↔ Ramp | **5** | Parallel ramp; doesn't compound |
| 7 | Trigger ↔ Trigger | **5** | Parallel triggers; both need a ramp card to fire |
| 8 | Ramp ↔ Cost Reduction | **5** | Parallel acceleration on different axes; no per-card combo |
| 9 | Trigger ↔ Cost Reduction | **5** | Weak indirect link |
| — | Cost Reduction ↔ Cost Reduction (no overlap) | **0** | Discounts target different card types — silently filtered |

### Scoring Logic

```
if ramp ↔ trigger:
  base = 7
  +1 if ramp card is deck ramp (free mana)
  +1 if trigger is repeating (scales with ramp)
  max = 9

if cost-reduction ↔ cost-reduction:
  6 if discount target types overlap (real stacking on same play)
  0 silently dropped if disjoint (Pirate-discount + Location-discount won't combo)

# Density baseline — same-axis pairs sit at the floor:
if ramp ↔ ramp: 5
if trigger ↔ trigger: 5
if ramp ↔ cost-reduction: 5
if trigger ↔ cost-reduction: 5
```

### Live distribution

<!-- coverage:start distribution -->
Counted by `pnpm refresh-rule-coverage` over the Core cards in the synergy pool (sets 9-13 plus the Set 14 preview).

**1,767 unique pairs** after the engine's ink-compatibility filter (`canShareDeck`):

| Pair shape | Pairs | Score | Share |
|----------|-----|-----|-----|
| Deck ramp ↔ repeating trigger | 52 | 9 | 2.9% |
| Deck ramp ↔ once-per-turn trigger | 26 | 8 | 1.5% |
| Self-sacrifice ↔ repeating trigger | 24 | 8 | 1.4% |
| Self-sacrifice ↔ once-per-turn trigger | 12 | 7 | 0.7% |
| Cost reduction ↔ cost reduction (overlapping targets) | 96 | 6 | 5.4% |
| Ramp ↔ ramp | 701 | 5 | 39.7% |
| Trigger ↔ trigger | 3 | 5 | 0.2% |
| Ramp ↔ cost reduction | 790 | 5 | 44.7% |
| Trigger ↔ cost reduction | 63 | 5 | 3.6% |
<!-- coverage:end -->

The 8-9 pairs aren't inflation: they're the ramp ↔ trigger chains, the only real mechanical chain in the playstyle. Most inkwell-ramp cards are deck ramp (the strongest variant) and most inkwell triggers repeat, so most pairs that *can* chain *do*; how many chains there are follows how many trigger cards the pool holds. A broad density floor with rare, mechanically real spikes is the right curve. The scores and explanation templates live in `tuning.json`, and the table reads both from the engine.

### Explanation Templates

| Pair | Template |
|------|----------|
| Ramp ↔ Trigger | "{ramp} adds ink to your inkwell, triggering {trigger}'s inkwell effect" |
| Ramp ↔ Ramp | "Both {A} and {B} accelerate your ink, getting you ahead on mana faster" |
| Ramp ↔ Cost Reduction | "{ramp} adds extra ink while {cost} discounts your plays — double acceleration" |
| Trigger ↔ Trigger | "Both {A} and {B} fire on inkwell events — each ink triggers both effects" |
| Cost ↔ Cost | "Both {A} and {B} reduce costs — stacking discounts lets you deploy faster" |
| Trigger ↔ Cost | "{A} and {B} both support an accelerated game plan" |

---

## Coverage

<!-- coverage:start coverage -->
**62 total ramp cards**:

| Role | Cards | Sub-patterns | Cards per ink |
|----|-----|------------|-------------|
| Inkwell Ramp | 38 | 26 deck ramp + 12 self-sacrifice | Sapphire 36, Emerald 2, Amber 1 |
| Inkwell Triggers | 3 | 2 repeating + 1 once-per-turn | Sapphire 3 |
| Cost Reduction | 21 | Exert/Quest/Passive activation | Amber 10, Emerald 3, Sapphire 3, Amethyst 2, Ruby 2, Steel 1 |
<!-- coverage:end -->

Inkwell ramp is Sapphire's identity mechanic and cost reduction is Amber's support identity; the ink columns show how the live pool splits.

---

## Excluded Card Categories

| Category | Reason |
|----------|--------|
| Opponent Ink | Removal, not ramp — doesn't fire your triggers or give you ink |
| Self-Discount Payoffs | "Pay X less to play **this**" — built-in discount, too self-contained |
| Free Play Grants | Bypass mana entirely — separate mechanic, doesn't benefit from more ink |
| High-cost generic | Original issue suggested cost 6+ as payoffs — too broad, no synergy signal |

---

## Test Coverage

**37 tests** in `rules.test.ts`:

### Role Detection (9 tests)
- Deck ramp detection (Mama Odie, One Jump Ahead)
- Self-sacrifice detection (Winnie the Pooh)
- Repeating trigger detection (Jafar, Amber Coil)
- Once-per-turn trigger detection (Raya)
- Variant wording trigger (Fairy Godmother's Wand)
- Cost reduction grant detection (Pluto, Lantern)
- Opponent-ink exclusion (Hide Away, Wipe Out!)
- Self-discount exclusion (Kristoff)
- Unrelated card exclusion

### Scoring (9 tests)
- All 9 entries in the scoring matrix verified with specific card pairs

### Integration (4 tests)
- No synergies with unrelated cards
- No synergies for excluded opponent-ink cards
- Explanations include both card names
- All matches marked bidirectional

---

## Design Decisions

### Why three roles instead of two?
The original issue (#42) proposed just inkwell ramp + high-cost payoffs. Card data analysis revealed that "ramp" in Lorcana is actually three distinct mechanics: inkwell additions, inkwell triggers, and cost reduction. Triggers have a direct mechanic chain with ramp (each ink fires the trigger), while cost reduction provides a parallel path. Collapsing to two roles would miss the trigger synergy entirely.

### Why exclude opponent ink?
Cards like Hide Away and Wipe Out! share the word "inkwell" with ramp cards but do the opposite: they remove an opponent's card by tucking it into the opponent's inkwell. They don't fire YOUR triggers and don't give YOU more ink. Including them would create false synergies.

### Why not include free play effects?
Free play ("play X for free") bypasses mana entirely rather than accelerating it. A card that plays something for free doesn't benefit from having more ink — the ink is irrelevant. Free play could be its own future rule.

### Why sub-pattern scoring?
Not all ramp↔trigger pairs are equal: deck ramp (free mana) + repeating trigger (fires every ink) is strictly better than self-sacrifice (card cost) + once-per-turn (capped). The 2-point scoring range (7-9) captures this nuance without overcomplicating the system.
