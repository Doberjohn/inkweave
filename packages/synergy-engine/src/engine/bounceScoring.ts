import type {BounceRole} from '../utils';

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

/** The re-buy combo (either direction): an enabler on one side, a re-buyable ETB body on the other. */
const isBounceRebuyCombo = (a: BounceRole[], b: BounceRole[]): boolean =>
  (bounceIsEnabler(a) && b.includes('rebuy-payoff')) || (bounceIsEnabler(b) && a.includes('rebuy-payoff'));

/** The tempo combo (either direction): an opponent-side bounce and the lone return-payoff (Maleficent's Staff). */
const isBounceReturnCombo = (a: BounceRole[], b: BounceRole[]): boolean =>
  (bounceIsOpponentSide(a) && b.includes('return-payoff')) ||
  (bounceIsOpponentSide(b) && a.includes('return-payoff'));

/**
 * Score a Bounce pair (payoff-anchored — enabler↔enabler, same-side, and payoff↔payoff density all
 * resolve to null and are dropped by `tribalFindSynergies`). 5-baseline:
 *   - enabler (self-bounce|flexible) ↔ rebuy-payoff      = 8  win-condition: the bounce re-fires the
 *                                                             ETB (mirrors Sacrifice self-banish↔trigger,
 *                                                             Self-Discard enabler↔reanimator)
 *   - opponent-side ↔ return-payoff (Maleficent's Staff) = 6  tempo bounce + a lore trickle
 *
 * `cardRoles` is the searcher (token {A}); `otherRoles` the partner ({B}). The token-swap keeps the
 * bounce side reading as the actor regardless of which card the user selected.
 */
export function scoreBouncePair(
  cardRoles: BounceRole[],
  otherRoles: BounceRole[],
): {score: number; explanation: string} | null {
  if (isBounceRebuyCombo(cardRoles, otherRoles)) {
    const [enabler, payoff] = bounceIsEnabler(cardRoles) ? ['{A}', '{B}'] : ['{B}', '{A}'];
    return {
      score: 8,
      explanation: `${enabler} returns ${payoff} to your hand, re-firing its enter-play ability.`,
    };
  }
  if (isBounceReturnCombo(cardRoles, otherRoles)) {
    const [bounce, payoff] = bounceIsOpponentSide(cardRoles) ? ['{A}', '{B}'] : ['{B}', '{A}'];
    return {
      score: 6,
      explanation: `${bounce} keeps bouncing the opponent's board while ${payoff} skims 1 lore off every return.`,
    };
  }
  // Payoff-on-payoff or any non-combo pair: no compounding interaction → drop (payoff-anchored).
  return null;
}
