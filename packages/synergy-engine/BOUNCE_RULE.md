# Bounce Synergy Rule ("return from play to hand")

Playstyle rule for the **Bounce** axis: return a card from play back to a hand, either to re-fire your own enter-play ability (self-bounce) or to buy tempo against the opponent (opponent-bounce).

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `ruleScoring.ts`, `utils/cardHelpers.ts`
**Rule ID**: `bounce`
**Category**: `playstyle`
**Playstyle ID**: `bounce`

---

## Overview

Bounce splits into two mechanically opposite halves that never combo with each other and have **disjoint payoffs**:

- **Self-bounce** returns one of *your own* characters to *your* hand so you can replay it and re-fire its "when you play this character" (ETB) ability. Its payoff is a **re-buyable ETB body** — a character whose enter-play effect is worth doing twice.
- **Opponent-bounce** returns a body to *their player's* hand as tempo/removal. Its payoff is the single **return-payoff** in the game, Maleficent's Staff, which skims a lore off every opponent return.
- **Flexible** cards ("return chosen character/item/location to their player's hand", no side restriction) hit *both* sides, so they act as a self-bounce enabler **and** an opponent-bounce.

The rule is **payoff-anchored** (like Floodborn and Items): a pair scores only when one side is a payoff. Two plain bounce enablers, and two payoffs, never synergize with each other.

### Example

Self-bounce **Madam Mim - Elephant** + re-buyable ETB **Merlin - Turtle** = 8: bounce Merlin back, replay him, and re-fire his deck-dig enter-play ability on your terms.

---

## Roles (`getBounceRoles`)

Multi-role allowed (a self-bounce enabler that is itself a re-buyable ETB body carries both and self-pairs). Detection runs on `normalizeCardText`. A fast pre-filter `/return|is returned|when you play this character/i` is deliberately broad — a re-buyable body need not contain "return", so a return-only prefilter would silently drop the whole re-buy pool.

| Role | Count | What it is | Detection |
|------|-------|------------|-----------|
| `self-bounce` | 10 | Return a chosen OWN body to your hand (enabler) | `return … chosen … characters of yours … to your hand` |
| `flexible` | 18 | Un-restricted "return chosen … to their player's hand" — both sides | flex pattern gated `!of yours` `!opposing/opponent's` |
| `opponent-bounce` | 9 | Return a body to their player's hand (tempo/removal) | `return … to their player's hand` AND not flexible |
| `return-payoff` | 1 | Lore whenever a card is returned to hand from play (Maleficent's Staff) | `when(ever) … is returned to … hand` |
| `rebuy-payoff` | 35 | A "when you play this character" ETB worth re-firing (draw 2+, search, free-play, banish-chosen); Shift bodies excluded | ETB pattern AND re-fire-value pattern AND `isCharacter` AND `!hasAnyShift` |

**Disjointness (by construction):** kept out of Self-Discard's "from your discard" reanimator (a bounce returns from *play*, not the bin) and Challenge Matters' "banished in a challenge" combat-recursion (no `banish` verb participates). Shift re-buy bodies are excluded because the Shift Targets rule already surfaces that connection.

**Accepted overlap:** the 35-card re-buy pool overlaps Hero / Self-Discard / Items by nature (a good enter-play body is a good enter-play body). This is documented cross-playstyle composition — the *re-fire* interaction Bounce scores is distinct from what those rules score, and the engine cannot query another rule's coverage without a two-pass architecture.

---

## Scoring (payoff-anchored, 5-baseline)

`scoreBouncePair` returns `null` for enabler↔enabler, same-side, and payoff↔payoff pairs, which `tribalFindSynergies` drops. `{A}`/`{B}` token-swap keeps the bounce side reading as the actor.

| Pair | Score | Explanation |
|------|-------|-------------|
| enabler (self-bounce \| flexible) ↔ rebuy-payoff | **8** | `{A} returns {B} to your hand, re-firing its enter-play ability.` |
| opponent-side (opponent-bounce \| flexible) ↔ return-payoff | **6** | `{A} keeps bouncing the opponent's board while {B} skims 1 lore off every return.` |
| everything else | (not generated) | payoff-anchored |

8 mirrors Sacrifice `self-banish ↔ banish-trigger` and Self-Discard `enabler ↔ reanimator` (a win-condition combo — the bounce guarantees the ETB re-fire on your terms). 6 mirrors Lore Denial `burn ↔ steal` (a complementary tempo effect plus a lore trickle, not a snowball).

---

## Coverage

- **Roles**: self-bounce 10, flexible 18, opponent-bounce 9, return-payoff 1, rebuy-payoff 35; **72 distinct participating cards**.
- **864 ink-compatible pairs** — **840 at 8** (97%), **24 at 6**. The high 8-share is structural (28 enablers × 35 re-buy payoffs), the same shape the docs note for Sacrifice and Self-Discard where few enablers pair against a deep payoff pool.
- Amethyst/Emerald-concentrated enablers; the re-buy pool spans all six inks.
- Closes **13 currently-zero-synergy cards**, including the gallery hero **Tigger - Bouncing All the Way** (2500), Vixey (13046), Narrow Escape (13069), Begone! (2250), and four Hades bodies.

---

## Test coverage

`packages/synergy-engine/src/__tests__/rules.test.ts` → `describe('Bounce rule (return from play to hand)')`: role detection (all 5 roles + the multi-role self+rebuy body), exclusions (from-discard recursion, Shift ETB bodies), and scoring (enabler↔rebuy=8 with the token-swap, flexible-as-enabler, opponent↔Staff=6, and the payoff-anchored drop).
