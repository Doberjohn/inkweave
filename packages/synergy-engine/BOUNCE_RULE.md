# Bounce Synergy Rule ("return from play to hand")

Playstyle rule for the **Bounce** axis: return a card from play back to a hand, either to re-fire your own enter-play ability (self-bounce) or to buy tempo against the opponent (opponent-bounce).

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `engine/bounceScoring.ts`, `utils/cardHelpers.ts`
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

A re-buy pair also has to be **legal**: the enabler's return clause may carry a cost cap ("with cost 2 or less") or a classification gate ("Seven Dwarfs character of yours"), and a body the enabler cannot target is no synergy at all. See *Target gates*.

### Example

Self-bounce **Madam Mim - Elephant** + re-buyable ETB **Merlin - Turtle** = 8: bounce Merlin back, replay him, and re-fire his deck-dig enter-play ability on your terms.

---

## Roles (`getBounceRoles`)

Multi-role allowed (a self-bounce enabler that is itself a re-buyable ETB body carries both and self-pairs). Detection runs on `normalizeCardText`. A fast pre-filter `/return|is returned|when you play this character/i` is deliberately broad — a re-buyable body need not contain "return", so a return-only prefilter would silently drop the whole re-buy pool.

| Role | Count | What it is | Detection |
|------|-------|------------|-----------|
| `self-bounce` | 6 | Return a chosen OWN body to your hand (enabler) | `return … chosen … characters of yours … to your hand` |
| `flexible` | 11 | Un-restricted "return chosen … to their player's hand" — both sides | flex pattern gated `!of yours` `!opposing/opponent's` |
| `opponent-bounce` | 2 | Return a body to their player's hand (tempo/removal) | `return … to their player's hand` AND not flexible |
| `return-payoff` | 0 | Lore whenever a card is returned to hand from play (Maleficent's Staff, rotated out of Core) | `when(ever) … is returned to … hand` |
| `rebuy-payoff` | 24 | A "when you play this character" ETB worth re-firing (draw 2+, search, free-play, banish-chosen); Shift bodies excluded | ETB pattern AND re-fire-value pattern AND `isCharacter` AND `!hasAnyShift` |

**Disjointness (by construction):** kept out of Self-Discard's "from your discard" reanimator (a bounce returns from *play*, not the bin) and Challenge Matters' "banished in a challenge" combat-recursion (no `banish` verb participates). Shift re-buy bodies are excluded because the Shift Targets rule already surfaces that connection.

**Accepted overlap:** the re-buy pool overlaps Hero / Self-Discard / Items by nature (a good enter-play body is a good enter-play body). This is documented cross-playstyle composition — the *re-fire* interaction Bounce scores is distinct from what those rules score, and the engine cannot query another rule's coverage without a two-pass architecture.

### Target gates (`getBounceTargetGate`, `bounceGateAdmits`)

The role patterns skip over the middle of the return clause with a bounded `[^.]` gap (`{0,50}?` on the self pattern, `{0,80}?` on the flexible and to-their-hand patterns), which is exactly where a targeting restriction lives. Two extra reads recover it:

```regex
cost cap:  /return\s+(?:up to \d+\s+)?(?:another\s+)?chosen\s+[^.]*?\bwith\s+cost\s+(\d+)(?!\s+or\s+more)(?:\s+or\s+less)?\b[^.]*?to\s+(?:your|their\s+player'?s?)\s+hand/i
class gate: /[Rr]eturn\s+(?:another\s+)?chosen\s+([A-Z][\w']*(?:\s+[A-Z][\w']*)*)\s+characters?\s+of\s+yours\b/
```

- The cap read stays inside the return sentence and refuses `cost N or more`, so a song's sing reminder ("A character with cost 2 or more can ⟳ to sing this song") never reads as a cap: Poor Unfortunate Souls carries both phrasings and resolves to cap 2.
- The classification read is case-sensitive on purpose: a capitalised run ("Seven Dwarfs") is a classification, a lowercase adjective ("exerted", "another") is not.
- `bounceGateAdmits(gate, body)` = `body.cost <= costCap` (null = uncapped, admits everything) AND `hasClassification(body, classification)` when one is gated. Precedents for cost-gating a pairing: the Free Play rule's hard `card.cost === 1` filter and the Singer rule's `song.cost <= singerValue`.

Gated enablers in the current pool (9 of 17): Pocahontas & Meeko - Adventurous Friends (cap 1); Poor Unfortunate Souls, Nana - Canine Caregiver, Tigger - Bouncing All the Way, Vixey - Expert Fisher, Narrow Escape, Owen Burnett - Xanatos's Assistant (cap 2); Begone! (cap 3); Snow White - Merry as the Morning (Seven Dwarfs).

**Known limitation:** the gate is read from the card's first matching return clause, not from the specific clause that granted the enabler role, so a card carrying a *capped opponent-side* bounce and a separate *uncapped self-bounce* would have the cap applied to its re-buy pairs. No card in the current pool has that shape (all 17 enablers carry exactly one gate-bearing return clause), and role detection is whole-text for the same reason, so scoping both to a clause is deferred until a card needs it.

---

## Scoring (payoff-anchored, 5-baseline)

`scoreBouncePair` is card-aware (`pairFindSynergies`) so the gate can read the body's cost. It returns `null` for enabler↔enabler, same-side, payoff↔payoff, and gate-rejected re-buy pairs, which the loop drops. The re-buy combo is checked per direction, so the `{A}`/`{B}` token-swap follows whichever side can actually do the bouncing; a symmetric multi-role pair survives when either direction passes.

| Pair | Score | Explanation |
|------|-------|-------------|
| enabler (self-bounce \| flexible) ↔ rebuy-payoff, gate admits the body | **8** | `{A} returns {B} to your hand, re-firing its enter-play ability.` |
| opponent-side (opponent-bounce \| flexible) ↔ return-payoff | **6** | `{A} keeps bouncing the opponent's board while {B} skims 1 lore off every return.` |
| enabler ↔ rebuy-payoff the gate rejects | (dropped) | a cap-2 bouncer cannot re-buy a cost-8 body |
| everything else | (not generated) | payoff-anchored |

8 mirrors Sacrifice `self-banish ↔ banish-trigger` and Self-Discard `enabler ↔ reanimator` (a win-condition combo — the bounce guarantees the ETB re-fire on your terms). 6 mirrors Lore Denial `burn ↔ steal` (a complementary tempo effect plus a lore trickle, not a snowball); with Maleficent's Staff out of Core the 6-tier currently emits nothing.

---

## Coverage (generated from the live engine, sets 9-14 preview)

- **Roles**: self-bounce 6, flexible 11, opponent-bounce 2, return-payoff 0, rebuy-payoff 24; **43 participating cards**.
- **201 ink-compatible pairs, all at 8**; 39 cards carry a Bounce group. Without the target gates, 391 pairs would qualify and 190 of them (49%) are legally impossible: 166 fall to cost caps, 24 to Snow White's Seven Dwarfs gate. Every one of the 24 re-buy bodies loses at least one pair (Madam Mim - Resourceful Trickster, cost 8, would otherwise list the cap-1 Pocahontas & Meeko).
- The capped enablers now pair only with bodies they can reach: Tigger, Poor Unfortunate Souls, Nana, Vixey, Narrow Escape and Owen Burnett - Xanatos's Assistant keep one partner each (Pocahontas - Guiding the Tribe, the lone cost-2 re-buy body), Begone! keeps eight, Pocahontas & Meeko and Snow White keep none here (they still surface through Free Play / Shift Targets and Dwarfs / Hero / Princess respectively).

---

## Test coverage

`packages/synergy-engine/src/__tests__/rules.test.ts` → `describe('Bounce rule (return from play to hand)')`: target-gate parsing (cost cap, uncapped, the "cost N or more" reminder guard, classification), role detection (all 5 roles + the multi-role self+rebuy body), exclusions (from-discard recursion, Shift ETB bodies), and scoring (enabler↔rebuy=8 with the token-swap, flexible-as-enabler against an in-cap body, cap and classification rejections in both directions, a two-enabler pair kept when only one direction passes, opponent↔Staff=6, and the payoff-anchored drop).
