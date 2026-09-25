import type {LorcanaCard} from '../types';
import {type BounceRole, bounceGateAdmits, getBounceTargetGate} from '../utils';

// ============================================
// BOUNCE SCORING (return-from-play-to-hand, payoff-anchored, 5-baseline)
// ============================================
//
// Kept in its own module so it does not lift ruleScoring.ts's mean complexity.

/** An enabler side can return your OWN body (self-bounce, or the un-restricted flexible bounce). */
const bounceIsEnabler = (roles: BounceRole[]): boolean =>
  roles.includes('self-bounce') || roles.includes('flexible');

/** An opponent-side bounce (removal/tempo) — opponent-bounce, or flexible aimed across the table. */
const bounceIsOpponentSide = (roles: BounceRole[]): boolean =>
  roles.includes('opponent-bounce') || roles.includes('flexible');

/** A payoff side: the re-buyable ETB body, or the "when returned" lore payoff. */
export const isBouncePayoff = (roles: BounceRole[]): boolean =>
  roles.includes('rebuy-payoff') || roles.includes('return-payoff');

/**
 * The re-buy combo in ONE direction: `enabler` bounces `payoff`. Besides the roles, the enabler's
 * target gate must admit the payoff: a "cost 2 or less" bouncer cannot re-buy a cost-8 body, so
 * that pair is no synergy at all (dropped, like the Free Play rule's hard cost filter).
 */
const admitsRebuy = (
  enabler: LorcanaCard,
  enablerRoles: BounceRole[],
  payoff: LorcanaCard,
  payoffRoles: BounceRole[],
): boolean =>
  bounceIsEnabler(enablerRoles) &&
  payoffRoles.includes('rebuy-payoff') &&
  bounceGateAdmits(getBounceTargetGate(enabler), payoff);

/** The tempo combo (either direction): an opponent-side bounce and the lone return-payoff (Maleficent's Staff). */
const isBounceReturnCombo = (a: BounceRole[], b: BounceRole[]): boolean =>
  (bounceIsOpponentSide(a) && b.includes('return-payoff')) ||
  (bounceIsOpponentSide(b) && a.includes('return-payoff'));

/** The score-8 re-buy match, with the enabler/payoff tokens already in actor order. */
const rebuyResult = (enabler: string, payoff: string): {score: number; explanation: string} => ({
  score: 8,
  explanation: `${enabler} returns ${payoff} to your hand, re-firing its enter-play ability.`,
});

/**
 * Score a Bounce pair (payoff-anchored — enabler↔enabler, same-side, and payoff↔payoff density all
 * resolve to null and are dropped by `pairFindSynergies`). 5-baseline:
 *   - enabler (self-bounce|flexible) ↔ rebuy-payoff      = 8  win-condition: the bounce re-fires the
 *                                                             ETB (mirrors Sacrifice self-banish↔trigger,
 *                                                             Self-Discard enabler↔reanimator); only when
 *                                                             the enabler's target gate admits the body
 *   - opponent-side ↔ return-payoff (Maleficent's Staff) = 6  tempo bounce + a lore trickle
 *
 * `card` is the searcher (token {A}); `other` the partner ({B}). The re-buy combo is checked per
 * direction so the token-swap follows whichever side can actually do the bouncing.
 */
export function scoreBouncePair(
  card: LorcanaCard,
  cardRoles: BounceRole[],
  other: LorcanaCard,
  otherRoles: BounceRole[],
): {score: number; explanation: string} | null {
  if (admitsRebuy(card, cardRoles, other, otherRoles)) return rebuyResult('{A}', '{B}');
  if (admitsRebuy(other, otherRoles, card, cardRoles)) return rebuyResult('{B}', '{A}');
  if (isBounceReturnCombo(cardRoles, otherRoles)) {
    const [bounce, payoff] = bounceIsOpponentSide(cardRoles) ? ['{A}', '{B}'] : ['{B}', '{A}'];
    return {
      score: 6,
      explanation: `${bounce} keeps bouncing the opponent's board while ${payoff} skims 1 lore off every return.`,
    };
  }
  // Payoff-on-payoff, non-combo, or a gate-rejected re-buy: no compounding interaction → drop.
  return null;
}
