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
  exertEnablerReachesPayoff,
  selfDiscardOutletFeed,
  selfDiscardOutletFeedsPile,
  selfDiscardMillFeedsRecursion,
  selfDiscardHandTrimFeed,
  triggersOnAnyBanish,
  banishTriggerFiresOnYourTurn,
  toyAbilityCounts,
  TOY_TRIBAL_ROLES,
  isHunnyTeamBuff,
  type DiscardRole,
  type LoreDenialRole,
  type RampRole,
  type SacrificeRole,
  type SelfDiscardRole,
  type SelfDiscardFeed,
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

// ============================================
// CHIP TOKENS
// ============================================
// Every explanation names both cards with the {A} and {B} chip tokens: {A} is the searcher (the
// card whose page the tile is on), {B} the partner. The pair view draws each token as its card's
// chip, and a tile's tooltip swaps in the card names.

export type ChipToken = '{A}' | '{B}';

/** Two sides' tokens, the first side's first: [{A}, {B}] when the first side is the searcher. */
export const tokenPair = (firstIsCard: boolean): [ChipToken, ChipToken] =>
  firstIsCard ? ['{A}', '{B}'] : ['{B}', '{A}'];

/** The same-deck line: no ability of either card counts the other. */
const sameDeckLine = (deck: string): string => `{A} and {B} both go in ${deck} deck.`;

/** Two payoffs whose abilities both reward the board but count neither card. */
const stackLine = (kind: string): string =>
  `{A} and {B} are both ${kind} payoffs, so they stack on your board.`;

/** Two members of the playstyle whose abilities each count the other. */
const mutualLine = (kind: string): string =>
  `{A} and {B} are both ${kind} characters, and each one's ability helps the other.`;

/**
 * The search line of a tribe-like playstyle (tribes, Hunny, Red Panda): the search reveals the
 * member on the other side, or each card reveals the other. A search paired with a payoff that is
 * not a member reveals `kind` characters for it.
 */
function revealLine(
  cardRoles: readonly string[],
  otherRoles: readonly string[],
  kind: string,
): string {
  const cardFinds = cardRoles.includes('search') && otherRoles.includes('member');
  const otherFinds = otherRoles.includes('search') && cardRoles.includes('member');
  if (cardFinds && otherFinds) return '{A} and {B} can each reveal the other from your deck.';
  if (cardFinds) return '{A} can reveal {B} from your deck.';
  if (otherFinds) return '{B} can reveal {A} from your deck.';
  const [search, payoff] = tokenPair(cardRoles.includes('search'));
  return `${search} can reveal ${kind} characters for ${payoff}.`;
}

/** How a payoff-payoff pair reads, by whose ability helps whom (see splitStackedPayoffs). */
interface StackedPayoffLines {
  /** Neither card's ability counts the other. */
  stack: string;
  /** Each card's ability counts the other. */
  mutual: string;
  /** Only one does: the playstyle's member line, with that card as the payoff. */
  oneWay: (helperIsCard: boolean) => string;
}

/**
 * Two payoffs of one playstyle split by how many of the two cards the other card's ability helps:
 * none keeps the stack line, one takes the member line, both read as each helping the other. The
 * split changes only the words; the pair keeps its score.
 */
function splitStackedPayoffs(
  cardHelpsOther: boolean,
  otherHelpsCard: boolean,
  lines: StackedPayoffLines,
): string {
  if (cardHelpsOther && otherHelpsCard) return lines.mutual;
  if (cardHelpsOther) return lines.oneWay(true);
  if (otherHelpsCard) return lines.oneWay(false);
  return lines.stack;
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
      ? `{A} and {B} both reward having more cards in hand than the opponent.`
      : `{A} and {B} both disrupt the opponent's hand.`,
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

/**
 * Two banish payoffs, read by what each one's trigger watches: any of your characters being
 * banished (David Xanatos), or only its own banish (Kuzco).
 */
function sacrificePayoffsLine(card: LorcanaCard, other: LorcanaCard): string {
  const cardAny = triggersOnAnyBanish(card);
  const otherAny = triggersOnAnyBanish(other);
  if (cardAny && otherAny) return '{A} and {B} both benefit when your characters are banished.';
  if (cardAny === otherAny) return '{A} and {B} both benefit from being banished.';
  const [any, self] = tokenPair(cardAny);
  return `${any} benefits when your characters are banished, and ${self} when it is.`;
}

/**
 * The 5 line: two payoffs (sacrificePayoffsLine), two self-banish cards, or a self-banish card
 * next to a payoff it can't set off.
 */
function sacrificeBaselineLine(
  card: LorcanaCard,
  cardRoles: SacrificeRole[],
  other: LorcanaCard,
  otherRoles: SacrificeRole[],
): string {
  if (cardRoles.includes('banish-trigger') && otherRoles.includes('banish-trigger')) {
    return sacrificePayoffsLine(card, other);
  }
  if (cardRoles.includes('self-banish') && otherRoles.includes('self-banish')) {
    return `{A} and {B} both banish your own characters.`;
  }
  return sameDeckLine('a Sacrifice');
}

/**
 * Score a sacrifice pair (5-baseline convention, mirrors the Discard rule shape):
 *   - self-banish ↔ banish-trigger = 8  (win-condition combo), unless the trigger fires only on
 *                                       an opponent's turn, which no self-banish reaches (5)
 *   - banish-trigger ↔ banish-trigger = 5  (parallel payoff density)
 *   - self-banish ↔ self-banish     = 5  (parallel enablers, still need a payoff)
 *
 * `card` is the searcher (token {A}); `other` is the partner (token {B}).
 */
export function scoreSacrificePair(
  card: LorcanaCard,
  cardRoles: SacrificeRole[],
  other: LorcanaCard,
  otherRoles: SacrificeRole[],
): {score: number; explanation: string} {
  const cardSelfBanish = cardRoles.includes('self-banish');
  const otherSelfBanish = otherRoles.includes('self-banish');
  // A payoff counts toward the combo only when it can fire on your own turn.
  const cardPayoff = cardRoles.includes('banish-trigger') && banishTriggerFiresOnYourTurn(card);
  const otherPayoff = otherRoles.includes('banish-trigger') && banishTriggerFiresOnYourTurn(other);

  const isBanishCombo = isSacrificeBanishCombo(
    cardSelfBanish,
    cardPayoff,
    otherSelfBanish,
    otherPayoff,
  );

  if (isBanishCombo) {
    return scoreSacrificeBanishCombo(cardSelfBanish);
  }

  // No combo: density baseline. Two payoffs share the banish axis without amplifying it; two
  // self-banish cards are parallel enablers that still need a payoff body; a payoff that fires
  // only on an opponent's turn just shares the deck with a self-banish card.
  return {score: 5, explanation: sacrificeBaselineLine(card, cardRoles, other, otherRoles)};
}

// ============================================
// SELF-DISCARD SCORING
// ============================================

/** True iff a self-discard side carries a payoff role (reanimator or state-payoff). */
const isSelfDiscardPayoff = (roles: SelfDiscardRole[]): boolean =>
  roles.includes('reanimator') || roles.includes('state-payoff');

/** A pair's enabler↔payoff combo: the outlet's side, and how its discard reaches the payoff. */
interface SelfDiscardCombo {
  /** The searcher (`card`, token {A}) holds the outlet. */
  enablerIsCard: boolean;
  feed: SelfDiscardFeed;
}

/** Derived flags for a self-discard pair — keeps the scorer a flat guard sequence. */
interface SelfDiscardPairCtx {
  /** The enabler↔payoff combo, or null when neither side's outlet can feed the other's payoff. */
  combo: SelfDiscardCombo | null;
  bothReanimator: boolean;
  bothEnabler: boolean;
}

/**
 * One direction of the combo: how `enabler`'s hand discard reaches `payoff`'s reanimator or state
 * payoff, or null when `payoff` has no such payoff or the discard can't switch it on. A card with
 * no outlet can still trim your hand (Goliath - Clan Leader), which reaches a small-hand payoff
 * alone.
 */
function selfDiscardFeedInto(
  enabler: LorcanaCard,
  enablerRoles: SelfDiscardRole[],
  payoff: LorcanaCard,
  payoffRoles: SelfDiscardRole[],
): SelfDiscardFeed | null {
  if (!isSelfDiscardPayoff(payoffRoles)) return null;
  return enablerRoles.includes('enabler')
    ? selfDiscardOutletFeed(enabler, payoff, payoffRoles)
    : selfDiscardHandTrimFeed(enabler, payoff);
}

/**
 * The pair's combo, checked in both directions: a trigger beats a stock or unlock feed, and on a
 * tie the searcher holds the outlet. Following the direction that feeds keeps the actor right when
 * both cards have an outlet but only one has a payoff the other can feed.
 */
function findSelfDiscardCombo(
  card: LorcanaCard,
  cardRoles: SelfDiscardRole[],
  other: LorcanaCard,
  otherRoles: SelfDiscardRole[],
): SelfDiscardCombo | null {
  const fromCard = selfDiscardFeedInto(card, cardRoles, other, otherRoles);
  const fromOther = selfDiscardFeedInto(other, otherRoles, card, cardRoles);
  // The searcher's outlet leads unless only the partner's discard is a trigger.
  const cardLeads = fromCard === 'trigger' || fromOther !== 'trigger';
  if (fromCard && cardLeads) return {enablerIsCard: true, feed: fromCard};
  return fromOther ? {enablerIsCard: false, feed: fromOther} : null;
}

function buildSelfDiscardPairCtx(
  card: LorcanaCard,
  cardRoles: SelfDiscardRole[],
  other: LorcanaCard,
  otherRoles: SelfDiscardRole[],
): SelfDiscardPairCtx {
  return {
    combo: findSelfDiscardCombo(card, cardRoles, other, otherRoles),
    bothReanimator: cardRoles.includes('reanimator') && otherRoles.includes('reanimator'),
    bothEnabler: cardRoles.includes('enabler') && otherRoles.includes('enabler'),
  };
}

/**
 * The combo sentence, with the outlet as the actor: a hand kept small enough for the payoff to
 * ready, a bin the recursion replays from, or another discard payoff switched on.
 */
function explainSelfDiscardCombo(
  feed: SelfDiscardFeed,
  payoffRoles: SelfDiscardRole[],
  tokens: {enabler: string; payoff: string},
): string {
  const {enabler, payoff} = tokens;
  if (feed === 'unlock') {
    return `${enabler}'s self-discard keeps your hand at 2 or fewer, so ${payoff} can ready.`;
  }
  return payoffRoles.includes('reanimator')
    ? `${enabler} discards your own cards so ${payoff} can replay them from the discard.`
    : `${enabler}'s self-discard switches on ${payoff}'s discard payoff.`;
}

/**
 * Build the self-discard combo result: 8 when the outlet's discard switches the payoff on, 7 when
 * it only stocks the bin a recursion payoff replays from, or keeps your hand small enough to
 * switch a STONE BY DAY drawback off. Token-swap keeps the outlet reading as the actor.
 */
function scoreSelfDiscardCombo(
  combo: SelfDiscardCombo,
  cardRoles: SelfDiscardRole[],
  otherRoles: SelfDiscardRole[],
): {score: number; explanation: string} {
  const tokens = combo.enablerIsCard
    ? {enabler: '{A}', payoff: '{B}'}
    : {enabler: '{B}', payoff: '{A}'};
  const payoffRoles = combo.enablerIsCard ? otherRoles : cardRoles;
  return {
    score: combo.feed === 'trigger' ? 8 : 7,
    explanation: explainSelfDiscardCombo(combo.feed, payoffRoles, tokens),
  };
}

/** A side of a self-discard pair: the card and its roles. */
interface SelfDiscardSide {
  card: LorcanaCard;
  roles: SelfDiscardRole[];
}

/**
 * The bin-filling combos, best score first: a filler role on one side, the payoff it feeds on
 * the other, and, where the cards decide it, whether this filler reaches this payoff.
 */
const SELF_DISCARD_FILL_COMBOS: ReadonlyArray<{
  filler: SelfDiscardRole;
  payoff: SelfDiscardRole;
  score: number;
  feeds?: (filler: LorcanaCard, payoff: LorcanaCard) => boolean;
  explain: (filler: string, payoff: string) => string;
}> = [
  {
    filler: 'mill',
    payoff: 'zone-payoff',
    score: 7,
    explain: (f, p) => `${f} mills your deck into the discard, feeding ${p}'s discard-count payoff.`,
  },
  {
    filler: 'mill',
    payoff: 'reanimator',
    score: 7,
    feeds: (_mill, payoff) => selfDiscardMillFeedsRecursion(payoff),
    explain: (f, p) => `${f} mills cards into your discard for ${p} to replay.`,
  },
  {
    filler: 'enabler',
    payoff: 'zone-payoff',
    score: 6,
    feeds: selfDiscardOutletFeedsPile,
    explain: (f, p) => `${f} fills your discard from hand, switching on ${p}'s discard-count payoff.`,
  },
];

/** `filler` holds the combo's filler role, `payoff` its payoff role, and the filler reaches it. */
function fillsFor(
  combo: (typeof SELF_DISCARD_FILL_COMBOS)[number],
  filler: SelfDiscardSide,
  payoff: SelfDiscardSide,
): boolean {
  const rolesMatch = filler.roles.includes(combo.filler) && payoff.roles.includes(combo.payoff);
  return rolesMatch && (combo.feeds?.(filler.card, payoff.card) ?? true);
}

/**
 * The fill combo (7 or 6), or null: a bin-filler (mill or hand-discard enabler) on one side and
 * the discard-count / recursion payoff it feeds on the other. Token-swap keeps the filler
 * reading as the actor regardless of which card is the searcher. The first matching row wins,
 * and the rows run best score first, so a card that both loots and mills reads as the mill.
 */
function scoreSelfDiscardFillCombo(
  searcher: SelfDiscardSide,
  partner: SelfDiscardSide,
): {score: number; explanation: string} | null {
  for (const combo of SELF_DISCARD_FILL_COMBOS) {
    const cardFills = fillsFor(combo, searcher, partner);
    if (!cardFills && !fillsFor(combo, partner, searcher)) continue;
    const [filler, payoff] = cardFills ? ['{A}', '{B}'] : ['{B}', '{A}'];
    return {score: combo.score, explanation: combo.explain(filler, payoff)};
  }
  return null;
}

/**
 * Score a self-discard pair (5-baseline convention, mirrors the Sacrifice shape):
 *   - enabler ↔ payoff it switches on        = 8  (win-condition: a discard-event or empty-hand
 *                                                 payoff, or recursion that fires on the discard)
 *   - enabler ↔ any other reanimator         = 7  (compounding: the outlet stocks the bin the
 *                                                 recursion replays from, which play fills too)
 *   - enabler ↔ small-hand payoff            = 7  (compounding: an outlet that shrinks your hand,
 *                                                 or Goliath - Clan Leader's trim, switches the
 *                                                 STONE BY DAY drawback off)
 *   - mill ↔ zone payoff, mill ↔ reanimator  = 7  (compounding: mill stocks the pile several
 *                                                 cards at a time without spending the hand)
 *   - enabler ↔ zone payoff                  = 6  (complementary: each discard adds one card
 *                                                 to the count)
 *   - reanimator ↔ reanimator                = 6  (two recursion engines share one bin)
 *   - all other same-axis pairs              = 5  (parallel density; includes mill ↔ state,
 *                                                 since milling is not a discard event)
 * An outlet scores with a payoff only when its discard can reach it (selfDiscardOutletFeed, or
 * selfDiscardHandTrimFeed for a hand trim), and with a zone payoff only when its discard lands
 * before the payoff looks (selfDiscardOutletFeedsPile). A mill never feeds recursion that fires
 * only on your discard (selfDiscardMillFeedsRecursion).
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

  // 8 or 7 — an enabler on one side, a payoff (reanimator or state) it can feed on the other.
  if (ctx.combo) {
    return scoreSelfDiscardCombo(ctx.combo, cardRoles, otherRoles);
  }

  // 7 or 6 — a bin-filler feeding a discard-count payoff, or mill feeding a recursion engine.
  const fill = scoreSelfDiscardFillCombo({card, roles: cardRoles}, {card: other, roles: otherRoles});
  if (fill) return fill;

  // 6 — two recursion engines mining the same discard pile.
  if (ctx.bothReanimator) {
    return {score: 6, explanation: `{A} and {B} both take cards from your discard.`};
  }

  // 5 — same-axis density: parallel enablers, or two payoffs that do not compound.
  return {
    score: 5,
    explanation: ctx.bothEnabler
      ? `{A} and {B} both fill your discard from your hand.`
      : sameDeckLine('a Self-Discard'),
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
    return {score: 7, explanation: `{A} and {B} both steal lore from the opponent.`};
  }
  if (roleA === 'burn' && roleB === 'burn') {
    return {score: 5, explanation: `{A} and {B} both make opponents lose lore.`};
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
  'trigger-cost': (a, _b, f) => {
    const [triggerToken, costToken] = tokenPair(f.triggerCard.id === a.id);
    return RAMP.templates['trigger-cost']
      .replace('{TRIGGER}', triggerToken)
      .replace('{COST}', costToken);
  },
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

/**
 * 8 — Member ↔ search (search converts a deck slot to a tribal member). The search side is the
 * one whose partner is a member: Woody - Leader of the Toys is a member with a search, so next to
 * a search action it is the Toy the action fetches.
 */
function tryToyMemberSearch(ctx: ToyPairCtx): ToyPairResult | null {
  const cardSearchesMember = ctx.aHasSearch && ctx.bMember;
  const matched = cardSearchesMember || (ctx.aMember && ctx.bHasSearch);
  if (!matched) return null;
  const [searchToken, memberToken] = tokenPair(cardSearchesMember);
  return {
    score: 8,
    explanation: `${searchToken} fetches ${memberToken} from the deck. Direct tribal access.`,
  };
}

/** The plain Toys line: no ability of either card counts the other. */
const TOY_DECK_LINE = sameDeckLine('a Toys');

/** The member line, with the payoff's ability counting the member as a Toy. */
function toyActivateLine(payoffIsCard: boolean): string {
  const [payoff, member] = tokenPair(payoffIsCard);
  return `${member} can activate ${payoff}'s Toy ability.`;
}

/**
 * 7 — Tribal ↔ Tribal (multiple density rewards compound). The words follow what each card's
 * text counts, not the payoff tag: Rex - Protective Dinosaur's banish trigger counts no other Toy.
 */
function tryToyTribalCompound(ctx: ToyPairCtx): ToyPairResult | null {
  if (!(ctx.aTribal && ctx.bTribal)) return null;
  const explanation = splitStackedPayoffs(
    ctx.bMember && toyAbilityCounts(ctx.card, ctx.other),
    ctx.aMember && toyAbilityCounts(ctx.other, ctx.card),
    {stack: TOY_DECK_LINE, mutual: mutualLine('Toy'), oneWay: toyActivateLine},
  );
  return {score: 7, explanation};
}

/** 7 — Member ↔ Tribal (member feeds the tribal payoff). Exactly one side is tribal here. */
function tryToyMemberTribal(ctx: ToyPairCtx): ToyPairResult | null {
  const matched = (ctx.aMember && ctx.bTribal) || (ctx.aTribal && ctx.bMember);
  if (!matched) return null;
  const [payoff, member] = ctx.aTribal ? [ctx.card, ctx.other] : [ctx.other, ctx.card];
  return {
    score: 7,
    explanation: toyAbilityCounts(payoff, member) ? toyActivateLine(ctx.aTribal) : TOY_DECK_LINE,
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
    tryToyMemberTribal(ctx) ?? {score: 5, explanation: TOY_DECK_LINE}
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
  /** The searcher's roles (token {A}). */
  cardRoles: DwarfsRole[];
  /** The partner's roles (token {B}). */
  otherRoles: DwarfsRole[];
}

/** Build a direction-agnostic role-comparison context for a Seven Dwarfs pair. */
function buildDwarfsPairCtx(cardRoles: DwarfsRole[], otherRoles: DwarfsRole[]): DwarfsPairCtx {
  // cross(x, x) doubles as a "both sides have x" test.
  return {cross: crossMatcher(cardRoles, otherRoles), cardRoles, otherRoles};
}

/** The member line: the member counts toward the payoff's Seven Dwarfs ability. */
function dwarfsActivateLine(payoffIsCard: boolean): string {
  const [payoff, member] = tokenPair(payoffIsCard);
  return `${member} activates ${payoff}'s Seven Dwarfs ability.`;
}

/**
 * The recruit line: the recruit plays the Dwarf on the other side for free, or, when the partner
 * is a density payoff but not a Dwarf, plays a Dwarf that counts toward it.
 */
function dwarfsRecruitLine(cardRoles: DwarfsRole[], otherRoles: DwarfsRole[]): string {
  if (cardRoles.includes('recruit') && otherRoles.includes('member')) {
    return '{A} can play {B} for free.';
  }
  if (otherRoles.includes('recruit') && cardRoles.includes('member')) {
    return '{B} can play {A} for free.';
  }
  const [recruit, payoff] = tokenPair(
    cardRoles.includes('recruit') && otherRoles.includes('density'),
  );
  return `${recruit} can play a Seven Dwarfs character for free, which helps activate ${payoff}.`;
}

/** Two density payoffs, split by which of the two Dwarfs the other's ability counts. */
function dwarfsStackedLine(cardRoles: DwarfsRole[], otherRoles: DwarfsRole[]): string {
  return splitStackedPayoffs(otherRoles.includes('member'), cardRoles.includes('member'), {
    stack: stackLine('Seven Dwarfs'),
    mutual: mutualLine('Seven Dwarfs'),
    oneWay: dwarfsActivateLine,
  });
}

/** The return line: the bounce re-buys the member's enter-play ability and draws a card. */
function dwarfsReturnLine(cardRoles: DwarfsRole[], otherRoles: DwarfsRole[]): string {
  const [returner, member] = tokenPair(
    cardRoles.includes('return') && otherRoles.includes('member'),
  );
  return `${returner} returns ${member} to your hand and draws a card, so you can replay it.`;
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
  const {cardRoles, otherRoles} = ctx;
  // 7 — compounding density payoffs, or a member feeding a payoff.
  if (ctx.cross('density', 'density')) {
    return {score: 7, explanation: dwarfsStackedLine(cardRoles, otherRoles)};
  }
  if (ctx.cross('density', 'member')) {
    return {score: 7, explanation: dwarfsActivateLine(cardRoles.includes('density'))};
  }
  if (ctx.cross('return', 'member')) {
    return {score: 7, explanation: dwarfsReturnLine(cardRoles, otherRoles)};
  }

  return {score: 5, explanation: sameDeckLine('a Seven Dwarfs')};
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
    return {score: 8, explanation: dwarfsRecruitLine(cardRoles, otherRoles)};
  }

  return scoreDwarfsLowerTiers(ctx);
}

// ============================================
// FLOODBORNS SCORING (payoff-anchored, 5-baseline)
// ============================================

export const isFloodbornPayoff = (roles: FloodbornRole[]): boolean =>
  roles.includes('buff') || roles.includes('trigger');

/** F1: the member fires the payoff's repeating Floodborn trigger. */
function floodbornTriggerLine(payoffIsCard: boolean): string {
  const [payoff, member] = tokenPair(payoffIsCard);
  return `${member} triggers ${payoff}'s Floodborn ability.`;
}

/** F2: the payoff's team buff pumps the member. */
function floodbornBuffLine(payoffIsCard: boolean): string {
  const [payoff, member] = tokenPair(payoffIsCard);
  return `${payoff}'s Floodborn buff powers up ${member}.`;
}

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
  payoffIsCard: boolean,
  payoffRoles: FloodbornRole[],
): {score: number; explanation: string} {
  if (payoffRoles.includes('trigger')) {
    return {score: 7, explanation: floodbornTriggerLine(payoffIsCard)};
  }
  return {score: 6, explanation: floodbornBuffLine(payoffIsCard)};
}

/** Two payoffs, split by which of the two Floodborns the other's ability helps. */
function floodbornStackedLine(cardRoles: FloodbornRole[], otherRoles: FloodbornRole[]): string {
  return splitStackedPayoffs(otherRoles.includes('member'), cardRoles.includes('member'), {
    stack: stackLine('Floodborn'),
    mutual: mutualLine('Floodborn'),
    oneWay: (helperIsCard) => {
      const helperRoles = helperIsCard ? cardRoles : otherRoles;
      return helperRoles.includes('buff')
        ? floodbornBuffLine(helperIsCard)
        : floodbornTriggerLine(helperIsCard);
    },
  });
}

export function scoreFloodbornPair(
  cardRoles: FloodbornRole[],
  otherRoles: FloodbornRole[],
): {score: number; explanation: string} {
  const cardPayoff = isFloodbornPayoff(cardRoles);
  const otherPayoff = isFloodbornPayoff(otherRoles);

  if (cardPayoff && otherPayoff) {
    return {score: 7, explanation: floodbornStackedLine(cardRoles, otherRoles)};
  }
  // Exactly one side is a payoff; the other is a member only.
  return scoreFloodbornMemberPayoff(cardPayoff, cardPayoff ? cardRoles : otherRoles);
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
    const [engine, payoff] = tokenPair(
      cardRoles.includes('item-engine') && isItemPayoff(otherRoles),
    );
    return {
      score: 8,
      explanation: `${engine} helps you play more items, and they activate ${payoff}.`,
    };
  }
  if (isItemPayoff(cardRoles) && isItemPayoff(otherRoles)) {
    return {score: 7, explanation: stackLine('item')};
  }
  // From here exactly one side is a payoff; the other is the item it counts.
  const [payoff, member] = tokenPair(isItemPayoff(cardRoles));
  if (has('member', 'payoff-trigger')) {
    return {
      score: 7,
      explanation: `Playing ${member} triggers ${payoff}'s "whenever you play an item" ability.`,
    };
  }
  if (has('member', 'payoff-static')) {
    return {score: 6, explanation: `${member} can activate ${payoff}'s item ability.`};
  }
  return {score: 5, explanation: sameDeckLine('an item')};
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
    return {score: 7, explanation: '{A} and {B} both pay off when you remove damage.'};
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

/** Derived context for a Hunny pair: both cards, their roles, and the role-cross matcher. */
interface HunnyPairCtx {
  card: LorcanaCard;
  other: LorcanaCard;
  cardRoles: HunnyRole[];
  otherRoles: HunnyRole[];
  cross: (x: HunnyRole, y: HunnyRole) => boolean;
}

/**
 * The member line: the member counts toward the payoff's Hunny ability. A payoff whose ability
 * buffs your other Hunny characters (Gopher - Hunny Cook) reads as the buff line instead.
 */
function hunnyActivateLine(ctx: HunnyPairCtx, payoffIsCard: boolean): string {
  const [payoff, member] = tokenPair(payoffIsCard);
  if (isHunnyTeamBuff(payoffIsCard ? ctx.card : ctx.other)) {
    return `${payoff}'s Hunny buff powers up ${member}.`;
  }
  return `${member} activates ${payoff}'s Hunny ability.`;
}

/** The buff line: the buff pumps the member, or each card buffs the other. */
function hunnyBuffLine(cardRoles: HunnyRole[], otherRoles: HunnyRole[]): string {
  const cardBuffsOther = cardRoles.includes('buff') && otherRoles.includes('member');
  const otherBuffsCard = otherRoles.includes('buff') && cardRoles.includes('member');
  if (cardBuffsOther && otherBuffsCard) return '{A} and {B} can each buff the other.';
  const [payoff, member] = tokenPair(cardBuffsOther);
  return `${payoff}'s Hunny buff powers up ${member}.`;
}

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
function scoreHunnyLowerTiers(ctx: HunnyPairCtx): {score: number; explanation: string} {
  const {cardRoles, otherRoles, cross} = ctx;
  if (cross('density', 'density')) {
    const explanation = splitStackedPayoffs(
      otherRoles.includes('member'),
      cardRoles.includes('member'),
      {
        stack: stackLine('Hunny'),
        mutual: mutualLine('Hunny'),
        oneWay: (helperIsCard) => hunnyActivateLine(ctx, helperIsCard),
      },
    );
    return {score: 7, explanation};
  }
  if (cross('density', 'member')) {
    return {score: 7, explanation: hunnyActivateLine(ctx, cardRoles.includes('density'))};
  }
  if (cross('buff', 'member')) {
    return {score: 6, explanation: hunnyBuffLine(cardRoles, otherRoles)};
  }
  return {score: 5, explanation: sameDeckLine('a Hunny')};
}

/** `card` is the searcher (token {A}); `other` is the partner (token {B}). */
export function scoreHunnyPair(
  card: LorcanaCard,
  cardRoles: HunnyRole[],
  other: LorcanaCard,
  otherRoles: HunnyRole[],
): {score: number; explanation: string} {
  const cross = crossMatcher(cardRoles, otherRoles);
  if (cross('search', 'member') || cross('search', 'density')) {
    return {score: 8, explanation: revealLine(cardRoles, otherRoles, 'Hunny')};
  }
  return scoreHunnyLowerTiers({card, other, cardRoles, otherRoles, cross});
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
    return {score: 8, explanation: revealLine(cardRoles, otherRoles, 'Red Panda')};
  }
  return {score: 5, explanation: sameDeckLine('a Red Panda')};
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
  enablerCard: LorcanaCard;
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
    enablerCard: cardEnabler ? card : other,
    payoffCard: cardEnabler ? other : card,
  };
}

/**
 * The enabler ↔ payoff pair, scored by the payoff's tier. A payoff that acts only on a character
 * stronger than any the enabler exerts (exertEnablerReachesPayoff) just shares the deck.
 */
function scoreExertCombo(ctx: ExertPairCtx): {score: number; explanation: string} {
  if (!exertEnablerReachesPayoff(ctx.enablerCard, ctx.payoffCard)) {
    return {score: 5, explanation: sameDeckLine('an Exert')};
  }
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

/**
 * Score an Exert pair (payoff-anchored). Returns null for enabler↔enabler pairs so the
 * rule's findSynergies drops them (two soft-taps stack pressure but never combo).
 *
 *   enabler ↔ consume payoff (exert-trigger / banish-exerted / can't-ready lock) = 8
 *   enabler ↔ state payoff   (opp-exert-state / lore-off-exerted)               = 6
 *   enabler ↔ a payoff whose ¤ floor sits above the enabler's ¤ cap              = 5
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
  if (ctx.isCombo) return scoreExertCombo(ctx);

  // payoff ↔ payoff = 5 (parallel payoff density).
  if (ctx.bothPayoff) {
    return {
      score: 5,
      explanation: `{A} and {B} both benefit when opposing characters are exerted.`,
    };
  }

  // enabler ↔ enabler = null (payoff-anchored, never emitted).
  return null;
}

// ============================================
// CLASSIFICATION-TRIBE SCORING (Monster/Princess/Hero/Super/Royalty/Detective/Gargoyle/Madrigal/Villain)
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

/** Derived context for a tribe pair — keeps each line helper to one argument. */
interface TribalPairCtx {
  /** The SINGULAR tribe noun ("Princess", "Royalty"). */
  tribe: string;
  cardRoles: TribalRole[];
  otherRoles: TribalRole[];
  cross: (x: TribalRole, y: TribalRole) => boolean;
  /** The searcher is a payoff: below the both-payoffs tier, the pair's only payoff. */
  cardPayoff: boolean;
  bothPayoff: boolean;
}

/** The roles through which a payoff's ability helps a tribe member on the other side. */
const TRIBAL_HELP_ROLES: readonly TribalRole[] = ['buff', 'trigger', 'in-play-check'];

const tribalHelps = (helperRoles: TribalRole[], memberRoles: TribalRole[]): boolean =>
  memberRoles.includes('member') && helperRoles.some((r) => TRIBAL_HELP_ROLES.includes(r));

/** The buff line: the payoff's buff pumps the member. */
function tribalBuffLine(tribe: string, payoffIsCard: boolean): string {
  const [payoff, member] = tokenPair(payoffIsCard);
  return `${payoff}'s ${tribe} buff powers up ${member}.`;
}

/** The in-play-check line: the member switches the payoff's ability on. */
function tribalCheckLine(tribe: string, payoffIsCard: boolean): string {
  const [payoff, member] = tokenPair(payoffIsCard);
  return `${member} can make ${payoff}'s ${tribe} ability trigger.`;
}

/** The trigger line: the member fires the payoff's repeating trigger, or each fires the other's. */
function tribalTriggerLine(ctx: TribalPairCtx): string {
  const cardTriggersOther = ctx.cardRoles.includes('member') && ctx.otherRoles.includes('trigger');
  const otherTriggersCard = ctx.otherRoles.includes('member') && ctx.cardRoles.includes('trigger');
  if (cardTriggersOther && otherTriggersCard) {
    return `{A} and {B} trigger each other's ${ctx.tribe} abilities.`;
  }
  const [payoff, member] = tokenPair(otherTriggersCard);
  return `${member} triggers ${payoff}'s ${ctx.tribe} ability.`;
}

/**
 * Two payoffs, split by which of the two tribe members the other's ability helps. A one-way
 * helper never holds a trigger here (the trigger tier above takes those pairs), so it reads as
 * its buff, or else its in-play check.
 */
function tribalStackedLine(ctx: TribalPairCtx): string {
  const {tribe, cardRoles, otherRoles} = ctx;
  return splitStackedPayoffs(
    tribalHelps(cardRoles, otherRoles),
    tribalHelps(otherRoles, cardRoles),
    {
      stack: stackLine(tribe),
      mutual: mutualLine(tribe),
      oneWay: (helperIsCard) => {
        const helperRoles = helperIsCard ? cardRoles : otherRoles;
        return helperRoles.includes('buff')
          ? tribalBuffLine(tribe, helperIsCard)
          : tribalCheckLine(tribe, helperIsCard);
      },
    },
  );
}

/**
 * Score the sub-search tribal tiers (7/6), reached only after the search combo misses.
 * Split out of scoreTribalPair so the top-level scorer stays a flat gate → search → lower
 * sequence. `bothPayoff` is precomputed by the caller (it also drove the null gate).
 * The trailing 5 is an unreachable guard — the payoff gate admits only member-payoff or
 * payoff-payoff pairs, both matched above.
 */
function scoreTribalLowerTiers(ctx: TribalPairCtx): {score: number; explanation: string} {
  const {tribe, cross, cardPayoff} = ctx;
  if (cross('trigger', 'member')) {
    return {score: 7, explanation: tribalTriggerLine(ctx)};
  }
  if (ctx.bothPayoff) {
    return {score: 7, explanation: tribalStackedLine(ctx)};
  }
  if (cross('buff', 'member')) {
    return {score: 6, explanation: tribalBuffLine(tribe, cardPayoff)};
  }
  if (cross('in-play-check', 'member')) {
    return {score: 6, explanation: tribalCheckLine(tribe, cardPayoff)};
  }
  return {score: 5, explanation: sameDeckLine(`a ${tribe}`)};
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
    return {score: 8, explanation: revealLine(cardRoles, otherRoles, tribe)};
  }
  const bothPayoff = cardPayoff && otherPayoff;
  return scoreTribalLowerTiers({tribe, cardRoles, otherRoles, cross, cardPayoff, bothPayoff});
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
 * (e.g. "Princess") fed to the explanation templates so they read "{A}'s Princess buff", not
 * "{A}'s Princesses buff".
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
