# Exert Synergy Rule ("Exert Matters")

Detailed documentation for the Exert rule, a payoff-anchored playstyle that detects the opponent-facing exert-as-removal archetype. This is a clean, tightly-scoped revival of the archived `exert-synergies` rule (see [`REMOVED_RULES.md`](REMOVED_RULES.md)).

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/detection/exert.ts`
**Rule ID**: `exert`
**Category**: `playstyle`
**Playstyle ID**: `exert`

---

## Overview

The Exert archetype is a two-role strategy: **exert-enablers** are effects that exert an *opposing* character (a soft-tap removal that keeps the body from questing or challenging next turn), while **exert-payoffs** consume or reward an already-exerted opposing body: banish it, lock it (can't ready), or scale off its exerted state.

Like Sacrifice and Discard, this is an asymmetric-role playstyle: the enabler *creates* the exerted body that the payoff *exploits*. It is **payoff-anchored** — two exert-enablers do not synergize with each other (parallel soft-removal that never compounds), so the rule emits a pair only when at least one side is a payoff. A deck of all enablers just taps bodies; the payoffs turn that tap into a kill or a hard lock.

The archetype is mono-**Amethyst** in practice (Coverage counts each role's inks), so a real deck lives in an Amethyst pairing.

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

Detection uses a fast pre-filter (`HAS_EXERT = /exert/i`) before running the patterns. A card can in principle hold both roles; Coverage counts any that do.

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
| **Inkwell ramp** | The "into your inkwell facedown **and exerted**" ramp cards put YOUR (or the opponent's) card into an inkwell exerted — a ramp/tempo mechanic, not opposing-body removal. Excluded because they never match the `exert <opposing> character` effect shape, and none carry a payoff pattern. Coverage counts them and checks that none gains an exert role. |
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
| exert-enabler ↔ a payoff it can't reach | **5** | Weak | The payoff acts only on a character stronger than any the enabler exerts (see [Strength caps and floors](#strength-caps-and-floors)), so the two just share the deck |
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

The same-side payoff pair names both cards: `"{A} and {B} both benefit when opposing characters are exerted."` None of these payoffs exerts anything itself; each cashes in on an opposing character that is already exerted. An enabler next to a payoff it can't reach names both cards too: `"{A} and {B} both go in an Exert deck."`

### Strength caps and floors

Some enablers exert only a weak character, and some payoffs act only on a strong one:

| Side | Shape | Card |
|------|-------|------|
| enabler cap | "Exert all opposing characters **with 2 ¤ or less**." | Ghostly Tale |
| enabler cap | "exert chosen opposing character **with 2 ¤ or less**." | Tinker Bell - Temperamental Fairy, Scream Canister |
| payoff floor | "banish chosen exerted character **with 5 ¤ or more**." | Minnie Mouse - Sweetheart Princess |

`exertEnablerReachesPayoff` reads them sentence by sentence. The enabler's reach is the highest cap among its exert effects (none when one of them has no cap), and the payoff's floor is the lowest among its payoff effects (none when one of them has no floor). When the floor sits above the reach, the enabler never exerts a character the payoff can act on, so the pair scores 5 instead of the combo.

### Live distribution

<!-- coverage:start distribution -->
Counted by `pnpm refresh-rule-coverage` over the Core cards in the synergy pool (sets 9-14).

**126 unique pairs** after the engine's ink-compatibility filter (`canShareDeck`):

| Pair shape | Pairs | Score | Share |
|----------|-----|-----|-----|
| enabler ↔ consume payoff | 72 | 8 | 57.1% |
| enabler ↔ state payoff | 30 | 6 | 23.8% |
| payoff ↔ payoff | 21 | 5 | 16.7% |
| enabler ↔ a payoff it can't reach | 3 | 5 | 2.4% |
<!-- coverage:end -->

The score-8 share runs high because the consume payoffs are the archetype's identity and every enabler pairs against them. `enabler ↔ enabler` pairs are dropped entirely (payoff-anchored).

---

## Coverage

<!-- coverage:start coverage -->
- **15 exert-enablers** (Amethyst 12, Ruby 3): Alma Madrigal - Keeper of the Flame, Alma Madrigal - Leading the Way, Can't Hold It Back Anymore, Demona - Scourge of the Wyvern Clan, Elsa - Snow Queen, Frozone - Super Cool, Ghostly Tale, Isis Vanderchill - Ice Queen of St. Canard, Last-Ditch Effort, Maleficent - Imperious Traveler, Peter Pan's Shadow - Elusive Prankster, Petrify, Scream Canister, Tinker Bell - Temperamental Fairy, Ursula - Voice Stealer
- **7 exert-payoffs** (Amethyst 6, Amber 1): **consume (5)** Grimorum Arcanorum, I'm Stuck!, Ming Lee - Overprotective Parent, Minnie Mouse - Sweetheart Princess, Pot of Honey; **state (2)** Dolores Madrigal - Easy Listener, Pocahontas - Following the Wind

Cards with a role: 22. Cards with more than one: 0.

Cards that put a card into an inkwell "facedown and exerted": 48, of which 0 gain an exert role.

```chart
{
  "type": "doughnut",
  "title": "Role composition (22 cards)",
  "data": {
    "labels": ["Enablers (15)", "Consume payoffs (5)", "State payoffs (2)"],
    "values": [15, 5, 2]
  }
}
```
<!-- coverage:end -->

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/exert.test.ts`: `describe('Exert rule (Exert Matters)')`, then strength caps and floors.

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

### Strength caps and floors (3 tests, `exert.test.ts`)

Real text of Minnie Mouse - Sweetheart Princess, Ghostly Tale, Scream Canister, Petrify and I'm Stuck!.

| Test | What it verifies |
|------|------------------|
| reads whether an enabler reaches the payoff | `exertEnablerReachesPayoff`: a 2 ¤ cap misses Minnie's 5 ¤ floor; an uncapped enabler or an unfloored payoff always meets |
| a capped enabler with a payoff it can't reach → 5 | Ghostly Tale or Scream Canister ↔ Minnie → 5 from either side, the same-deck line |
| keeps the combo when the enabler reaches | Petrify ↔ Minnie and Ghostly Tale ↔ I'm Stuck! → 8 |

---

## Design Decisions and Rationale

### Why revive the archived `exert-synergies` rule?

The original (see REMOVED_RULES.md) fired one-directionally, used no scoring nuance, and matched on loose `textContains(card, 'exerted')` (which swept in Bodyguard reminder text, inkwell-ramp, and self-exert cards). This revival scopes tightly to the **opponent-facing** axis with an enabler/payoff split, a consume-vs-state tier, and payoff-anchoring — the same disciplined shape as Sacrifice and Items.

### Why payoff-anchored?

Two exert-enablers are parallel soft-removal: tapping two opposing bodies doesn't make either tap better. The combo is the enabler feeding a payoff that converts the tap into a kill or a lock. Emitting `enabler ↔ enabler` at 5 would flood every Amethyst removal card's page with low-signal density; dropping it keeps the rule about the actual interaction.

### Why a strength floor above the cap isn't a combo

Ghostly Tale, Tinker Bell - Temperamental Fairy and Scream Canister exert only a character with 2 ¤ or less, and Minnie Mouse - Sweetheart Princess banishes only an exerted character with 5 ¤ or more. The enabler never sets up a body the payoff can banish, so the 8 would promise a combo the cards can't perform. The pairs stay at the 5 same-deck line, where a payoff ↔ payoff pair sits, rather than drop out: both cards still belong in an Exert deck.

### Why the consume/state tier split (8 vs 6)?

A consume payoff (banish, can't-ready lock, exert-trigger) turns the tap into a hard, board-changing punish — a genuine win-condition combo, so 8. A state payoff (gain lore / cost reduction while the opponent has an exerted body) is real value but doesn't remove or lock the body; the enabler merely *maintains* the condition, so 6 (mechanical compounding, not a kill combo).
