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

### Role 1: Inkwell Ramp (34 cards, ~80% Sapphire)

Cards that put extra cards into YOUR inkwell. Two sub-types:

**Deck Ramp (20 cards)** — Top of deck → inkwell. Free mana with no card cost.
- Pattern: `put the top card of your deck into your inkwell`
- Pattern: `look at the top X cards...put...into your inkwell`
- Pattern: `put up to X cards from your discard into your inkwell`

**Self-Sacrifice (14 cards)** — Hand/board card → inkwell. Trades a card for speed.
- Pattern: `put a card from your hand into your inkwell`
- Pattern: `put chosen character of yours into your inkwell`
- Pattern: `put this card into your inkwell`
- Pattern: `additional card...into your inkwell`

### Critical Exclusion: Opponent Ink

Cards that put stuff into the **opponent's** inkwell are **removal**, not ramp. They do NOT fire your inkwell triggers and do NOT give you more ink.

**Excluded pattern**: `into its/their player's inkwell` — unless the card also puts cards into YOUR inkwell.

Examples: Hide Away, Wipe Out!, Let It Go, Hades - Infernal Schemer.

### Role 2: Inkwell Triggers (28 cards, even color spread)

Cards with "whenever a card is put into your inkwell" effects. Two timing variants:

**Repeating (20 cards)** — Fire every time a card enters your inkwell.
- Pattern: `whenever a card is put into your inkwell` (without "once" qualifier)
- Includes the **Coil cycle** (6 items, one per ink color) — a designed-in archetype signal.

**Once-per-turn (8 cards)** — Fire only on the first ink event per turn.
- Pattern: `once during your turn, whenever a card is put into your inkwell`

**Variant wordings** (also detected):
- `whenever you put a card into your inkwell` (Fairy Godmother's Wand)
- `when you put a card into your inkwell` (Chicha)

### Role 3: Cost Reduction Grants (18 cards, ~50% Amber)

Cards that reduce the cost of OTHER cards you play.

**Detection**: `you pay X ⬡ less` — but NOT `you pay X ⬡ less to play this` (which is self-discount, excluded).

Three activation patterns (same synergy behavior, affects scoring nuance):
- **Exert-activated**: `⟳ — You pay X less` (Pluto, Lantern)
- **Quest-activated**: `Whenever this character quests, you pay X less` (Huey, Aurora)
- **Passive**: `While/For each...you pay X less` (Yokai, Gadget)

---

## Scoring

Scores are determined by role pair and sub-pattern. The gradient follows mechanic proximity: direct chains score highest, parallel strategies score in the middle, indirect coexistence scores lowest.

| # | Pair | Score | Example |
|---|------|-------|---------|
| 1 | Deck Ramp ↔ Repeating Trigger | **9** | Mama Odie + Jafar — inks on song → 1 damage per ink |
| 2 | Deck Ramp ↔ Once/turn Trigger | **8** | One Jump Ahead + Raya Kumandran Rider — ink readies character |
| 3 | Self-Sacrifice ↔ Repeating Trigger | **8** | Winnie the Pooh + Rafiki — hand→ink → draw card |
| 4 | Self-Sacrifice ↔ Once/turn Trigger | **7** | Cinderella + Dawson — end-of-turn ink → peek |
| 5 | Ramp ↔ Ramp | **7** | Rescue Rangers Submarine + Tipo — dual ramp sources |
| 6 | Ramp ↔ Cost Reduction | **7** | Heart of Te Fiti + Lantern — parallel acceleration |
| 7 | Trigger ↔ Trigger | **7** | Jim Hawkins + Steel Coil — every ink fires both |
| 8 | Cost Reduction ↔ Cost Reduction | **6** | Pluto + Huey — stacking discounts |
| 9 | Trigger ↔ Cost Reduction | **5** | Amber Coil + Grandmother Willow — weak indirect link |

### Scoring Logic

```
if ramp ↔ trigger:
  base = 7
  +1 if ramp card is deck ramp (free mana)
  +1 if trigger is repeating (scales with ramp)
  max = 9

if ramp ↔ ramp: 7 (density)
if ramp ↔ cost-reduction: 7 (parallel)
if trigger ↔ trigger: 7 (density)
if cost-reduction ↔ cost-reduction: 6 (stacking)
if trigger ↔ cost-reduction: 5 (weak)
```

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

**80 total ramp cards** (5.6% of 1429-card pool):

| Role | Count | Sub-patterns |
|------|-------|-------------|
| Inkwell Ramp | 34 | 20 deck ramp + 14 self-sacrifice |
| Inkwell Triggers | 28 | 20 repeating + 8 once-per-turn |
| Cost Reduction | 18 | Exert/Quest/Passive activation |

**Color distribution**:
- Inkwell Ramp: ~80% Sapphire (Sapphire's identity mechanic)
- Inkwell Triggers: Even spread across all 6 colors (Coil cycle)
- Cost Reduction: ~50% Amber (Amber's support identity)

---

## Excluded Card Categories

| Category | Count | Reason |
|----------|-------|--------|
| Opponent Ink | ~12 | Removal, not ramp — doesn't fire your triggers or give you ink |
| Self-Discount Payoffs | ~34 | "Pay X less to play **this**" — built-in discount, too self-contained |
| Free Play Grants | ~36 | Bypass mana entirely — separate mechanic, doesn't benefit from more ink |
| High-cost generic | hundreds | Original issue suggested cost 6+ as payoffs — too broad, no synergy signal |

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
