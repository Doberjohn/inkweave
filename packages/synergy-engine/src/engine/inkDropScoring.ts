import type {LorcanaCard} from '../types';
import {
  type InkDropRole,
  getInkDropGain,
  isDropHoldPayoff,
  isDropRemoveTrigger,
  isDropSink,
  isDropSpendRider,
  isOpponentGatedDrop,
  isRepeatingDropMaker,
} from '../utils';

// ============================================
// INK DROPS SCORING (Set 14, payoff-anchored, 5-baseline)
// ============================================
//
// Kept in its own module so it does not lift ruleScoring.ts's mean complexity.

type PairResult = {score: number; explanation: string};

/** A maker facing a payoff, with the actor tokens assigned so the maker always reads as {M}. */
interface InkDropPairCtx {
  maker: LorcanaCard;
  payoff: LorcanaCard;
  makerToken: '{A}' | '{B}';
  payoffToken: '{A}' | '{B}';
}

/**
 * Orient a pair as maker → payoff, or null when neither side is a maker facing a payoff (maker↔maker
 * density, or payoff↔payoff). A card with both roles (none today) is tried as the searcher's maker
 * first, then as its payoff, so it pairs as a maker against payoffs and as a payoff against makers.
 */
function buildInkDropPairCtx(
  card: LorcanaCard,
  cardRoles: InkDropRole[],
  other: LorcanaCard,
  otherRoles: InkDropRole[],
): InkDropPairCtx | null {
  if (cardRoles.includes('drop-maker') && otherRoles.includes('drop-payoff')) {
    return {maker: card, payoff: other, makerToken: '{A}', payoffToken: '{B}'};
  }
  if (otherRoles.includes('drop-maker') && cardRoles.includes('drop-payoff')) {
    return {maker: other, payoff: card, makerToken: '{B}', payoffToken: '{A}'};
  }
  return null;
}

/** One maker↔payoff scoring row. `{M}` / `{P}` in the template are the maker / payoff tokens. */
interface InkDropTier {
  applies: (maker: LorcanaCard, payoff: LorcanaCard) => boolean;
  score: number;
  template: string;
}

/**
 * The maker↔payoff matrix; the highest applicable row wins. Every row above 5 states its one-sentence
 * interaction in the template. 8 is kept for a steady maker feeding a per-turn payoff (a draw each
 * turn, a permanent inkwell card per drop); a one-shot drop that switches a rider on is 7.
 */
const INK_DROP_TIERS: readonly InkDropTier[] = [
  {
    applies: (_maker, payoff) => isDropSpendRider(payoff),
    score: 7,
    template: '{M} banks the ink drop you remove to play {P}, switching on its bonus.',
  },
  {
    applies: (maker, payoff) => isDropRemoveTrigger(payoff) && isRepeatingDropMaker(maker),
    score: 8,
    template: '{M} keeps making ink drops, and spending one each turn draws a card off {P}.',
  },
  {
    applies: (maker, payoff) => isDropRemoveTrigger(payoff) && !isRepeatingDropMaker(maker),
    score: 6,
    template: '{M} banks an ink drop, and spending it fires {P}.',
  },
  {
    applies: (maker, payoff) => isDropHoldPayoff(payoff) && !isRepeatingDropMaker(maker),
    score: 6,
    template: "{M} banks an ink drop, and holding it keeps {P}'s bonus on.",
  },
  {
    applies: (maker, payoff) => isDropHoldPayoff(payoff) && isRepeatingDropMaker(maker),
    score: 7,
    template: '{M} keeps making ink drops, so you can spend some and still hold one for {P}.',
  },
  {
    applies: (maker, payoff) => isDropSink(payoff) && !isRepeatingDropMaker(maker),
    score: 6,
    template: '{P} turns the drop {M} makes into a permanent inkwell card.',
  },
  {
    applies: (maker, payoff) => isDropSink(payoff) && getInkDropGain(maker) >= 2,
    score: 7,
    template: "{M} gets the 2 drops {P}'s Shift removes in one go.",
  },
  {
    applies: (maker, payoff) => isDropSink(payoff) && isRepeatingDropMaker(maker),
    score: 8,
    template: 'Each drop {M} makes becomes a permanent inkwell card through {P}.',
  },
];

/** The highest-scoring row that applies to this maker and payoff (first listed wins a tie). */
function bestInkDropTier(maker: LorcanaCard, payoff: LorcanaCard): InkDropTier | null {
  return INK_DROP_TIERS.filter((tier) => tier.applies(maker, payoff)).reduce<InkDropTier | null>(
    (best, tier) => (best === null || tier.score > best.score ? tier : best),
    null,
  );
}

/**
 * Fill the tokens, then apply the opponent gate: when the opponent decides whether the maker's drop
 * reaches you (This Is Business, Shere Khan - Opportunistic Tycoon, Go Go Tomago), the pair takes -1,
 * floored at 5 and applied once. A shared maker takes no penalty: the opponent's free drop is a cost
 * of that card in every deck, not of this pair.
 */
function applyInkDropGate(tier: InkDropTier, ctx: InkDropPairCtx): PairResult {
  const explanation = tier.template
    .replaceAll('{M}', ctx.makerToken)
    .replaceAll('{P}', ctx.payoffToken);
  if (!isOpponentGatedDrop(ctx.maker)) return {score: tier.score, explanation};
  return {
    score: Math.max(5, tier.score - 1),
    explanation: `${explanation} The opponent decides whether you get the drop.`,
  };
}

/**
 * Two hold payoffs share one banked drop without spending it (6). Every other payoff pair is null:
 * two spend riders consume the same drop, spending breaks a hold, Madam Mim's remove trigger fires
 * on any removal (so a spend rider adds nothing specific to it), and Baymax - Amped Up diverts new
 * drops into the inkwell.
 */
function scoreInkDropHoldPair(card: LorcanaCard, other: LorcanaCard): PairResult | null {
  if (!isDropHoldPayoff(card) || !isDropHoldPayoff(other)) return null;
  return {score: 6, explanation: 'One held ink drop switches on both {A} and {B}.'};
}

/**
 * Score an Ink Drops pair (payoff-anchored: maker↔maker density is dropped by returning null). The
 * matrix is INK_DROP_TIERS; payoff↔payoff pairs score only when both hold a drop (6), see
 * scoreInkDropHoldPair.
 *
 * `card` is the searcher (token {A}); `other` the partner ({B}). The context builder swaps tokens so
 * the maker always reads as the actor.
 */
export function scoreInkDropPair(
  card: LorcanaCard,
  cardRoles: InkDropRole[],
  other: LorcanaCard,
  otherRoles: InkDropRole[],
): PairResult | null {
  const ctx = buildInkDropPairCtx(card, cardRoles, other, otherRoles);
  if (ctx === null) {
    const bothPayoffs = cardRoles.includes('drop-payoff') && otherRoles.includes('drop-payoff');
    return bothPayoffs ? scoreInkDropHoldPair(card, other) : null;
  }
  const tier = bestInkDropTier(ctx.maker, ctx.payoff);
  return tier === null ? null : applyInkDropGate(tier, ctx);
}
