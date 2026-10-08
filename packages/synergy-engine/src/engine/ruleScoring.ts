import type {
  LorcanaCard,
  PlaystyleId,
  PlaystyleSynergyRule,
  SynergyMatch,
  SynergyRule,
} from '../types';
import {
  getTribalRoles,
  isTribalCard,
  isDeckRamp,
  isRepeatingTrigger,
  costReductionTargetsOverlap,
  isExertConsumePayoff,
  selfDiscardOutletFeeds,
  type DiscardRole,
  type LoreDenialRole,
  type RampRole,
  type SacrificeRole,
  type SelfDiscardRole,
  type ToyRole,
  type DwarfsRole,
  type FloodbornRole,
  type HunnyRole,
  type RedPandaRole,
  type ItemRole,
  type HealRole,
  type ExertRole,
  type TribalRole,
  type TribalSpec,
} from '../utils';
import {TUNING} from '../data/tuning';

// ============================================
// SHARED TRIBAL SCORING HELPERS
// ============================================

/** Direction-agnostic role-cross matcher: true iff one side has `x` and the other has `y`. */
export function crossMatcher<T extends string>(aRoles: T[], bRoles: T[]): (x: T, y: T) => boolean {
  const a = new Set(aRoles);
  const b = new Set(bRoles);
  return (x, y) => (a.has(x) && b.has(y)) || (b.has(x) && a.has(y));
}

/**
 * Shared tribal `findSynergies` loop: pair the card against every other role-bearing
 * card, scoring each via `scorePair`. A `null` result skips the pair (the payoff-anchored
 * Floodborns rule uses this to drop member-member pairs).
 */
export function tribalFindSynergies<R>(
  card: LorcanaCard,
  allCards: LorcanaCard[],
  getRoles: (c: LorcanaCard) => R[],
  scorePair: (cardRoles: R[], otherRoles: R[]) => {score: number; explanation: string} | null,
): SynergyMatch[] {
  const cardRoles = getRoles(card);
  if (cardRoles.length === 0) return [];

  const matches: SynergyMatch[] = [];
  for (const other of allCards) {
    if (other.id === card.id) continue;
    const otherRoles = getRoles(other);
    if (otherRoles.length === 0) continue;
    const result = scorePair(cardRoles, otherRoles);
    if (result === null) continue;
    matches.push({card: other, score: result.score, explanation: result.explanation, bidirectional: true});
  }
  return matches;
}

/**
 * Card-aware pair `findSynergies` loop: like `tribalFindSynergies`, but hands the full card
 * objects to `scorePair` (the exert / token-swap scorers read the card, not just its roles).
 * A `null` result skips the pair; every emitted match is `{card: other, …, bidirectional: true}`.
 * Shared by the discard / sacrifice / self-discard / toy / dwarfs / exert rules so their
 * findSynergies bodies collapse to one line instead of six duplicated loops.
 */
export function pairFindSynergies<R>(
  card: LorcanaCard,
  allCards: LorcanaCard[],
  getRoles: (c: LorcanaCard) => R[],
  scorePair: (
    card: LorcanaCard,
    cardRoles: R[],
    other: LorcanaCard,
    otherRoles: R[],
  ) => {score: number; explanation: string} | null,
): SynergyMatch[] {
  const cardRoles = getRoles(card);
  if (cardRoles.length === 0) return [];

  const matches: SynergyMatch[] = [];
  for (const other of allCards) {
    if (other.id === card.id) continue;
    const otherRoles = getRoles(other);
    if (otherRoles.length === 0) continue;
    const result = scorePair(card, cardRoles, other, otherRoles);
    if (result === null) continue;
    matches.push({card: other, score: result.score, explanation: result.explanation, bidirectional: true});
  }
  return matches;
}

/**
 * Build a payoff-anchored tribal rule (Floodborns / Items / Healing share one body):
 * a pair scores only when at least one side is a payoff, so the `isPayoff` gate drops
 * pure member↔member / engine↔engine density before delegating to `scorePair`.
 */
export function makePayoffAnchoredRule<R>(
  rule: Omit<PlaystyleSynergyRule, 'findSynergies'>,
  getRoles: (c: LorcanaCard) => R[],
  isPayoff: (roles: R[]) => boolean,
  scorePair: (cardRoles: R[], otherRoles: R[]) => {score: number; explanation: string},
): SynergyRule {
  return {
    ...rule,
    findSynergies: (card, allCards) =>
      tribalFindSynergies(card, allCards, getRoles, (cardRoles, otherRoles) =>
        isPayoff(cardRoles) || isPayoff(otherRoles) ? scorePair(cardRoles, otherRoles) : null,
      ),
  };
}

// ============================================
// DISCARD SCORING
// ============================================

const DISCARD_DISRUPTION_ROLES: readonly DiscardRole[] = ['targeted', 'random', 'standard'];

function hasDiscardDisruption(roles: DiscardRole[]): boolean {
  return roles.some((r) => DISCARD_DISRUPTION_ROLES.includes(r));
}

function isDiscardKillCombo(
  cardDisruption: boolean,
  cardPayoff: boolean,
  otherDisruption: boolean,
  otherPayoff: boolean,
): boolean {
  return (cardDisruption && otherPayoff) || (cardPayoff && otherDisruption);
}

/**
 * Build the 8-score discard kill-combo result: a disruption enabler empties the opponent's
 * hand, powering up the hand-size payoff. `_card` is the searcher (token {A}); `_other` is the
 * partner ({B}), so the disruption side reads as {A} when the searcher holds it.
 */
function scoreDiscardKillCombo(cardDisruption: boolean): {score: number; explanation: string} {
  const disruptionToken = cardDisruption ? '{A}' : '{B}';
  const payoffToken = cardDisruption ? '{B}' : '{A}';
  return {
    score: 8,
    explanation: `${disruptionToken} empties the opponent's hand, powering up ${payoffToken}'s hand-size edge.`,
  };
}

export function scoreDiscardPair(
  _card: LorcanaCard,
  cardRoles: DiscardRole[],
  _other: LorcanaCard,
  otherRoles: DiscardRole[],
): {score: number; explanation: string} {
  const cardDisruption = hasDiscardDisruption(cardRoles);
  const otherDisruption = hasDiscardDisruption(otherRoles);
  const cardPayoff = cardRoles.includes('payoff');
  const otherPayoff = otherRoles.includes('payoff');

  if (isDiscardKillCombo(cardDisruption, cardPayoff, otherDisruption, otherPayoff)) {
    return scoreDiscardKillCombo(cardDisruption);
  }

  // Same-side pair (both disruption or both payoff): density baseline.
  // Two enablers don't compound — they stack pressure. Two payoffs share an axis without amplifying it.
  const bothPayoff = cardPayoff && otherPayoff;
  return {
    score: 5,
    explanation: bothPayoff
      ? `Both reward hand-size advantage over opponents.`
      : `Both disrupt the opponent's hand.`,
  };
}

// ============================================
// SACRIFICE SCORING
// ============================================

/**
 * A sacrifice banish combo is the cross-role pair: one side is the self-banish
 * (banishes your own character on demand) and the other is the banish-trigger
 * (pays off when your character is banished). Same-side pairs are not combos.
 */
function isSacrificeBanishCombo(
  cardSelfBanish: boolean,
  cardPayoff: boolean,
  otherSelfBanish: boolean,
  otherPayoff: boolean,
): boolean {
  return (cardSelfBanish && otherPayoff) || (cardPayoff && otherSelfBanish);
}

/**
 * Score a sacrifice pair (5-baseline convention, mirrors the Discard rule shape):
 *   - self-banish ↔ banish-trigger = 8  (win-condition combo)
 *   - banish-trigger ↔ banish-trigger = 5  (parallel payoff density)
 *   - self-banish ↔ self-banish     = 5  (parallel enablers, still need a payoff)
 *
 * `_card` is the searcher (token {A}); `other` is the partner (token {B}).
 */
/**
 * Build the 8-score sacrifice banish-combo result. Token-swap so the SELF-BANISH side always
 * reads as the actor: it is {A} when the searcher (card) holds the self-banish role, else {B}.
 */
function scoreSacrificeBanishCombo(cardSelfBanish: boolean): {score: number; explanation: string} {
  const selfBanishToken = cardSelfBanish ? '{A}' : '{B}';
  const payoffToken = cardSelfBanish ? '{B}' : '{A}';
  return {
    score: 8,
    explanation: `${selfBanishToken} banishes your own character on demand, guaranteeing ${payoffToken}'s banish payoff.`,
  };
}

export function scoreSacrificePair(
  _card: LorcanaCard,
  cardRoles: SacrificeRole[],
  _other: LorcanaCard,
  otherRoles: SacrificeRole[],
): {score: number; explanation: string} {
  const cardSelfBanish = cardRoles.includes('self-banish');
  const otherSelfBanish = otherRoles.includes('self-banish');
  const cardPayoff = cardRoles.includes('banish-trigger');
  const otherPayoff = otherRoles.includes('banish-trigger');

  const isBanishCombo = isSacrificeBanishCombo(
    cardSelfBanish,
    cardPayoff,
    otherSelfBanish,
    otherPayoff,
  );

  if (isBanishCombo) {
    return scoreSacrificeBanishCombo(cardSelfBanish);
  }

  // Same-side pair: density baseline. Two payoffs share the banish axis without
  // amplifying it; two self-banish cards are parallel enablers that still need a payoff body.
  const bothPayoff = cardPayoff && otherPayoff;
  return {
    score: 5,
    explanation: bothPayoff
      ? `Both pay off when your characters are banished: a board that trades into value.`
      : `Both banish your own characters: parallel self-banish cards.`,
  };
}

// ============================================
// SELF-DISCARD SCORING
// ============================================

/** True iff a self-discard side carries a payoff role (reanimator or state-payoff). */
const isSelfDiscardPayoff = (roles: SelfDiscardRole[]): boolean =>
  roles.includes('reanimator') || roles.includes('state-payoff');

/** Derived flags for a self-discard pair — keeps the scorer a flat guard sequence. */
interface SelfDiscardPairCtx {
  cardEnabler: boolean;
  otherEnabler: boolean;
  /** The enabler↔payoff combo fired: one side is an enabler, the other a payoff. */
  isCombo: boolean;
  bothReanimator: boolean;
  bothEnabler: boolean;
}

/**
 * One direction of the 8 combo: `enabler` is a hand-discard outlet, `payoff` a reanimator or
 * state payoff, and the outlet's discard can actually switch that payoff on.
 */
function feedsSelfDiscardPayoff(
  enabler: LorcanaCard,
  enablerRoles: SelfDiscardRole[],
  payoff: LorcanaCard,
  payoffRoles: SelfDiscardRole[],
): boolean {
  return (
    enablerRoles.includes('enabler') &&
    isSelfDiscardPayoff(payoffRoles) &&
    selfDiscardOutletFeeds(enabler, payoff, payoffRoles)
  );
}

function buildSelfDiscardPairCtx(
  card: LorcanaCard,
  cardRoles: SelfDiscardRole[],
  other: LorcanaCard,
  otherRoles: SelfDiscardRole[],
): SelfDiscardPairCtx {
  const cardEnabler = cardRoles.includes('enabler');
  const otherEnabler = otherRoles.includes('enabler');
  return {
    cardEnabler,
    otherEnabler,
    isCombo:
      feedsSelfDiscardPayoff(card, cardRoles, other, otherRoles) ||
      feedsSelfDiscardPayoff(other, otherRoles, card, cardRoles),
    bothReanimator: cardRoles.includes('reanimator') && otherRoles.includes('reanimator'),
    bothEnabler: cardEnabler && otherEnabler,
  };
}

/**
 * Build the 8-score self-discard combo result: an enabler on one side, a payoff on the
 * other. Token-swap keeps the enabler reading as {A} when the searcher is the enabler; the
 * explanation branches on whether the payoff side is a reanimator or a discard-state payoff.
 */
function scoreSelfDiscardCombo(
  ctx: SelfDiscardPairCtx,
  cardRoles: SelfDiscardRole[],
  otherRoles: SelfDiscardRole[],
): {score: number; explanation: string} {
  const enablerToken = ctx.cardEnabler ? '{A}' : '{B}';
  const payoffToken = ctx.cardEnabler ? '{B}' : '{A}';
  const payoffRoles = ctx.cardEnabler ? otherRoles : cardRoles;
  return {
    score: 8,
    explanation: payoffRoles.includes('reanimator')
      ? `${enablerToken} discards your own cards so ${payoffToken} can replay them from the discard.`
      : `${enablerToken}'s self-discard switches on ${payoffToken}'s discard payoff.`,
  };
}

/** The bin-filling combos: a filler role on one side, the payoff it feeds on the other. */
const SELF_DISCARD_FILL_COMBOS: ReadonlyArray<{
  filler: SelfDiscardRole;
  payoff: SelfDiscardRole;
  explain: (filler: string, payoff: string) => string;
}> = [
  {
    filler: 'enabler',
    payoff: 'zone-payoff',
    explain: (f, p) => `${f} fills your discard from hand, switching on ${p}'s discard-count payoff.`,
  },
  {
    filler: 'mill',
    payoff: 'zone-payoff',
    explain: (f, p) => `${f} mills your deck into the discard, feeding ${p}'s discard-count payoff.`,
  },
  {
    filler: 'mill',
    payoff: 'reanimator',
    explain: (f, p) => `${f} mills cards into your discard for ${p} to replay.`,
  },
];

/**
 * The 7-score fill combo, or null: a bin-filler (hand-discard enabler or mill) on one side and
 * the discard-count / recursion payoff it feeds on the other. Token-swap keeps the filler
 * reading as the actor regardless of which card is the searcher. The first matching row wins,
 * so a card that both loots and mills reads as the hand-discard outlet.
 */
function scoreSelfDiscardFillCombo(
  cardRoles: SelfDiscardRole[],
  otherRoles: SelfDiscardRole[],
): {score: number; explanation: string} | null {
  for (const combo of SELF_DISCARD_FILL_COMBOS) {
    const cardFills = cardRoles.includes(combo.filler) && otherRoles.includes(combo.payoff);
    const otherFills = otherRoles.includes(combo.filler) && cardRoles.includes(combo.payoff);
    if (!cardFills && !otherFills) continue;
    const [filler, payoff] = cardFills ? ['{A}', '{B}'] : ['{B}', '{A}'];
    return {score: 7, explanation: combo.explain(filler, payoff)};
  }
  return null;
}

/**
 * Score a self-discard pair (5-baseline convention, mirrors the Sacrifice shape):
 *   - enabler ↔ payoff (reanimator or state) = 8  (win-condition: discard, then cash it; only
 *                                                 when the outlet's discard can switch it on)
 *   - bin-filler ↔ zone payoff, mill ↔ reanimator = 7  (mechanical compounding: the filler feeds
 *                                                 a discard-count payoff or a recursion engine)
 *   - reanimator ↔ reanimator                = 6  (two recursion engines share one bin)
 *   - all other same-axis pairs              = 5  (parallel density; includes mill ↔ state,
 *                                                 since milling is not a discard event)
 *
 * `card` is the searcher (token {A}); `other` is the partner (token {B}). The token-swap keeps
 * the enabler side reading as the actor regardless of which card is the searcher.
 */
export function scoreSelfDiscardPair(
  card: LorcanaCard,
  cardRoles: SelfDiscardRole[],
  other: LorcanaCard,
  otherRoles: SelfDiscardRole[],
): {score: number; explanation: string} {
  const ctx = buildSelfDiscardPairCtx(card, cardRoles, other, otherRoles);

  // 8 — win-condition combo: an enabler on one side, a payoff (reanimator or state) on the other.
  if (ctx.isCombo) {
    return scoreSelfDiscardCombo(ctx, cardRoles, otherRoles);
  }

  // 7 — a bin-filler feeding a discard-count payoff, or mill feeding a recursion engine.
  const fill = scoreSelfDiscardFillCombo(cardRoles, otherRoles);
  if (fill) return fill;

  // 6 — two recursion engines mining the same discard pile.
  if (ctx.bothReanimator) {
    return {
      score: 6,
      explanation: `Both replay cards from your discard: two recursion engines sharing one bin.`,
    };
  }

  // 5 — same-axis density: parallel enablers, or two payoffs that do not compound.
  return {
    score: 5,
    explanation: ctx.bothEnabler
      ? `Both fill your own discard: parallel self-discard outlets.`
      : `Same discard-matters axis without compounding.`,
  };
}

// ============================================
// LORE DENIAL SCORING
// ============================================

/**
 * Score a Lore Denial pair based on the role mix.
 *
 * Convention: 5 = neutral baseline (same strategy, no compounding interaction).
 * Bumps above 5 reflect mechanical efficiency: steal swings the lore race in
 * both directions per point (opponent down + you up), burn only one direction.
 *
 * Matrix:
 *   - burn ↔ burn   = 5 (parallel pressure, no compounding)
 *   - burn ↔ steal  = 6 (complementary — pressure + race-close)
 *   - steal ↔ steal = 7 (double swing engine — every trigger advances both axes)
 */
/**
 * Score the mixed burn ↔ steal Lore Denial pair (6). A is the searcher (modal cardA /
 * left card), B is the partner; the token-swap keeps burn and steal reading correctly
 * based on which role the searcher holds.
 */
function scoreLoreDenialMixed(roleA: LoreDenialRole): {score: number; explanation: string} {
  const burnIsA = roleA === 'burn';
  const burnToken = burnIsA ? '{A}' : '{B}';
  const stealToken = burnIsA ? '{B}' : '{A}';
  return {
    score: 6,
    explanation: `${burnToken} pushes opponents down. ${stealToken} pulls you up. Both ends pressed.`,
  };
}

export function scoreLoreDenialPair(
  roleA: LoreDenialRole,
  roleB: LoreDenialRole,
  _cardA: LorcanaCard,
  _cardB: LorcanaCard,
): {score: number; explanation: string} {
  if (roleA === 'steal' && roleB === 'steal') {
    return {
      score: 7,
      explanation: `Both steal lore. Every trigger swings the race twice in your favor.`,
    };
  }
  if (roleA === 'burn' && roleB === 'burn') {
    return {
      score: 5,
      explanation: `Both make opponents lose lore. Stacks the denial pressure.`,
    };
  }
  return scoreLoreDenialMixed(roleA);
}

// ============================================
// RAMP SCORING
// ============================================

const RAMP = TUNING.ruleTexts.ramp;

/**
 * Tags every ramp pair by role mix. The tag drives both scoring and explanation
 * generation, replacing the repeated boolean-flag arithmetic that lived in both.
 */
type RampPairShape =
  | 'ramp-trigger'
  | 'cost-cost'
  | 'ramp-ramp'
  | 'trigger-trigger'
  | 'ramp-cost'
  | 'trigger-cost';

interface RampPairFlags {
  shape: RampPairShape;
  rampCard: LorcanaCard; // valid when shape involves 'inkwell-ramp'
  triggerCard: LorcanaCard; // valid when shape involves 'inkwell-trigger'
  costCard: LorcanaCard; // valid when shape involves 'cost-reduction'
}

interface RampRoleFlags {
  ramp: boolean;
  trigger: boolean;
  cost: boolean;
}

function rampRoleFlags(roles: RampRole[]): RampRoleFlags {
  return {
    ramp: roles.includes('inkwell-ramp'),
    trigger: roles.includes('inkwell-trigger'),
    cost: roles.includes('cost-reduction'),
  };
}

/** True iff one card has roleX and the other has roleY (regardless of which side). */
function hasMixedRoles(
  a: RampRoleFlags,
  b: RampRoleFlags,
  x: keyof RampRoleFlags,
  y: keyof RampRoleFlags,
): boolean {
  return (a[x] && b[y]) || (a[y] && b[x]);
}

function bothHaveRole(a: RampRoleFlags, b: RampRoleFlags, role: keyof RampRoleFlags): boolean {
  return a[role] && b[role];
}

function determineRampShape(a: RampRoleFlags, b: RampRoleFlags): RampPairShape {
  if (hasMixedRoles(a, b, 'ramp', 'trigger')) return 'ramp-trigger';
  if (bothHaveRole(a, b, 'cost')) return 'cost-cost';
  if (bothHaveRole(a, b, 'ramp')) return 'ramp-ramp';
  if (bothHaveRole(a, b, 'trigger')) return 'trigger-trigger';
  if (hasMixedRoles(a, b, 'ramp', 'cost')) return 'ramp-cost';
  return 'trigger-cost';
}

function classifyRampPair(
  cardA: LorcanaCard,
  rolesA: RampRole[],
  cardB: LorcanaCard,
  rolesB: RampRole[],
): RampPairFlags {
  const a = rampRoleFlags(rolesA);
  const b = rampRoleFlags(rolesB);
  return {
    shape: determineRampShape(a, b),
    rampCard: a.ramp ? cardA : cardB,
    triggerCard: a.trigger ? cardA : cardB,
    costCard: a.cost ? cardA : cardB,
  };
}

/** Score the ramp ↔ trigger chain (the only pair shape with a tiered ladder). */
function scoreRampTriggerChain(rampCard: LorcanaCard, triggerCard: LorcanaCard): number {
  const deckRamp = isDeckRamp(rampCard);
  const repeatingTrigger = isRepeatingTrigger(triggerCard);
  if (deckRamp && repeatingTrigger) return RAMP.scores['chain.deckRepeating'];
  if (deckRamp || repeatingTrigger) return RAMP.scores['chain.mixed'];
  return RAMP.scores['chain.neither'];
}

/**
 * Score the cost-reduction ↔ cost-reduction pair: 6 when both discounts target the same
 * card type (stacking discounts), 0 (silently dropped) when they target disjoint types.
 */
function scoreRampCostPair(cardA: LorcanaCard, cardB: LorcanaCard): number {
  return costReductionTargetsOverlap(cardA, cardB) ? RAMP.scores.costOverlap : 0;
}

/**
 * Score a ramp pair based on their roles and sub-patterns.
 *
 * Convention: 5 = same-strategy density baseline, no compounding interaction.
 * Bumps above 5 reflect real mechanical chains where one card *enables* or
 * *amplifies* the other (not just parallel acceleration).
 *
 * Scoring priority:
 * - Deck ramp ↔ Repeating trigger: 9 (snowball chain — every free ink fires a trigger)
 * - Deck ramp ↔ Once/turn trigger: 8 (free ink but trigger capped)
 * - Self-sacrifice ↔ Repeating trigger: 8 (fires every event but costs a card)
 * - Self-sacrifice ↔ Once/turn trigger: 7 (card cost + capped)
 * - Cost reduction ↔ Cost reduction (overlap): 6 (stacking discounts on same card type)
 * - Cost reduction ↔ Cost reduction (no overlap): 0 (silently dropped)
 * - All other same-axis density pairs: 5 (parallel acceleration)
 */
export function getRampPairScore(
  cardA: LorcanaCard,
  rolesA: RampRole[],
  cardB: LorcanaCard,
  rolesB: RampRole[],
): number {
  const flags = classifyRampPair(cardA, rolesA, cardB, rolesB);
  if (flags.shape === 'ramp-trigger')
    return scoreRampTriggerChain(flags.rampCard, flags.triggerCard);
  if (flags.shape === 'cost-cost') return scoreRampCostPair(cardA, cardB);
  return RAMP.scores.density;
}

/** Explanation templates keyed by ramp pair shape. */
const RAMP_EXPLANATIONS: Record<
  RampPairShape,
  (cardA: LorcanaCard, cardB: LorcanaCard, flags: RampPairFlags) => string
> = {
  'ramp-trigger': (a, _b, f) => {
    // `a` is the searcher (modal cardA / left / token A); `_b` is the partner (B).
    const rampIsA = f.rampCard.id === a.id;
    const rampToken = rampIsA ? '{A}' : '{B}';
    const triggerToken = rampIsA ? '{B}' : '{A}';
    return RAMP.templates['ramp-trigger']
      .replace('{RAMP}', rampToken)
      .replace('{TRIGGER}', triggerToken);
  },
  'ramp-ramp': (_a, _b) => RAMP.templates['ramp-ramp'],
  'ramp-cost': (a, _b, f) => {
    const rampIsA = f.rampCard.id === a.id;
    const rampToken = rampIsA ? '{A}' : '{B}';
    const costToken = rampIsA ? '{B}' : '{A}';
    return RAMP.templates['ramp-cost'].replace('{RAMP}', rampToken).replace('{COST}', costToken);
  },
  'trigger-trigger': (_a, _b) => RAMP.templates['trigger-trigger'],
  'cost-cost': (_a, _b) => RAMP.templates['cost-cost'],
  'trigger-cost': (_a, _b) => RAMP.templates['trigger-cost'],
};

/** Generate a human-readable explanation for a ramp synergy pair. */
export function getRampExplanation(
  cardA: LorcanaCard,
  rolesA: RampRole[],
  cardB: LorcanaCard,
  rolesB: RampRole[],
): string {
  const flags = classifyRampPair(cardA, rolesA, cardB, rolesB);
  return RAMP_EXPLANATIONS[flags.shape](cardA, cardB, flags);
}

// ============================================
// TOY TRIBAL SCORING
// ============================================

/**
 * Tribal payoff roles — these specifically reward Toy density (vs. generic
 * mechanics inherited via composition like draw, burn, ramp, etc., which
 * happen to appear on Toy cards but don't compound with tribal mass).
 */
const TOY_TRIBAL_ROLES: readonly ToyRole[] = ['search', 'banish-trigger', 'self-discount'];

const hasTribalRole = (roles: ToyRole[]): boolean =>
  roles.some((r) => TOY_TRIBAL_ROLES.includes(r));

type ToyPairResult = {score: number; explanation: string};

/** Pair context passed to each tier helper — derived flags so the helpers stay shape-agnostic. */
interface ToyPairCtx {
  card: LorcanaCard;
  other: LorcanaCard;
  aMember: boolean;
  bMember: boolean;
  aHasSearch: boolean;
  bHasSearch: boolean;
  aHasBanish: boolean;
  bHasBanish: boolean;
  aTribal: boolean;
  bTribal: boolean;
}

function buildToyPairCtx(
  card: LorcanaCard,
  cardRoles: ToyRole[],
  other: LorcanaCard,
  otherRoles: ToyRole[],
): ToyPairCtx {
  return {
    card,
    other,
    aMember: cardRoles.includes('member'),
    bMember: otherRoles.includes('member'),
    aHasSearch: cardRoles.includes('search'),
    bHasSearch: otherRoles.includes('search'),
    aHasBanish: cardRoles.includes('banish-trigger'),
    bHasBanish: otherRoles.includes('banish-trigger'),
    aTribal: hasTribalRole(cardRoles),
    bTribal: hasTribalRole(otherRoles),
  };
}

/** 8 — search ↔ banish-trigger (peak tribal chain: load board, pay off on banish). */
function tryToyPeakChain(ctx: ToyPairCtx): ToyPairResult | null {
  const matched = (ctx.aHasSearch && ctx.bHasBanish) || (ctx.aHasBanish && ctx.bHasSearch);
  if (!matched) return null;
  // ctx.card is the searcher (modal cardA / left / token A); ctx.other is the partner (B).
  const searchToken = ctx.aHasSearch ? '{A}' : '{B}';
  const banishToken = ctx.aHasBanish ? '{A}' : '{B}';
  return {
    score: 8,
    explanation: `${searchToken} loads a Toy, then ${banishToken} pays off when it gets banished. Peak chain.`,
  };
}

/** 8 — Member ↔ search (search converts a deck slot to a tribal member). */
function tryToyMemberSearch(ctx: ToyPairCtx): ToyPairResult | null {
  const matched = (ctx.aMember && ctx.bHasSearch) || (ctx.aHasSearch && ctx.bMember);
  if (!matched) return null;
  const searchToken = ctx.aHasSearch ? '{A}' : '{B}';
  const memberToken = ctx.aHasSearch ? '{B}' : '{A}';
  return {
    score: 8,
    explanation: `${searchToken} fetches ${memberToken} from the deck. Direct tribal access.`,
  };
}

/** 7 — Tribal ↔ Tribal (multiple density rewards compound). */
function tryToyTribalCompound(ctx: ToyPairCtx): ToyPairResult | null {
  if (!(ctx.aTribal && ctx.bTribal)) return null;
  return {
    score: 7,
    explanation: `Both reward Toy density. Tribal payoffs compound.`,
  };
}

/** 7 — Member ↔ Tribal (member feeds the tribal payoff). */
function tryToyMemberTribal(ctx: ToyPairCtx): ToyPairResult | null {
  const matched = (ctx.aMember && ctx.bTribal) || (ctx.aTribal && ctx.bMember);
  if (!matched) return null;
  return {
    score: 7,
    explanation: `Contributes to the Toy density that gets rewarded.`,
  };
}

/**
 * Score a Toy pair using a role-driven matrix.
 *
 * Convention: 5 = same-deck baseline, 7+ = mechanical compounding around tribal density.
 *
 * Matrix (highest precedence first):
 *   - search ↔ banish-trigger  = 8 (peak chain — load board, pay off on banish)
 *   - Member ↔ search          = 8 (search converts deck slot to tribal member)
 *   - Tribal ↔ Tribal (other)  = 7 (multiple density rewards compound)
 *   - Member ↔ Tribal          = 7 (member feeds the tribal payoff)
 *   - Otherwise                = 5 (Member↔Member, Member↔generic, Generic↔generic;
 *                                   generic mechanic synergies are owned by their own rules)
 */
export function scoreToyPair(
  card: LorcanaCard,
  cardRoles: ToyRole[],
  other: LorcanaCard,
  otherRoles: ToyRole[],
): ToyPairResult {
  const ctx = buildToyPairCtx(card, cardRoles, other, otherRoles);
  return (
    tryToyPeakChain(ctx) ??
    tryToyMemberSearch(ctx) ??
    tryToyTribalCompound(ctx) ??
    tryToyMemberTribal(ctx) ?? {
      score: 5,
      explanation: `Both share the Toys deck. Density baseline.`,
    }
  );
}

// ============================================
// SEVEN DWARFS TRIBAL SCORING
// ============================================

interface DwarfsPairResult {
  score: number;
  explanation: string;
}

interface DwarfsPairCtx {
  /** True iff one side has role `x` and the other has role `y` (direction-agnostic). */
  cross: (x: DwarfsRole, y: DwarfsRole) => boolean;
}

/** Build a direction-agnostic role-comparison context for a Seven Dwarfs pair. */
function buildDwarfsPairCtx(cardRoles: DwarfsRole[], otherRoles: DwarfsRole[]): DwarfsPairCtx {
  const a = new Set(cardRoles);
  const b = new Set(otherRoles);
  // cross(x, x) doubles as a "both sides have x" test.
  return {cross: (x, y) => (a.has(x) && b.has(y)) || (b.has(x) && a.has(y))};
}

/**
 * Score a Seven Dwarfs pair using a role-driven matrix (5-baseline convention).
 *
 * Agreed matrix (highest precedence first):
 *   - recruit ↔ member | recruit ↔ density = 8 (free recruit cheats a Dwarf onto the board)
 *   - density ↔ density | density ↔ member | return ↔ member = 7 (compounding / member feeds payoff)
 *   - everything else (member ↔ member, etc.)               = 5 (same-deck density baseline)
 *
 * Multi-role cards matter here: Right Behind You is BOTH recruit and density, so the
 * precedence order decides which tier wins when it pairs with a member.
 */
/**
 * Score the Seven Dwarfs 7/5 tiers, reached only after the recruit combo (8) misses.
 * Split out of scoreDwarfsPair so the top-level scorer stays a flat recruit → lower sequence.
 */
function scoreDwarfsLowerTiers(ctx: DwarfsPairCtx): DwarfsPairResult {
  // 7 — compounding density payoffs, or a member feeding a payoff.
  if (ctx.cross('density', 'density')) {
    return {score: 7, explanation: `Both reward Seven Dwarfs density — the payoffs compound.`};
  }
  if (ctx.cross('density', 'member')) {
    return {score: 7, explanation: `The member feeds the Seven Dwarfs density payoff.`};
  }
  if (ctx.cross('return', 'member')) {
    return {
      score: 7,
      explanation: `Bouncing the member re-buys its enter-play ability and draws a card.`,
    };
  }

  return {score: 5, explanation: `Both share the Seven Dwarfs deck. Density baseline.`};
}

export function scoreDwarfsPair(
  _card: LorcanaCard,
  cardRoles: DwarfsRole[],
  _other: LorcanaCard,
  otherRoles: DwarfsRole[],
): DwarfsPairResult {
  const ctx = buildDwarfsPairCtx(cardRoles, otherRoles);

  // 8 — a free recruit cheats a Dwarf onto the board (check first so a recruit+density
  // card like Right Behind You scores 8, not 7, against a member).
  if (ctx.cross('recruit', 'member') || ctx.cross('recruit', 'density')) {
    return {
      score: 8,
      explanation: `A free recruit cheats a Seven Dwarfs character onto the board.`,
    };
  }

  return scoreDwarfsLowerTiers(ctx);
}

// ============================================
// FLOODBORNS SCORING (payoff-anchored, 5-baseline)
// ============================================

export const isFloodbornPayoff = (roles: FloodbornRole[]): boolean =>
  roles.includes('buff') || roles.includes('trigger');

/**
 * Score a Floodborns pair. Called only when at least one side is a payoff
 * (the rule's findSynergies skips member-member pairs).
 *   - payoff <-> payoff           = 7 (two payoffs stack on the same Floodborn board)
 *   - member <-> trigger payoff   = 7 (the body fires the repeating trigger)
 *   - member <-> buff payoff      = 6 (the body is pumped by the team buff)
 */
/**
 * Score a member ↔ single-payoff Floodborn pair (exactly one side is a payoff): 7 when the
 * payoff is a repeating trigger the body fires, 6 when it is a team buff pumping the body.
 */
function scoreFloodbornMemberPayoff(
  payoffRoles: FloodbornRole[],
): {score: number; explanation: string} {
  if (payoffRoles.includes('trigger')) {
    return {score: 7, explanation: 'The Floodborn body fires the repeating payoff trigger.'};
  }
  return {score: 6, explanation: 'The Floodborn body is pumped by the team buff.'};
}

export function scoreFloodbornPair(
  cardRoles: FloodbornRole[],
  otherRoles: FloodbornRole[],
): {score: number; explanation: string} {
  const cardPayoff = isFloodbornPayoff(cardRoles);
  const otherPayoff = isFloodbornPayoff(otherRoles);

  if (cardPayoff && otherPayoff) {
    return {score: 7, explanation: 'Both reward a wide Floodborn board, so the payoffs stack.'};
  }
  // Exactly one side is a payoff; the other is a member only.
  return scoreFloodbornMemberPayoff(cardPayoff ? cardRoles : otherRoles);
}

// ============================================
// ITEMS SCORING (Item Matters, payoff-anchored, 5-baseline)
// ============================================

/** A payoff side rewards item volume, either a repeating trigger or a static/count check. */
export const isItemPayoff = (roles: ItemRole[]): boolean =>
  roles.includes('payoff-trigger') || roles.includes('payoff-static');

/** The peak item chain: an item engine on one side, any item payoff on the other. */
function hasItemEnginePayoffCombo(has: (x: ItemRole, y: ItemRole) => boolean): boolean {
  return has('item-engine', 'payoff-trigger') || has('item-engine', 'payoff-static');
}

/**
 * Score an Item-Matters pair. findSynergies only calls this when at least one side is a
 * payoff (payoff-anchored), so every pair resolves to 8/7/6. Cards are multi-role (an item
 * that recurs items is member+item-engine), so the HIGHEST applicable bucket wins:
 *   item-engine x payoff (trigger|static)  = 8  the engine floods items, each firing the payoff
 *   payoff      x payoff                    = 7  two payoffs stack on one item flood
 *   member      x payoff-trigger            = 7  the item body fires the repeating "whenever you play an item"
 *   member      x payoff-static             = 6  the item satisfies the "have an item in play" check
 * The trailing `return 5` is an unreachable guard — the payoff gate guarantees a match above.
 */
export function scoreItemPair(
  cardRoles: ItemRole[],
  otherRoles: ItemRole[],
): {score: number; explanation: string} {
  const has = crossMatcher(cardRoles, otherRoles);

  if (hasItemEnginePayoffCombo(has)) {
    return {score: 8, explanation: 'The item engine floods the board, and every item it plays fires the payoff.'};
  }
  if (isItemPayoff(cardRoles) && isItemPayoff(otherRoles)) {
    return {score: 7, explanation: 'Two item payoffs stack on the same item flood.'};
  }
  if (has('member', 'payoff-trigger')) {
    return {score: 7, explanation: 'Playing the item fires the repeating "whenever you play an item" payoff.'};
  }
  if (has('member', 'payoff-static')) {
    return {score: 6, explanation: 'The item in play turns on the "have an item in play" payoff.'};
  }
  return {score: 5, explanation: 'Parallel item-engine pieces on the same axis, no direct combo.'};
}

// ============================================
// HEALING SCORING (Heal Matters, payoff-anchored, 5-baseline)
// ============================================

/** A payoff side rewards the removal event. Healers alone are enablers, not payoffs. */
export const isHealPayoff = (roles: HealRole[]): boolean => roles.includes('heal-payoff');

/**
 * Score a Heal-Matters pair. findSynergies only calls this when at least one side is a payoff
 * (payoff-anchored), so healer-healer pairs never reach here. Cards can be multi-role (Ohana
 * Means Family is healer+heal-payoff), so a side counts as the payoff whenever it carries the
 * 'heal-payoff' role:
 *   healer      <-> heal-payoff  = 8  win-condition: the healer clears damage, firing the payoff engine
 *   heal-payoff <-> heal-payoff  = 7  two heal engines compound on the same board
 *
 * `cardRoles` is the searcher (token {A}); `otherRoles` is the partner (token {B}). The token-swap
 * keeps the HEALER side reading as the actor regardless of which card the user selected.
 */
export function scoreHealPair(
  cardRoles: HealRole[],
  otherRoles: HealRole[],
): {score: number; explanation: string} {
  const cardPayoff = isHealPayoff(cardRoles);
  const otherPayoff = isHealPayoff(otherRoles);

  if (cardPayoff && otherPayoff) {
    return {
      score: 7,
      explanation: 'Both reward removing damage: two heal engines that compound on the same board.',
    };
  }
  // Exactly one side is a payoff; the other is a healer only. The healer is the enabler/actor.
  const healerToken = cardPayoff ? '{B}' : '{A}';
  const payoffToken = cardPayoff ? '{A}' : '{B}';
  return {
    score: 8,
    explanation: `${healerToken} clears damage off your characters, firing ${payoffToken}'s heal payoff.`,
  };
}

// ============================================
// HUNNY TRIBAL SCORING (5-baseline)
// ============================================

/**
 *   - search <-> member | search <-> density = 8 (fetch converts a slot / fuels the payoff)
 *   - density <-> density | density <-> member = 7 (compounding / member feeds payoff)
 *   - buff <-> member                          = 6 (single-target pump on a Hunny body)
 *   - everything else                          = 5 (same-deck density baseline)
 */
/**
 * Score the Hunny 7/6/5 tiers, reached only after the search combo (8) misses. Split out of
 * scoreHunnyPair so the top-level scorer stays a flat search → lower sequence.
 */
function scoreHunnyLowerTiers(
  cross: (x: HunnyRole, y: HunnyRole) => boolean,
): {score: number; explanation: string} {
  if (cross('density', 'density')) {
    return {score: 7, explanation: 'Both reward Hunny density, so the payoffs compound.'};
  }
  if (cross('density', 'member')) {
    return {score: 7, explanation: 'The member feeds the Hunny density payoff.'};
  }
  if (cross('buff', 'member')) {
    return {score: 6, explanation: 'The single-target buff pumps a Hunny body.'};
  }
  return {score: 5, explanation: 'Both share the Hunny deck. Density baseline.'};
}

export function scoreHunnyPair(
  cardRoles: HunnyRole[],
  otherRoles: HunnyRole[],
): {score: number; explanation: string} {
  const cross = crossMatcher(cardRoles, otherRoles);
  if (cross('search', 'member') || cross('search', 'density')) {
    return {score: 8, explanation: 'A Hunny search digs the tribe out of your deck, fueling the payoffs.'};
  }
  return scoreHunnyLowerTiers(cross);
}

// ============================================
// RED PANDA TRIBAL SCORING (5-baseline)
// ============================================

export function scoreRedPandaPair(
  cardRoles: RedPandaRole[],
  otherRoles: RedPandaRole[],
): {score: number; explanation: string} {
  const cross = crossMatcher(cardRoles, otherRoles);
  if (cross('search', 'member')) {
    return {score: 8, explanation: 'A Red Panda search converts a deck slot into a tribe member.'};
  }
  return {score: 5, explanation: 'Both share the Red Panda deck. Density baseline.'};
}

// ============================================
// EXERT SCORING (Exert Matters, payoff-anchored, 5-baseline)
// ============================================

/** Derived flags for an exert pair — keeps the scorer a flat guard sequence. */
interface ExertPairCtx {
  /** The enabler↔payoff combo fired: one side is an enabler, the other a payoff. */
  isCombo: boolean;
  bothPayoff: boolean;
  /** The enabler reads as {A} when the searcher (card) is the enabler side. */
  enablerToken: '{A}' | '{B}';
  payoffToken: '{A}' | '{B}';
  /** The payoff card whose text decides the consume/state tier. */
  payoffCard: LorcanaCard;
}

/** The exert enabler↔payoff combo fired: one side enables, the other pays off. */
function isExertCombo(
  cardEnabler: boolean,
  cardPayoff: boolean,
  otherEnabler: boolean,
  otherPayoff: boolean,
): boolean {
  return (cardEnabler && otherPayoff) || (otherEnabler && cardPayoff);
}

function buildExertPairCtx(
  card: LorcanaCard,
  cardRoles: ExertRole[],
  other: LorcanaCard,
  otherRoles: ExertRole[],
): ExertPairCtx {
  const cardEnabler = cardRoles.includes('exert-enabler');
  const otherEnabler = otherRoles.includes('exert-enabler');
  const cardPayoff = cardRoles.includes('exert-payoff');
  const otherPayoff = otherRoles.includes('exert-payoff');
  return {
    isCombo: isExertCombo(cardEnabler, cardPayoff, otherEnabler, otherPayoff),
    bothPayoff: cardPayoff && otherPayoff,
    enablerToken: cardEnabler ? '{A}' : '{B}',
    payoffToken: cardEnabler ? '{B}' : '{A}',
    payoffCard: cardEnabler ? other : card,
  };
}

/**
 * Score an Exert pair (payoff-anchored). Returns null for enabler↔enabler pairs so the
 * rule's findSynergies drops them (two soft-taps stack pressure but never combo).
 *
 *   enabler ↔ consume payoff (exert-trigger / banish-exerted / can't-ready lock) = 8
 *   enabler ↔ state payoff   (opp-exert-state / lore-off-exerted)               = 6
 *   payoff  ↔ payoff                                                             = 5
 *   enabler ↔ enabler                                                            = null
 *
 * `card` is the searcher (token {A}); `other` is the partner (token {B}). The token-swap
 * keeps the ENABLER side reading as the actor regardless of which card is the searcher.
 * The consume/state tier is read from the payoff card's text via isExertConsumePayoff.
 */
export function scoreExertPair(
  card: LorcanaCard,
  cardRoles: ExertRole[],
  other: LorcanaCard,
  otherRoles: ExertRole[],
): {score: number; explanation: string} | null {
  const ctx = buildExertPairCtx(card, cardRoles, other, otherRoles);

  // enabler ↔ payoff (cross-role): score by the PAYOFF side's tier.
  if (ctx.isCombo) {
    if (isExertConsumePayoff(ctx.payoffCard)) {
      return {
        score: 8,
        explanation: `${ctx.enablerToken} exerts an opposing character, and ${ctx.payoffToken} punishes the exerted body.`,
      };
    }
    return {
      score: 6,
      explanation: `${ctx.enablerToken} keeps an opposing character exerted, switching on ${ctx.payoffToken}.`,
    };
  }

  // payoff ↔ payoff = 5 (parallel payoff density).
  if (ctx.bothPayoff) {
    return {score: 5, explanation: `Both reward opposing characters being exerted. Density baseline.`};
  }

  // enabler ↔ enabler = null (payoff-anchored, never emitted).
  return null;
}

// ============================================
// CLASSIFICATION-TRIBE SCORING (Monster/Princess/Hero/Super/Royalty/Detective/Gargoyle/Madrigal)
// Shared factory over TRIBAL_SPECS — payoff-anchored, 5-baseline.
// ============================================

/** Any non-member role rewards the tribe: a buff, a repeating trigger, a search, or an in-play check. */
const isTribalPayoff = (roles: TribalRole[]): boolean => roles.some((r) => r !== 'member');

/**
 * A search side combos with any tribe piece (member or payoff): the search digs the tribe
 * out of the deck to fuel every downstream payoff. Broken out so the scorer's peak-tier
 * guard is a single call instead of a four-way OR.
 */
function hasTribalSearchCombo(cross: (x: TribalRole, y: TribalRole) => boolean): boolean {
  return (
    cross('search', 'member') ||
    cross('search', 'buff') ||
    cross('search', 'trigger') ||
    cross('search', 'in-play-check')
  );
}

/**
 * Score the sub-search tribal tiers (7/6), reached only after the search combo misses.
 * Split out of scoreTribalPair so the top-level scorer stays a flat gate → search → lower
 * sequence. `bothPayoff` is precomputed by the caller (it also drove the null gate).
 * The trailing 5 is an unreachable guard — the payoff gate admits only member-payoff or
 * payoff-payoff pairs, both matched above.
 */
function scoreTribalLowerTiers(
  tribe: string,
  cross: (x: TribalRole, y: TribalRole) => boolean,
  bothPayoff: boolean,
): {score: number; explanation: string} {
  if (cross('trigger', 'member')) {
    return {score: 7, explanation: `The ${tribe} body fires the repeating payoff trigger.`};
  }
  if (bothPayoff) {
    return {score: 7, explanation: `Two ${tribe} payoffs stack on the same board.`};
  }
  if (cross('buff', 'member')) {
    return {score: 6, explanation: `The ${tribe} body is pumped by the buff.`};
  }
  if (cross('in-play-check', 'member')) {
    return {score: 6, explanation: `The ${tribe} body turns on the "have a ${tribe} in play" payoff.`};
  }
  return {score: 5, explanation: `Both share the ${tribe} deck. Density baseline.`};
}

/**
 * Score a classification-tribe pair (payoff-anchored). Returns null for member-member
 * pairs so `tribalFindSynergies` drops them (a tribe is only interesting through its payoffs).
 * `tribe` is the SINGULAR grammar noun ("Princess", "Royalty") woven into each explanation —
 * kept distinct from the plural display name ("Princesses", "Royalties") so the templates stay grammatical.
 * Highest applicable bucket wins, since cards are multi-role (Philoctetes is member+buff+trigger):
 *   search  <-> member|payoff       = 8  the search digs the tribe out to fuel the payoffs
 *   trigger <-> member              = 7  the body fires the repeating payoff each time
 *   payoff  <-> payoff              = 7  two payoffs stack on one tribal board
 *   buff    <-> member              = 6  the body is pumped by the (team or single-target) buff
 *   check   <-> member              = 6  the body turns on the "have a X in play" payoff
 */
export function scoreTribalPair(
  tribe: string,
  cardRoles: TribalRole[],
  otherRoles: TribalRole[],
): {score: number; explanation: string} | null {
  const cardPayoff = isTribalPayoff(cardRoles);
  const otherPayoff = isTribalPayoff(otherRoles);
  if (!cardPayoff && !otherPayoff) return null;

  const cross = crossMatcher(cardRoles, otherRoles);
  if (hasTribalSearchCombo(cross)) {
    return {score: 8, explanation: `A ${tribe} search digs the tribe out of your deck, fueling the payoffs.`};
  }
  return scoreTribalLowerTiers(tribe, cross, cardPayoff && otherPayoff);
}

/**
 * A tribe rule's description: its playstyle tagline from tuning.json, the line players see, so
 * every tribe reads the same way and an edit to the tagline reaches the rule too.
 */
export function tribeDescription(playstyleId: PlaystyleId): string {
  return TUNING.playstyles[playstyleId].tagline;
}

/**
 * Build a payoff-anchored tribal rule from a spec — one line per classification tribe.
 * `name` is the plural display label (e.g. "Princesses"); `noun` is the singular grammar noun
 * (e.g. "Princess") fed to the explanation templates so they read "A Princess search", not "A Princesses search".
 */
export function makeTribalRule(spec: TribalSpec, name: string, noun: string): SynergyRule {
  const playstyleId = spec.playstyleId as PlaystyleId;
  return {
    id: spec.playstyleId,
    name,
    category: 'playstyle',
    playstyleId,
    description: tribeDescription(playstyleId),
    matches: (card) => isTribalCard(card, spec),
    findSynergies: (card, allCards) =>
      tribalFindSynergies(card, allCards, (c) => getTribalRoles(c, spec), (cardRoles, otherRoles) =>
        scoreTribalPair(noun, cardRoles, otherRoles),
      ),
  };
}
