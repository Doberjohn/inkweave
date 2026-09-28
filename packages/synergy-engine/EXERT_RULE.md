# Exert Synergy Rule ("Exert Matters")

Detailed documentation for the Exert rule, a payoff-anchored playstyle that detects the opponent-facing exert-as-removal archetype. This is a clean, tightly-scoped revival of the archived `exert-synergies` rule (see [`REMOVED_RULES.md`](REMOVED_RULES.md)).

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/cardHelpers.ts`
**Rule ID**: `exert`
**Category**: `playstyle`
**Playstyle ID**: `exert`

---

## Overview

The Exert archetype is a two-role strategy: **exert-enablers** are effects that exert an *opposing* character (a soft-tap removal that keeps the body from questing or challenging next turn), while **exert-payoffs** consume or reward an already-exerted opposing body: banish it, lock it (can't ready), or scale off its exerted state.

Like Sacrifice and Discard, this is an asymmetric-role playstyle: the enabler *creates* the exerted body that the payoff *exploits*. It is **payoff-anchored** — two exert-enablers do not synergize with each other (parallel soft-removal that never compounds), so the rule emits a pair only when at least one side is a payoff. A deck of all enablers just taps bodies; the payoffs turn that tap into a kill or a hard lock.

The archetype is mono-**Amethyst** in practice (16 of 21 enablers, 10 of 12 payoffs), so a real deck lives in an Amethyst pairing.

### Example

**Enabler**: Petrify (Amethyst Action): "Exert chosen opposing character."
**Payoff**: Te Kā - Elemental Terror (Amethyst-Ruby): "During your turn, whenever an opposing character is exerted, banish them."

Petrify exerts an opposing body → Te Kā's trigger fires → the body is banished outright. A soft tap becomes hard removal.

---

## Role Detection

### Architecture

```typescript
getExertRoles(card: LorcanaCard): ExertRole[]  // ['exert-enabler'] | ['exert-payoff'] | [...both] | []
```

Detection uses a fast pre-filter (`HAS_EXERT = /exert/i`) before running the patterns. A card can in principle hold both roles; none in the live database do (the two roles live on different cards).

### exert-enabler (an effect that exerts an OPPOSING character)

```regex
EXERT_OPPOSING_VERB = /\bexerts?\b\s+(?:up to \d+ )?(?:all |each )?(?:chosen |target )?(?:opposing|opponent'?s)/i
HAS_OPPOSING_CHAR   = /opposing (?:\w+ ){0,2}character|opponent'?s (?:\w+ ){0,2}character/i
```

Both must match, and the card must NOT be an item-exert. The `(?:\w+ ){0,2}` slot in `HAS_OPPOSING_CHAR` admits an adjective ("exert chosen opposing **ready** character", Ursula - Voice Stealer).

| Shape | Example card text | Card |
|-------|-------------------|------|
| Plain | "**Exert chosen opposing character**." | Petrify |
| On-play | "When you play this character, **exert chosen opposing character**." | Isis Vanderchill |
| On-quest | "Whenever this character quests, **exert chosen opposing character**." | Madam Mim - Cheating Spellcaster |
| Mass | "**Exert all opposing characters** with 2 ¤ or less." | Ghostly Tale |
| Adjective slot | "**exert chosen opposing ready character**." | Ursula - Voice Stealer |

### exert-payoff (consumes/rewards an already-exerted OPPOSING body, without self-exerting)

Five sub-patterns, split into two **tiers** that drive the score against an enabler:

**Consume tier** (score 8 vs an enabler): the payoff turns the exerted body into a kill or hard lock.

```regex
P_TRIGGER        = /when(?:ever)?\s+(?:an?\s+)?(?:opposing|opponent'?s)[^.]{0,40}(?:is|are|gets?|becomes?)\s+exerted/i
P_BANISH_EXERTED = /banish (?:chosen |an? )?exerted (?:opposing )?character/i
P_CANT_READY     = /chosen (?:opposing )?exerted character[^.]{0,30}can'?t ready|exerted character can'?t ready at the start of (?:their|its) next turn/i
```

**State tier** (score 6 vs an enabler): the payoff scales off an opponent having an exerted body, without hard-punishing it.

```regex
P_OPP_EXERT_STATE  = /if an opponent has an exerted character|opponent has an exerted character in play|for each exerted character opponents have/i
P_LORE_OFF_EXERTED = /gain lore equal to[^.]{0,40}chosen exerted character|another chosen exerted character/i
```

| Tier | Shape | Example card text | Card |
|------|-------|-------------------|------|
| consume | exert-trigger | "whenever an opposing character **is/becomes exerted**, banish them." | Te Kā, Grimorum Arcanorum |
| consume | banish-exerted | "**banish chosen exerted character** with 5 ¤ or more." | Minnie Mouse - Sweetheart Princess |
| consume | cant-ready lock | "**Chosen exerted character can't ready** at the start of their next turn." | I'm Stuck!, King of Hearts, Pot of Honey, Ming Lee |
| state | opp-exert-state | "**if an opponent has an exerted character** in play, gain 1 lore." | Honeymaren, Dolores Madrigal |
| state | opp-exert-count | "**For each exerted character opponents have** in play, you pay 1 ⬡ less." | Olaf - Happy Passenger |
| state | lore-off-exerted | "gain lore equal to **another chosen exerted character**'s ◊." | Pocahontas - Following the Wind |

Card text reaches these patterns through `normalizeCardText`, which straightens typographic apostrophes, so the curly `can’t` of Set 13's Ming Lee - Overprotective Parent matches the straight spelling.

### What's Excluded

| Excluded | Pattern / reason |
|----------|------------------|
| **Exert-as-COST** | The `⟳`/`↻` glyph and dash-clause activation costs (`⟳, 2 ⬡ — ...`) are how a card pays to use an ability, not an effect that exerts the opponent. These are excluded *by construction*: enabler detection requires an `exert <opposing>` **effect**, so an ability whose only exert is a `⟳` cost never qualifies. (A card like Elsa - Snow Queen, whose `⟳` activation *produces* an opposing-exert effect, is correctly a genuine enabler.) |
| **Inkwell ramp** | The ~61 "into your inkwell facedown **and exerted**" ramp cards put YOUR (or the opponent's) card into an inkwell exerted — a ramp/tempo mechanic, not opposing-body removal. Excluded because they never match the `exert <opposing> character` effect shape, and none carry a payoff pattern. Verified: 0 of the 61 gain any exert role. |
| **Self-exert-state** | `while this character is exerted` / `if this character is exerted` (Genie - Main Attraction, Hamish/Hubert/Harris) powers a payoff off THIS body being exerted, an engine on your own side, not a consumer of an opponent's exerted body. The `SELF_EXERT_STATE` gate drops the payoff role for these. |
| **Exert-an-item effects** | "exert chosen opposing **item**" (HeiHei - Not-So-Tricky Chicken, Ice Spikes' second ability) taps an item, not a character. The `EXERT_ITEM_ONLY` gate excludes them from both roles. |

---

## Scoring (payoff-anchored, 5-baseline)

Applies the project-wide **5-baseline convention**. The rule mirrors the Floodborn/Items payoff-anchored shape: `enabler ↔ enabler` returns `null` and is never emitted.

### Score Table

| Pair Type | Score | Display Tier | Explanation |
|-----------|-------|-------------|-------------|
| exert-enabler ↔ consume payoff (exert-trigger / banish-exerted / cant-ready lock) | **8** | Strong | Win-condition combo: the enabler exerts an opposing body on demand, and the payoff banishes or hard-locks it |
| exert-enabler ↔ state payoff (opp-exert-state / lore-off-exerted) | **6** | Moderate | The enabler keeps an opposing body exerted, switching on the payoff's exerted-state reward, but doesn't hard-punish it |
| exert-payoff ↔ exert-payoff | **5** | Weak | Parallel payoff density: two exerted-matters payoffs on the same board, no compounding |
| exert-enabler ↔ exert-enabler | **null** | — | Not emitted (payoff-anchored): two soft-taps stack pressure but don't combo |

### Token-swapped explanation

The combo strings use the project `{A}`/`{B}` token convention so the **enabler** always reads as the actor, regardless of which card the user selected:

```typescript
const enablerToken = cardEnabler ? '{A}' : '{B}';
const payoffToken = cardEnabler ? '{B}' : '{A}';
// consume: `${enablerToken} exerts an opposing character, and ${payoffToken} punishes the exerted body.`
// state:   `${enablerToken} keeps an opposing character exerted, switching on ${payoffToken}.`
```

The same-side payoff pair uses a distinct sentence: `"Both reward opposing characters being exerted. Density baseline."`

### Live distribution

**21 exert-enablers + 12 exert-payoffs = 33 cards.** After the engine's ink-compatibility filter (`canShareDeck`), **313 unique pairs**:

| Pair shape | Count | Score | Share |
|------------|-------|-------|-------|
| enabler ↔ consume payoff | 164 | 8 | 52% |
| enabler ↔ state payoff | 84 | 6 | 27% |
| payoff ↔ payoff | 65 | 5 | 21% |

The score-8 share (~52%) runs high because the consume payoffs (8 of 12) are the archetype's identity and every enabler pairs against them. `enabler ↔ enabler` pairs are dropped entirely (payoff-anchored).

---

## Coverage

- **21 exert-enablers** (Amethyst 16, Amethyst-Steel 2, Ruby 3): Petrify, Elsa - The Fifth Spirit, Elsa - Snow Queen, Elsa - Fierce Protector, Peter Pan - Shadow Catcher, Madam Mim - Cheating Spellcaster, Isis Vanderchill, Ursula - Voice Stealer, Last-Ditch Effort, Restoring the Crown, Demona, Can't Hold It Back Anymore, Anna - Mystical Majesty, The Sultan - Royal Apparition, Alma Madrigal (x2), Maleficent - Imperious Traveler, Frozone - Super Cool, Tinker Bell - Temperamental Fairy, Ghostly Tale, Scream Canister
- **12 exert-payoffs** (Amethyst 10, Amethyst-Ruby 1, Amber 1): **consume (8)** Te Kā, Grimorum Arcanorum, Minnie Mouse - Sweetheart Princess, I'm Stuck!, King of Hearts, Pot of Honey, Lose the Way, Ming Lee - Overprotective Parent; **state (4)** Honeymaren, Dolores Madrigal, Olaf - Happy Passenger, Pocahontas - Following the Wind

```chart
{
  "type": "doughnut",
  "title": "Role Composition (33 cards)",
  "data": {
    "labels": ["Enablers (21)", "Consume payoffs (8)", "State payoffs (4)"],
    "values": [21, 8, 4]
  }
}
```

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Exert rule (Exert Matters)')`.

### Role Detection

| Test | What it verifies |
|------|------------------|
| enabler from "Exert chosen opposing character" | Petrify (13066) |
| payoff (consume) from exert-trigger | Te Kā (1487) |
| payoff (consume) from cant-ready lock | I'm Stuck! (1999) |
| payoff (state) from opp-exert-state | Honeymaren (1481) |
| excludes exert-as-cost / `⟳`-only | an activation-cost card gains no enabler role from its cost |
| excludes inkwell ramp | "into your inkwell facedown and exerted" → no role |
| excludes self-exert-state | Genie - Main Attraction (1005) → no payoff |
| excludes item-exert | HeiHei (1345) → no role |

### Scoring

| Test | What it verifies |
|------|------------------|
| enabler ↔ exert-trigger → 8 | Petrify ↔ Te Kā, enabler-as-actor explanation |
| enabler ↔ cant-ready lock → 8 | Petrify ↔ I'm Stuck! |
| enabler ↔ state payoff → 6 | Petrify ↔ Honeymaren |
| enabler ↔ enabler → not emitted | payoff-anchored: Petrify ↔ Elsa - The Fifth Spirit produces no pair |

---

## Design Decisions and Rationale

### Why revive the archived `exert-synergies` rule?

The original (see REMOVED_RULES.md) fired one-directionally, used no scoring nuance, and matched on loose `textContains(card, 'exerted')` (which swept in Bodyguard reminder text, inkwell-ramp, and self-exert cards). This revival scopes tightly to the **opponent-facing** axis with an enabler/payoff split, a consume-vs-state tier, and payoff-anchoring — the same disciplined shape as Sacrifice and Items.

### Why payoff-anchored?

Two exert-enablers are parallel soft-removal: tapping two opposing bodies doesn't make either tap better. The combo is the enabler feeding a payoff that converts the tap into a kill or a lock. Emitting `enabler ↔ enabler` at 5 would flood every Amethyst removal card's page with low-signal density; dropping it keeps the rule about the actual interaction.

### Why the consume/state tier split (8 vs 6)?

A consume payoff (banish, can't-ready lock, exert-trigger) turns the tap into a hard, board-changing punish — a genuine win-condition combo, so 8. A state payoff (gain lore / cost reduction while the opponent has an exerted body) is real value but doesn't remove or lock the body; the enabler merely *maintains* the condition, so 6 (mechanical compounding, not a kill combo).
