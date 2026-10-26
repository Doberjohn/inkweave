# Ramp Synergy Rule

Detailed documentation for the Ramp rule — a playstyle synergy that detects mana acceleration strategies.

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/detection/ramp.ts`
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
- Pattern: `look at the top X cards...put...into your inkwell`, with "into your inkwell" in the look's sentence or the next. Closet Door Portal's look plays a card for free, and its closing "Put this card into your inkwell" is self-sacrifice.
- Pattern: `put up to X cards from your discard into your inkwell`

**Self-Sacrifice** — Hand/board card → inkwell. Trades a card for speed.
- Pattern: `put a card from your hand into your inkwell`
- Pattern: `put chosen character of yours into your inkwell`
- Pattern: `put this card into your inkwell`
- Pattern: `additional card...into your inkwell`

**One card from your discard**: `put a card from your discard into your inkwell` (Jiminy Cricket - Ghost of Christmas Past) is inkwell ramp too. `isDeckRamp` counts only `put up to X cards from your discard`, so Jiminy scores in the self-sacrifice tier. Boost's reminder text ("put the top card of your deck facedown under this character") puts a card under a character, not into your inkwell, so it is no ramp pattern.

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
- A trigger that gives one chosen character a keyword until the start of your next turn scores here too (`LASTING_KEYWORD_GRANT`). Fairy Godmother's Wand's "chosen Princess character of yours gains Ward until the start of your next turn" pays off on the first ink of a turn; a second ink only helps if you have a second Princess. Keywords with a number (Resist +1, Challenger +1) stack, so a grant of one still repeats.

**Variant wordings** (also detected):
- `whenever you put a card into your inkwell` (Fairy Godmother's Wand)
- `when you put a card into your inkwell` (Chicha)

**Turn limits**: triggers such as Scrooge McDuck - Miserly Ebenezer fire only "during your turn", and Ink Amplifier ramps only "during their turn", so they never see its ink. `inkLandsOffTriggerTurn` reads the turn that every ramp sentence and every trigger sentence is limited to, and a ramp ↔ trigger pair limited to different turns scores as density.

### Role 3: Cost Reduction Grants

Cards that reduce the cost of OTHER cards you play, leaning Amber (its support identity).

**Detection**: `you pay X ⬡ less` — but NOT `you pay X ⬡ less to play this` (which is self-discount, excluded).

Three activation patterns (same synergy behavior, affects scoring nuance):
- **Exert-activated**: `⟳ — You pay X less` (Pluto, Lantern)
- **Quest-activated**: `Whenever this character quests, you pay X less` (Huey, Aurora)
- **Passive**: `While/For each...you pay X less` (Yokai, Gadget)

A discount for the cards of **one name** is not a grant: "You pay 1 ⬡ less to play characters named Gurgi." (Munchings and Crunchings), "you pay 2 ⬡ less for the next character named Ellie Fredricksen" (Carl Fredricksen - Loving Husband). It helps that one partner, which Named Companions pairs, and never stacks with another discount on any other play. `NAMED_DISCOUNT_PATTERN` strips it before the grant test.

---

## Card examples by role

Real cards the `getRampRoles` detector tags for each role (names from the live database; effects paraphrased):

| Role | Real cards | What they do |
|------|-----------|--------------|
| **inkwell-ramp** | Donald Duck - Focused Flatfoot (Sapphire), Tipo - Growing Son (Sapphire), All Funned Out (Sapphire) | Put an extra card into your inkwell: off the top of your deck, from hand, or by sinking one of your own characters |
| **inkwell-trigger** | Rafiki - Ethereal Guide (Amethyst), Owl - Pirate Lookout (Amber), Raya - Kumandran Rider (Ruby) | Fire a bonus whenever a card enters your inkwell: draw, shrink an opposing character, or ready one of yours |
| **cost-reduction** | Iago - Fake Flamingo (Emerald), Owl Island - Secluded Entrance (Emerald), Yokai - Intellectual Schemer (Emerald-Sapphire) | Cut future costs: the next action, the first action each turn, or Shift characters |

---

## Scoring (chain at 7 + density baseline)

The rule applies the project-wide **5-baseline scoring convention**: 5 = neutral default (parallel acceleration / same-axis density, no compounding), 6+ = specific mechanical interaction. The ramp ↔ trigger chain (scored 7) is the only real mechanical chain in the playstyle and sits above the density baseline.

### Score Table

| # | Pair | Score | Example |
|---|------|-------|---------|
| 1 | Deck Ramp ↔ Repeating Trigger | **7** | Mama Odie + Jafar — every free ink fires the trigger |
| 2 | Deck Ramp ↔ Once/turn Trigger | **7** | One Jump Ahead + Raya Kumandran — free ink, capped trigger |
| 3 | Self-Sacrifice ↔ Repeating Trigger | **7** | Winnie the Pooh + Rafiki — hand→ink fires every event |
| 4 | Self-Sacrifice ↔ Once/turn Trigger | **7** | Cinderella + Dawson — card cost + capped trigger |
| — | Ramp ↔ Trigger, ink on the turn it can't fire | **5** | Ink Amplifier + Scrooge McDuck - Miserly Ebenezer: the ink lands on the opponent's turn, the trigger fires only on yours |
| 5 | Cost Reduction ↔ Cost Reduction (overlap) | **6** | Pluto + Huey — same target type, real stacking discount |
| 6 | Ramp ↔ Ramp | **5** | Parallel ramp; doesn't compound |
| 7 | Trigger ↔ Trigger | **5** | Parallel triggers; both need a ramp card to fire |
| 8 | Ramp ↔ Cost Reduction | **5** | Parallel acceleration on different axes; no per-card combo |
| 9 | Trigger ↔ Cost Reduction | **5** | Weak indirect link |
| — | Cost Reduction ↔ Cost Reduction (no overlap) | **0** | Discounts target different card types — silently filtered |

### Scoring Logic

```
if ramp ↔ trigger:
  5 if the ramp's ink lands only on the turn the trigger can't fire (Ink Amplifier)
  7 if ramp card is deck ramp (free mana) and trigger is repeating (scales with ramp): chain.deckRepeating
  7 if only one of the two holds: chain.mixed
  7 if neither holds: chain.neither
  # all three chain shapes share 7 since community-vote tuning; each keeps its own key so later votes can split them

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
Counted by `pnpm refresh-rule-coverage` over the Core cards in the synergy pool (sets 9-14).

**1,661 unique pairs** after the engine's ink-compatibility filter (`canShareDeck`):

| Pair shape | Pairs | Score | Share |
|----------|-----|-----|-----|
| Deck ramp ↔ repeating trigger | 24 | 7 | 1.4% |
| Deck ramp ↔ once-per-turn trigger | 48 | 7 | 2.9% |
| Self-sacrifice ↔ repeating trigger | 13 | 7 | 0.8% |
| Self-sacrifice ↔ once-per-turn trigger | 26 | 7 | 1.6% |
| Ramp ↔ trigger, ink on the turn it can't fire | 3 | 5 | 0.2% |
| Cost reduction ↔ cost reduction (overlapping targets) | 71 | 6 | 4.3% |
| Ramp ↔ ramp | 701 | 5 | 42.2% |
| Trigger ↔ trigger | 3 | 5 | 0.2% |
| Ramp ↔ cost reduction | 715 | 5 | 43.0% |
| Trigger ↔ cost reduction | 57 | 5 | 3.4% |
<!-- coverage:end -->

The 7 pairs aren't inflation: they're the ramp ↔ trigger chains, the only real mechanical chain in the playstyle. Every chain scores 7, whether the trigger repeats or pays off once a turn; how many chains there are follows how many trigger cards the pool holds. A broad density floor with rare, mechanically real spikes is the right curve. The scores and explanation templates live in `tuning.json`, and the table reads both from the engine.

### Explanation Templates

The templates live in `tuning.json` (`ruleTexts.ramp.templates`). A two-role template names each card by its role (`{RAMP}`, `{TRIGGER}`, `{COST}`), which the engine swaps for the `{A}`/`{B}` chips; a same-role template names them `{A}` and `{B}` directly. `tuning.test.ts` fails on a template that drops a card.

| Pair | Template |
|------|----------|
| Ramp ↔ Trigger | "{RAMP} adds ink to your inkwell, triggering {TRIGGER}'s inkwell effect." |
| Ramp ↔ Ramp | "{A} and {B} both put extra cards into your inkwell, getting you ahead faster." |
| Ramp ↔ Cost Reduction | "{RAMP} adds extra ink, {COST} discounts your plays." |
| Trigger ↔ Trigger | "{A} and {B} both trigger when cards go into your inkwell." |
| Cost ↔ Cost | "{A} and {B} both give ink discounts which stack." |
| Trigger ↔ Cost | "{TRIGGER} rewards cards going into your inkwell, and {COST} gives ink discounts." |

A ramp ↔ trigger pair on different turns uses the engine's same-deck line, "{A} and {B} both go in a Ramp deck.", which lives in code, not `tuning.json`.

---

## Coverage

<!-- coverage:start coverage -->
**60 total ramp cards**:

| Role | Cards | Sub-patterns | Cards per ink |
|----|-----|------------|-------------|
| Inkwell Ramp | 38 | 25 deck ramp + 13 self-sacrifice | Sapphire 36, Emerald 2, Amber 1 |
| Inkwell Triggers | 3 | 1 repeating + 2 once-per-turn | Sapphire 3 |
| Cost Reduction | 19 | Exert/Quest/Passive activation | Amber 9, Sapphire 3, Amethyst 2, Emerald 2, Ruby 2, Steel 1 |
<!-- coverage:end -->

Inkwell ramp is Sapphire's identity mechanic and cost reduction is Amber's support identity; the ink columns show how the live pool splits.

---

## Excluded Card Categories

| Category | Reason |
|----------|--------|
| Opponent Ink | Removal, not ramp — doesn't fire your triggers or give you ink |
| Self-Discount Payoffs | "Pay X less to play **this**" — built-in discount, too self-contained |
| Named Discounts | "Pay X less to play characters **named Gurgi**" — helps one partner, which Named Companions pairs |
| Free Play Grants | Bypass mana entirely — separate mechanic, doesn't benefit from more ink |
| High-cost generic | Original issue suggested cost 6+ as payoffs — too broad, no synergy signal |

---

## Test Coverage

The tests read every tuned score they expect from `tuning.json` (`ruleTexts.ramp.scores`), never as a literal, because admin's tuning editor changes those scores (the chain-key routing tests below set test-only scores of their own). CI's `test:perturbed` run changes every tuned value, giving each Ramp score a value no other holds, and fails a test that pins one or reads the wrong key.

In `ramp.test.ts`, under `describe('Ramp')`:

### Role Detection (10 tests)
- Deck ramp detection (Mama Odie, One Jump Ahead)
- Self-sacrifice detection (Winnie the Pooh)
- Repeating trigger detection (Jafar, Amber Coil)
- Once-per-turn trigger detection (Raya)
- Variant wording trigger (Fairy Godmother's Wand)
- Cost reduction grant detection (Pluto, Lantern)
- Cost reduction target types (character for Pluto and Lantern, location for Elsa - Concerned Sister)
- Opponent-ink exclusion (Hide Away, Wipe Out!)
- Self-discount exclusion (Kristoff)
- Unrelated card exclusion

### Scoring (10 tests)
- All 9 entries in the scoring matrix verified with specific card pairs
- Two cost reductions for different card types don't pair (Pluto, Elsa - Concerned Sister)

### Integration (4 tests)
- No synergies with unrelated cards
- No synergies for excluded opponent-ink cards
- Explanations are non-empty and mention ink
- All matches marked bidirectional

### Misread fixes (`ramp.test.ts`, 7 tests, real card text)
- A discount for the cards of one name (Munchings and Crunchings, Carl Fredricksen - Loving Husband) gains no cost-reduction role, and pairs with no general discount (Pluto - Friendly Pooch)
- A trigger that grants a keyword until your next turn (Fairy Godmother's Wand) reads as once per turn, not repeating
- Ink put into your inkwell from your discard (Jiminy Cricket - Ghost of Christmas Past) reads as ramp from that clause alone, with or without his Boost reminder
- A deck look reads as deck ramp only when the look's own cards go into your inkwell (What Else Can I Do?); Closet Door Portal, which puts itself into your inkwell after its look, is ramp but not deck ramp, and still chains with triggers

### Off-turn ink (`ramp.test.ts`, 3 tests)
- Ink that lands on the opponent's turn (Ink Amplifier) pairs with a trigger that fires only during your turn (Scrooge McDuck - Miserly Ebenezer, Chief Tui - Weaving a Tale) at density, from either side; ramp on your own turn (Mama Odie) keeps the chain

### Chain-key routing (`ramp.test.ts`, 4 tests)
- With test-only scores of 9, 8 and 6, each chain shape reads its own tuning key (`chain.deckRepeating`, `chain.mixed`, `chain.neither`) from either card, so a routing bug fails a test even while the tuned scores tie. From the trigger card's side the test also checks that the explanation names the ramp card {B} (`tuning-equivalence.test.ts` checks that it names the ramp card {A} from the ramp card's side)

---

## Design Decisions

### Why three roles instead of two?
The original issue (#42) proposed just inkwell ramp + high-cost payoffs. Card data analysis revealed that "ramp" in Lorcana is actually three distinct mechanics: inkwell additions, inkwell triggers, and cost reduction. Triggers have a direct mechanic chain with ramp (each ink fires the trigger), while cost reduction provides a parallel path. Collapsing to two roles would miss the trigger synergy entirely.

### Why exclude opponent ink?
Cards like Hide Away and Wipe Out! share the word "inkwell" with ramp cards but do the opposite: they remove an opponent's card by tucking it into the opponent's inkwell. They don't fire YOUR triggers and don't give YOU more ink. Including them would create false synergies.

### Why not include free play effects?
Free play ("play X for free") bypasses mana entirely rather than accelerating it. A card that plays something for free doesn't benefit from having more ink — the ink is irrelevant. Free play could be its own future rule.

### Why sub-pattern scoring?
On paper not all ramp↔trigger pairs are equal: deck ramp (free mana) + repeating trigger (fires every ink) is strictly better than self-sacrifice (card cost) + once-per-turn (capped), and the ladder ran 7-9 to show it. Community votes rate the shapes alike, so community-vote tuning moved deck ramp + repeating trigger to 8 and then 7, and the mixed shapes to 7, in `tuning.json`. The shapes now share both score and explanation; their separate keys let later votes split them again.
