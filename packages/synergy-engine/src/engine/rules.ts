import type {LorcanaCard, PlaystyleId, SynergyMatch, SynergyRule} from '../types';
import {
  classifyNamedEffect,
  getBaseName,
  getShiftBaseNames,
  getDiscardRoles,
  getInkDropGain,
  getKeywordValue,
  getLocationRoles,
  getNamedReferences,
  getRampRoles,
  getShiftType,
  hasClassification,
  hasKeyword,
  isBoostBeneficiaryLocation,
  isCharacter,
  isDiscardCard,
  isItem,
  isLocation,
  isLocationSupportCard,
  locationBuffReaches,
  isRampCard,
  isSong,
  isToyCard,
  getToyRoles,
  isSteadyAimAnchor,
  isMeridaDamageAction,
  getActionDamage,
  isMultiTargetDamageAction,
  isDwarfsCard,
  getDwarfsRoles,
  isBeckonAnchor,
  getBeckonEnablerTier,
  getFloodbornRoles,
  isFloodbornCard,
  getHunnyRoles,
  isHunnyCard,
  getRedPandaRoles,
  isRedPandaCard,
  getItemRoles,
  isItemCard,
  getHealRoles,
  isHealCard,
  TRIBAL_SPECS,
  getExertRoles,
  isExertCard,
  getBounceRoles,
  isBounceCard,
  getInkDropRoles,
  isInkDropCard,
  isLoreDenialCard,
  getLoreDenialRoles,
  getSacrificeRoles,
  isSacrificeCard,
  getSelfDiscardRoles,
  isSelfDiscardCard,
  LOCATION_PATTERNS,
  mechanicLabel,
  NAMED_EFFECT_SCORES,
  normalizeCardText,
  type LocationRole,
  type ShiftPayment,
  type ShiftType,
  type BeckonEnablerTier,
} from '../utils';
import {
  scoreDiscardPair,
  scoreSacrificePair,
  scoreSelfDiscardPair,
  scoreLoreDenialPair,
  getRampPairScore,
  getRampExplanation,
  scoreToyPair,
  scoreDwarfsPair,
  scoreExertPair,
  scoreFloodbornPair,
  isFloodbornPayoff,
  scoreItemPair,
  isItemPayoff,
  scoreHealPair,
  isHealPayoff,
  scoreHunnyPair,
  scoreRedPandaPair,
  tribalFindSynergies,
  pairFindSynergies,
  makePayoffAnchoredRule,
  makeTribalRule,
} from './ruleScoring';
import {scoreBouncePair} from './bounceScoring';
import {scoreInkDropPair} from './inkDropScoring';
import {TUNING} from '../data/tuning';

// ============================================
// CONDITIONAL SHIFT MATCHERS
// ============================================

const SHIFT = TUNING.ruleTexts['shift-targets'];
const shiftTier = (key: string) => ({score: SHIFT[key].score!, reason: SHIFT[key].text!});

/**
 * A condition matcher: extracts a condition from the Shift card's text and
 * checks if the base card's text can satisfy it.
 *
 * Each matcher has:
 * - `condition`: regex to extract the condition from the Shift card's text
 * - `satisfiedBy`: regex to check if the base card's text can enable that condition
 */
interface ShiftConditionMatcher {
  condition: RegExp;
  satisfiedBy: RegExp;
}

const SHIFT_CONDITION_MATCHERS: ShiftConditionMatcher[] = [
  {
    // "a card left a player's discard this turn"
    // Satisfied by cards that move/put/return/play/banish/shuffle cards from discard
    condition: /card left a player's discard/i,
    satisfiedBy:
      /(?:put|return|move|play|banish|shuffle).*(?:card|cards|character|characters).*from.*discard|from.*discard.*(?:on|to|into|back)|(?:card|character) from.*(?:your|chosen|a|their) (?:player's )?discard/i,
  },
];

/** Check if a base card can satisfy the conditional Shift requirement of a Shift card */
function baseActivatesShiftCondition(shiftCard: LorcanaCard, baseCard: LorcanaCard): boolean {
  if (!shiftCard.text || !baseCard.text) return false;
  const shiftText = normalizeCardText(shiftCard);
  const baseText = normalizeCardText(baseCard);

  return SHIFT_CONDITION_MATCHERS.some(
    (matcher) => matcher.condition.test(shiftText) && matcher.satisfiedBy.test(baseText),
  );
}

/**
 * Calculate Shift synergy score and explanation based on the payment (ink drops),
 * curve alignment, inkwell flexibility, free Shift tiers, and condition activation.
 *
 * Uses the Shift keyword cost (not the card's hard-cast cost) to determine how
 * naturally the base curves into the shift play. Inkable cards (base and/or shift)
 * get a bump because they provide fallback utility when drawn off-curve.
 *
 * See SCORING_DESIGN.md "Rule 1: Shift Targets" for the full score table.
 */
function calculateShiftSynergy(
  shiftCard: LorcanaCard,
  baseCard: LorcanaCard,
): {score: number; reason: string} {
  const {cost, payment} = getShiftType(shiftCard) ?? {
    cost: shiftCard.cost,
    payment: 'ink' as const,
  };

  // Compute base score and reason from the payment: ink drops, a free Shift, or the ink curve
  const base = calculateShiftBaseScore(shiftCard, baseCard, cost, payment);

  // +1 bonus if the base card activates a conditional Shift condition
  const activates = baseActivatesShiftCondition(shiftCard, baseCard);
  if (activates) {
    return {
      score: Math.min(base.score + 1, 10),
      reason: SHIFT['activationBonus'].text!,
    };
  }

  return base;
}

/** Score a free Shift (cost 0) — only the base card's cost matters since the shift itself is free. */
function freeShiftScore(
  _shiftCard: LorcanaCard,
  baseCard: LorcanaCard,
): {score: number; reason: string} {
  if (baseCard.cost <= 3) return shiftTier('free.cheapBase');
  if (baseCard.cost <= 5) return shiftTier('free.midBase');
  return shiftTier('free.expensiveBase');
}

/**
 * Score a Shift paid in ink drops. It spends no ink, so curve gap does not apply; what matters
 * is who supplies the drops. A base that gets at least as many as the Shift removes pays for it
 * itself (Baymax - Lab Assistant gets the 2 that Baymax - Amped Up removes). Otherwise other
 * cards must supply them, and the pair sits at the neutral 5.
 */
function inkDropShiftScore(
  baseCard: LorcanaCard,
  dropCost: number,
): {score: number; reason: string} {
  if (getInkDropGain(baseCard) >= dropCost) return shiftTier('drops.basePays');
  return shiftTier('drops.outside');
}

/** Score the gap=1 case based on inkable fallback flexibility (both / one / neither). */
function onCurveScore(
  shiftCard: LorcanaCard,
  baseCard: LorcanaCard,
): {score: number; reason: string} {
  if (baseCard.inkwell && shiftCard.inkwell) return shiftTier('curve.bothInkable');
  if (baseCard.inkwell || shiftCard.inkwell) return shiftTier('curve.oneInkable');
  return shiftTier('curve.neitherInkable');
}

/** Score a paid Shift based on the curve gap (shiftCost - baseCost). */
function curveAlignmentScore(
  shiftCard: LorcanaCard,
  baseCard: LorcanaCard,
  curveGap: number,
): {score: number; reason: string} {
  if (curveGap === 1) return onCurveScore(shiftCard, baseCard);
  if (curveGap === 2) return shiftTier('curve.gap2');
  if (curveGap === 0) return shiftTier('curve.gap0');
  if (curveGap === 3) return shiftTier('curve.gap3');
  // Poor alignment: 4+ turn gap or negative (shift costs less than base)
  return shiftTier('curve.poor');
}

function calculateShiftBaseScore(
  shiftCard: LorcanaCard,
  baseCard: LorcanaCard,
  shiftCost: number,
  payment: ShiftPayment,
): {score: number; reason: string} {
  if (payment === 'ink-drops') return inkDropShiftScore(baseCard, shiftCost);
  if (shiftCost === 0) return freeShiftScore(shiftCard, baseCard);
  return curveAlignmentScore(shiftCard, baseCard, shiftCost - baseCard.cost);
}

/**
 * Check if a target card is a valid Shift target for the given Shift variant.
 * - standard: same base name (character)
 * - classification: character with the required classification
 * - universal: any character
 * - named-item: the item this shift lands on
 *
 * Each case asserts the target's own card type (character vs item), so callers can pass the
 * full card pool without a separate type pre-filter.
 */
function isValidShiftTarget(
  shiftType: ShiftType,
  shiftCard: LorcanaCard,
  target: LorcanaCard,
): boolean {
  switch (shiftType.kind) {
    case 'standard':
      // Team cards ("Belle & Beast") shift onto either named half, so match the
      // target's base name against every name the shifter can land on.
      return isCharacter(target) && getShiftBaseNames(shiftCard).includes(getBaseName(target));
    case 'classification':
      return isCharacter(target) && hasClassification(target, shiftType.classification);
    case 'universal':
      return isCharacter(target);
    case 'named-item':
      // The card-type gate is load-bearing: a character named/classified "Potato" must NOT
      // match — only an item named Potato does. Name match is case-insensitive to match the
      // hasClassification convention, so card-data casing drift can't silently break it.
      return isItem(target) && getBaseName(target).toLowerCase() === shiftType.itemName.toLowerCase();
  }
}

// ============================================
// LOCATION SYNERGY HELPERS
// ============================================

/** Score mapping for each location role when matched against a Location card */
const LOCATION_ROLE_SCORE: Record<LocationRole, number> = {
  'at-payoff': 7,
  'play-trigger': 7,
  'move-trigger': 7,
  buff: 7,
  'location-ramp': 7,
  move: 5,
  'in-play-check': 5,
  search: 5,
  boost: 5,
};

/** Human-readable labels for each location role */
const ROLE_LABELS: Record<LocationRole, string> = {
  'at-payoff': 'at location payoff',
  'play-trigger': 'play trigger',
  'move-trigger': 'move trigger',
  buff: 'location buff',
  'location-ramp': 'location ramp',
  move: 'move to location',
  'in-play-check': 'location check',
  search: 'location search',
  boost: 'location boost',
};

/** Short chip labels for each location role (used in UI) */
// Labels are single-sourced from the mechanics catalog (STRUCTURAL_MECHANICS) so
// a location role reads identically on the carousel tiles and in the card-detail
// synergy descriptions. Rename a location label in mechanics.ts, not here.
export const LOCATION_ROLE_CHIP_LABELS: Record<LocationRole, string> = {
  'at-payoff': mechanicLabel('at-payoff'),
  'play-trigger': mechanicLabel('play-trigger'),
  'move-trigger': mechanicLabel('move-trigger'),
  buff: mechanicLabel('buff'),
  'location-ramp': mechanicLabel('location-ramp'),
  move: mechanicLabel('move'),
  'in-play-check': mechanicLabel('in-play-check'),
  search: mechanicLabel('search'),
  boost: mechanicLabel('boost'),
};

/** Educational descriptions explaining what each location role means, templated with card name and location name */
export const LOCATION_ROLE_DESCRIPTIONS: Record<
  LocationRole,
  (cardName: string, locationName: string) => string
> = {
  'at-payoff': (_name, loc) => `Gets bonuses when characters are at ${loc}.`,
  'play-trigger': (_name, loc) => `Activates effects when you play ${loc}.`,
  'move-trigger': (_name, loc) => `Triggers effects when a character moves to ${loc}.`,
  buff: (_name, loc) => `Strengthens ${loc} with Resist or stat boosts.`,
  'location-ramp': (_name, loc) => `Reduces the cost of moving characters to ${loc}.`,
  move: (_name, loc) => `Moves characters to ${loc} for an advantage.`,
  'in-play-check': (_name, loc) => `Gains benefits when ${loc} is in play.`,
  search: (_name, loc) => `Searches your deck or discard for ${loc}.`,
  boost: (_name, loc) => `Powers up ${loc} via the Boost keyword.`,
};

/**
 * Complementary role pairs — roles that mechanically interact.
 * Each key lists roles that it directly enables or benefits from.
 * Only pairs with at least one complementary interaction get cross-synergy.
 */
const COMPLEMENTARY_ROLES: Partial<Record<LocationRole, LocationRole[]>> = {
  // Enablers: these roles help get locations into play or onto the board
  search: ['at-payoff', 'play-trigger', 'move-trigger', 'buff', 'move', 'in-play-check', 'boost'],
  'location-ramp': ['at-payoff', 'play-trigger', 'move-trigger', 'buff', 'move', 'in-play-check', 'boost'],
  // Positioning: move enables payoffs (incl. move-trigger) and benefits from buffs
  move: ['at-payoff', 'buff', 'move-trigger'],
  // Consumers: these need locations/positioning that enablers provide
  'at-payoff': ['move', 'search', 'location-ramp', 'buff'],
  'play-trigger': ['search', 'location-ramp'],
  // move-trigger fires off the `move` enabler; search/ramp supply the destination.
  'move-trigger': ['move', 'search', 'location-ramp'],
  buff: ['move', 'search', 'location-ramp', 'at-payoff', 'in-play-check'],
  'in-play-check': ['search', 'location-ramp'],
  boost: ['search', 'location-ramp'],
};

/** Roles that represent high-value location strategy pieces */
const HIGH_VALUE_ROLES: Set<LocationRole> = new Set([
  'at-payoff',
  'play-trigger',
  'move-trigger',
  'buff',
  'location-ramp',
]);

/** Check if any role in `from` has a complementary relationship with any role in `to`. */
function hasComplementaryRole(from: LocationRole[], to: LocationRole[]): boolean {
  return from.some((role) => {
    const complements = COMPLEMENTARY_ROLES[role];
    return complements != null && to.some((r) => complements.includes(r));
  });
}

/**
 * Determine cross-synergy score between two location-support cards.
 * Only cards with complementary roles get cross-synergy — same-role or
 * unrelated-role pairs return null (no synergy).
 * Complementary high-value pairs score 5, others score 3.
 */
export function getCrossSynergyScore(
  rolesA: LocationRole[],
  rolesB: LocationRole[],
): number | null {
  if (rolesA.length === 0 || rolesB.length === 0) return null;

  // Check both directions: A complements B, or B complements A
  if (!hasComplementaryRole(rolesA, rolesB) && !hasComplementaryRole(rolesB, rolesA)) return null;

  const aHighValue = rolesA.some((r) => HIGH_VALUE_ROLES.has(r));
  const bHighValue = rolesB.some((r) => HIGH_VALUE_ROLES.has(r));

  if (aHighValue && bHighValue) return 5;
  return 3;
}

/** Build a Location ↔ location-support match (or null when role-specific gating excludes the location). */
function buildLocationDirectMatch(
  card: LorcanaCard,
  location: LorcanaCard,
  role: LocationRole,
): SynergyMatch | null {
  if (role === 'boost' && !isBoostBeneficiaryLocation(location)) return null;
  // A classified buff ("Your Hyperia City locations get ...") reaches only its own locations.
  if (role === 'buff' && !locationBuffReaches(card, location)) return null;
  return {
    card: location,
    score: LOCATION_ROLE_SCORE[role],
    explanation: `${card.name} has ${ROLE_LABELS[role]} — Works with locations`,
    bidirectional: true,
  };
}

/** Build a cross-synergy match between two location-support cards (or null when roles don't complement). */
function buildLocationCrossMatch(
  _card: LorcanaCard,
  other: LorcanaCard,
  cardRoles: LocationRole[],
  role: LocationRole,
): SynergyMatch | null {
  const otherRoles = getLocationRoles(other);
  const score = getCrossSynergyScore(cardRoles, otherRoles);
  if (score === null) return null;
  const otherLabel = otherRoles.map((r) => ROLE_LABELS[r]).join(' + ');
  return {
    card: other,
    score,
    explanation: `${ROLE_LABELS[role]} and ${otherLabel} are complementary location roles.`,
    bidirectional: true,
  };
}

/** Build synergies for a location-support card: find Locations + cross-synergies */
function findLocationSupportSynergies(
  card: LorcanaCard,
  allCards: LorcanaCard[],
  role: LocationRole,
): SynergyMatch[] {
  const matches: SynergyMatch[] = [];
  const cardRoles = getLocationRoles(card);

  for (const other of allCards) {
    if (other.id === card.id) continue;
    const match = isLocation(other)
      ? buildLocationDirectMatch(card, other, role)
      : isLocationSupportCard(other)
        ? buildLocationCrossMatch(card, other, cardRoles, role)
        : null;
    if (match) matches.push(match);
  }

  return matches;
}

/** Build synergies for a Location card: find support cards with a specific role */
function findLocationCardSynergiesForRole(
  card: LorcanaCard,
  allCards: LorcanaCard[],
  role: LocationRole,
): SynergyMatch[] {
  const matches: SynergyMatch[] = [];

  for (const other of allCards) {
    if (other.id === card.id) continue;
    if (isLocation(other)) continue; // Locations don't synergize with each other

    const roles = getLocationRoles(other);
    if (!roles.includes(role)) continue;
    if (role === 'buff' && !locationBuffReaches(other, card)) continue;

    matches.push({
      card: other,
      score: LOCATION_ROLE_SCORE[role],
      explanation: `${other.name} has ${ROLE_LABELS[role]}`,
      bidirectional: true,
    });
  }

  return matches;
}

interface LocationRuleSpec {
  id: string;
  name: string;
  role: LocationRole;
  pattern: RegExp;
  excludePattern?: RegExp;
}

function locationRuleMatches(spec: LocationRuleSpec, card: LorcanaCard): boolean {
  if (isLocation(card)) {
    // Boost role pairs supports with locations that actually use cards beneath them.
    // Generic locations are not valid boost targets.
    if (spec.role === 'boost') return isBoostBeneficiaryLocation(card);
    return true;
  }
  if (!card.text) return false;
  const normalizedText = normalizeCardText(card);
  // Exclude anti-location cards (banish/remove locations)
  if (LOCATION_PATTERNS['anti-location'].test(normalizedText)) return false;
  if (spec.excludePattern && spec.excludePattern.test(normalizedText)) return false;
  return spec.pattern.test(normalizedText);
}

/** Create a single location rule for a specific pattern */
function createLocationRule(spec: LocationRuleSpec): SynergyRule {
  return {
    id: `location-${spec.id}`,
    name: spec.name,
    category: 'playstyle',
    playstyleId: 'location-control',
    description: `Location synergy: ${spec.name}`,
    matches: (card) => locationRuleMatches(spec, card),
    findSynergies: (card, allCards) =>
      isLocation(card)
        ? findLocationCardSynergiesForRole(card, allCards, spec.role)
        : findLocationSupportSynergies(card, allCards, spec.role),
  };
}

/** Specs for all 9 location rules (order matters for deduplication). */
const LOCATION_RULE_SPECS: readonly LocationRuleSpec[] = [
  {
    id: 'at-payoff',
    name: 'At Location Payoff',
    role: 'at-payoff',
    pattern: LOCATION_PATTERNS['at-payoff'],
  },
  {
    id: 'play-trigger',
    name: 'Location Play Trigger',
    role: 'play-trigger',
    pattern: LOCATION_PATTERNS['play-trigger'],
  },
  {
    id: 'move-trigger',
    name: 'Location Move Trigger',
    role: 'move-trigger',
    pattern: LOCATION_PATTERNS['move-trigger'],
  },
  {id: 'buff', name: 'Location Buff', role: 'buff', pattern: LOCATION_PATTERNS.buff},
  {
    id: 'location-ramp',
    name: 'Location Ramp',
    role: 'location-ramp',
    pattern: LOCATION_PATTERNS['location-ramp'],
  },
  {
    id: 'move',
    name: 'Move to Location',
    role: 'move',
    pattern: LOCATION_PATTERNS.move,
    excludePattern: LOCATION_PATTERNS['move-exclude'],
  },
  {
    id: 'in-play-check',
    name: 'Location In-Play Check',
    role: 'in-play-check',
    pattern: LOCATION_PATTERNS['in-play-check'],
  },
  {id: 'search', name: 'Location Search', role: 'search', pattern: LOCATION_PATTERNS.search},
  {id: 'boost', name: 'Location Boost', role: 'boost', pattern: LOCATION_PATTERNS.boost},
];

/** Create all 9 location synergy rules (order matters for deduplication) */
function createLocationRules(): SynergyRule[] {
  return LOCATION_RULE_SPECS.map(createLocationRule);
}

// ============================================
// DISCARD SCORING HELPERS (labels now live in the mechanics catalog)
// ============================================

/** Standalone educational descriptions for location roles (no card name needed) */
export const LOCATION_ROLE_TOOLTIP: Record<LocationRole, string> = {
  'at-payoff': 'Get benefits when characters are at a location',
  'play-trigger': 'Trigger effects when you play a location',
  'move-trigger': 'Trigger effects when a character moves to a location',
  buff: 'Give locations stat boosts and protection',
  'location-ramp': 'Reduce the cost of playing or moving to locations',
  move: 'Move characters to locations',
  'in-play-check': 'Get benefits when you have locations in play',
  search: 'Search your deck or discard for locations',
  boost: 'Put cards under locations to boost their abilities',
};

// ============================================
// SINGER + SONGS HELPERS
// ============================================

function singerSongScore(diff: number): number {
  if (diff === 0) return 8;
  if (diff === 1) return 7;
  if (diff === 2) return 6;
  return 5;
}

function makeSingerSongMatch(
  singer: LorcanaCard,
  song: LorcanaCard,
  target: LorcanaCard,
): SynergyMatch {
  const singerValue = getKeywordValue(singer, 'Singer') ?? singer.cost;
  return {
    card: target,
    score: singerSongScore(singerValue - song.cost),
    explanation: `Singer ${singerValue} sings any cost ${song.cost} or lower song for free.`,
    bidirectional: true,
  };
}

/** Forward: a Singer card finds Songs it can sing for free. */
function findSongsForSinger(singer: LorcanaCard, allCards: LorcanaCard[]): SynergyMatch[] {
  const singerValue = getKeywordValue(singer, 'Singer') ?? singer.cost;
  return allCards
    .filter((other) => other.id !== singer.id && isSong(other) && other.cost <= singerValue)
    .map((song) => makeSingerSongMatch(singer, song, song));
}

/** Reverse: a Song card finds Singers that can sing it. */
function findSingersForSong(song: LorcanaCard, allCards: LorcanaCard[]): SynergyMatch[] {
  return allCards
    .filter((other) => {
      if (other.id === song.id) return false;
      if (!hasKeyword(other, 'Singer')) return false;
      const singerValue = getKeywordValue(other, 'Singer') ?? other.cost;
      return song.cost <= singerValue;
    })
    .map((singer) => makeSingerSongMatch(singer, song, singer));
}

// ============================================
// SHIFT TARGETS HELPERS
// ============================================

function makeShiftMatch(
  shiftCard: LorcanaCard,
  baseCard: LorcanaCard,
  target: LorcanaCard,
): SynergyMatch {
  const {score, reason} = calculateShiftSynergy(shiftCard, baseCard);
  // The searcher (modal cardA / left card / token A) is whichever card is NOT the target.
  // If target === baseCard, searcher = shiftCard → A is the shift card, B is the base.
  // If target === shiftCard, searcher = baseCard → A is the base, B is the shift card.
  const searcherIsShift = baseCard.id === target.id;
  const baseToken = searcherIsShift ? '{B}' : '{A}';
  const shiftToken = searcherIsShift ? '{A}' : '{B}';
  const explanation = reason.replace(/<BASE>/g, baseToken).replace(/<SHIFT>/g, shiftToken);
  return {card: target, score, explanation, bidirectional: true};
}

/** Forward: a Shift card finds valid targets per its variant (character or item). */
function findShiftTargets(shiftCard: LorcanaCard, allCards: LorcanaCard[]): SynergyMatch[] {
  const shiftType = getShiftType(shiftCard);
  if (!shiftType) return [];
  // No card-type pre-filter here: isValidShiftTarget asserts the right type per variant
  // (characters for standard/classification/universal, items for named-item).
  return allCards
    .filter((other) => other.id !== shiftCard.id && isValidShiftTarget(shiftType, shiftCard, other))
    .map((target) => makeShiftMatch(shiftCard, target, target));
}

/** Reverse: a non-Shift character finds Shift cards that can target it. */
function findShiftSourcesForBase(baseCard: LorcanaCard, allCards: LorcanaCard[]): SynergyMatch[] {
  return allCards
    .filter((other) => {
      if (other.id === baseCard.id || !isCharacter(other)) return false;
      const otherShift = getShiftType(other);
      return !!otherShift && isValidShiftTarget(otherShift, other, baseCard);
    })
    .map((shiftCard) => makeShiftMatch(shiftCard, baseCard, shiftCard));
}

// ============================================
// SPIKE SUIT HELPERS (Dale - Ready for His Shot)
// ============================================

/**
 * Minimum willpower − strength gap a character needs to be a worthwhile Spike Suit
 * payoff. Below +3 the bonus combat damage is marginal (a 2/3 hitting for 3), so we
 * floor here to keep the synergy meaningful in both directions and avoid flooding
 * hundreds of low-gap character pages with a trivial Dale entry.
 */
const SPIKE_SUIT_FLOOR = 3;

/** The bonus combat damage Spike Suit hands this character (willpower − strength). */
function spikeSuitGap(card: LorcanaCard): number {
  return (card.willpower ?? 0) - (card.strength ?? 0);
}

/** True when a character has no strength — Spike Suit transforms it from wall to threat. */
function isSpikeSuitWall(card: LorcanaCard): boolean {
  return (card.strength ?? 0) === 0;
}

/**
 * Anchor: a card whose ability swaps your team's combat damage from strength to
 * willpower (Dale - Ready for His Shot's SPIKE SUIT). Matched on the ability text,
 * not a card id, so any future reprint with the same wording joins the rule for free.
 */
function isSpikeSuitAnchor(card: LorcanaCard): boolean {
  return /deal damage with their .* instead of their/i.test(normalizeCardText(card));
}

/** Payoff: a character whose willpower beats its strength by at least the floor. */
function isSpikeSuitPayoff(card: LorcanaCard): boolean {
  return isCharacter(card) && spikeSuitGap(card) >= SPIKE_SUIT_FLOOR;
}

/**
 * Score a Spike Suit pairing from the payoff's stats. The gap (willpower − strength)
 * is exactly the bonus combat damage the pairing unlocks, so the score scales with it.
 * The floor (gap >= 3) is already enforced by isSpikeSuitPayoff before we get here.
 */
function spikeSuitScore(payoff: LorcanaCard): number {
  // gap (>= 3 here) is the bonus combat damage Spike Suit unlocks, so it anchors the
  // score: gap 3 → 6 (floor of Moderate), gap 4 → 7, … capped at 10. Strength-0 walls
  // get +1 on top — they go from a non-combatant to a full-willpower threat, a bigger
  // jump than the raw gap alone conveys. Validated spread: 0 Weak / 108 Moderate /
  // 89 Strong / 7 Perfect across the 204 deck-compatible payoffs.
  const gap = spikeSuitGap(payoff);
  const wallBonus = isSpikeSuitWall(payoff) ? 1 : 0;
  return Math.min(gap + 3 + wallBonus, 10);
}

/**
 * Build a Spike Suit match. `searcherIsAnchor` is true when the anchor (Dale) is the
 * card being viewed, so it reads as {A} and the payoff as {B}; in the reverse direction
 * the payoff is {A} and the anchor is {B}. Token-swap keeps the anchor framed as the
 * enabler regardless of which page the pair is viewed from.
 */
function makeSpikeSuitMatch(
  payoff: LorcanaCard,
  target: LorcanaCard,
  searcherIsAnchor: boolean,
): SynergyMatch {
  const anchorToken = searcherIsAnchor ? '{A}' : '{B}';
  const payoffToken = searcherIsAnchor ? '{B}' : '{A}';
  // Optional stat fields default to 0 (same as spikeSuitGap). The gap-3 floor already
  // guarantees a real willpower here; this just keeps the text type-safe.
  const willpower = payoff.willpower ?? 0;
  const strength = payoff.strength ?? 0;
  // One template covers walls and bodies alike: "instead of its 0 strength" reads
  // cleanly for a 0-strength body without special-casing (and no a/an grammar hazard).
  const explanation = `${anchorToken} lets ${payoffToken} deal damage with its ${willpower} willpower instead of its ${strength} strength.`;
  return {card: target, score: spikeSuitScore(payoff), explanation, bidirectional: true};
}

/** Forward: the anchor (Dale) finds qualifying high-willpower payoff characters. */
function findSpikeSuitPayoffs(anchor: LorcanaCard, allCards: LorcanaCard[]): SynergyMatch[] {
  return allCards
    .filter((other) => other.id !== anchor.id && isSpikeSuitPayoff(other))
    .map((payoff) => makeSpikeSuitMatch(payoff, payoff, true));
}

/** Reverse: a high-willpower payoff finds anchor cards (Dale) that boost it. */
function findSpikeSuitAnchors(payoff: LorcanaCard, allCards: LorcanaCard[]): SynergyMatch[] {
  return allCards
    .filter((other) => other.id !== payoff.id && isSpikeSuitAnchor(other))
    .map((anchor) => makeSpikeSuitMatch(payoff, anchor, false));
}

// ============================================
// FREE PLAY (Pocahontas - Guiding the Tribe)
// ============================================

/**
 * Anchor: a card whose ability plays a cost-1 character for free (Pocahontas - Guiding
 * the Tribe's STAY CLOSE). Matched on the ability text, not a card id, so any future
 * reprint with the same wording joins the rule for free. Matches Pocahontas - Guiding the
 * Tribe and the dual-legend Pocahontas & Meeko in the current Core pool.
 */
function isFreePlayAnchor(card: LorcanaCard): boolean {
  return /play a character with cost 1 for free/i.test(normalizeCardText(card));
}

/** Payoff: a cost-1 character the anchor can drop for free. */
function isFreePlayPayoff(card: LorcanaCard): boolean {
  return isCharacter(card) && card.cost === 1;
}

/**
 * True when a cost-1 character carries a "when you play this character" effect. The free
 * play triggers it too, turning a free body into a free two-for-one.
 */
function hasOnPlayEffect(card: LorcanaCard): boolean {
  return /when you play this character/i.test(normalizeCardText(card));
}

/**
 * Score a free-play pairing. Two flat tiers (design locked with the user): every cost-1
 * body is a free tempo play worth the Moderate tier, and one whose on-play effect the
 * free play also triggers is a two-for-one worth the Strong tier.
 */
function scoreFreePlayPayoff(payoff: LorcanaCard): number {
  // Two flat tiers: every free cost-1 body clears the Moderate floor (6); one whose
  // on-play effect the free play also triggers is a two-for-one worth the Strong tier (8).
  return hasOnPlayEffect(payoff) ? 8 : 6;
}

/**
 * Build a free-play match. `searcherIsAnchor` is true when the anchor (Pocahontas) is the
 * card being viewed, so it reads as {A} and the payoff as {B}; the tokens swap in the
 * reverse direction. This keeps the anchor framed as the enabler on either card's page.
 */
function makeFreePlayMatch(
  payoff: LorcanaCard,
  target: LorcanaCard,
  searcherIsAnchor: boolean,
): SynergyMatch {
  const anchorToken = searcherIsAnchor ? '{A}' : '{B}';
  const payoffToken = searcherIsAnchor ? '{B}' : '{A}';
  const explanation = hasOnPlayEffect(payoff)
    ? `${anchorToken} plays ${payoffToken} for free, triggering its on-play effect.`
    : `${anchorToken} plays ${payoffToken} for free.`;
  return {card: target, score: scoreFreePlayPayoff(payoff), explanation, bidirectional: true};
}

/** Forward: the anchor (Pocahontas) finds cost-1 characters it can play for free. */
function findFreePlayPayoffs(anchor: LorcanaCard, allCards: LorcanaCard[]): SynergyMatch[] {
  return allCards
    .filter((other) => other.id !== anchor.id && isFreePlayPayoff(other))
    .map((payoff) => makeFreePlayMatch(payoff, payoff, true));
}

/** Reverse: a cost-1 character finds anchors (Pocahontas) that play it for free. */
function findFreePlayAnchors(payoff: LorcanaCard, allCards: LorcanaCard[]): SynergyMatch[] {
  return allCards
    .filter((other) => other.id !== payoff.id && isFreePlayAnchor(other))
    .map((anchor) => makeFreePlayMatch(payoff, anchor, false));
}

// ============================================
// MERIDA ARCHER HELPERS (Merida - Formidable Archer, STEADY AIM)
// ============================================

/**
 * Score a Merida pairing from the payoff action's stats. STEADY AIM adds a flat
 * +2 to every hit, so a bigger base action is a bigger absolute upgrade; the
 * printed damage (capped at 3 so a lone 4-damage nuke doesn't dwarf a repeatable
 * 3) anchors the score, and a multi-target action earns +1 because each extra
 * body is another STEADY AIM trigger.
 *
 *   score = min(5 + min(actionDamage, 3) + (multiTarget ? 1 : 0), 10)
 *
 * Floor is 6 (a 1-damage single-target still becomes a real +2 upgrade). Validated
 * spread across the 19 deck-compatible payoffs: 1x6 / 11x7 / 5x8 / 2x9.
 */
function steadyAimScore(action: LorcanaCard): number {
  const damage = Math.min(getActionDamage(action), 3);
  const multiBonus = isMultiTargetDamageAction(action) ? 1 : 0;
  return Math.min(5 + damage + multiBonus, 10);
}

/**
 * Build a Merida match. `searcherIsAnchor` is true when Merida (the anchor) is the
 * card being viewed, so she reads as {A} and the action as {B}; in the reverse
 * direction the action is {A} and Merida is {B}. Token-swap keeps Merida framed as
 * the enabler regardless of which page the pair is viewed from.
 */
function makeMeridaMatch(
  action: LorcanaCard,
  target: LorcanaCard,
  searcherIsAnchor: boolean,
): SynergyMatch {
  const anchorToken = searcherIsAnchor ? '{A}' : '{B}';
  const actionToken = searcherIsAnchor ? '{B}' : '{A}';
  const damage = getActionDamage(action);
  const explanation = `${anchorToken}'s STEADY AIM adds 2 damage to ${actionToken}'s ${damage} damage each time it hits an opposing character.`;
  return {card: target, score: steadyAimScore(action), explanation, bidirectional: true};
}

/** Forward: the anchor (Merida) finds damage-dealing Action payoffs. */
function findMeridaActions(anchor: LorcanaCard, allCards: LorcanaCard[]): SynergyMatch[] {
  return allCards
    .filter((other) => other.id !== anchor.id && isMeridaDamageAction(other))
    .map((action) => makeMeridaMatch(action, action, true));
}

/** Reverse: a damage-dealing Action finds anchor cards (Merida) that amplify it. */
function findMeridaAnchors(action: LorcanaCard, allCards: LorcanaCard[]): SynergyMatch[] {
  return allCards
    .filter((other) => other.id !== action.id && isSteadyAimAnchor(other))
    .map((anchor) => makeMeridaMatch(action, anchor, false));
}

// ============================================
// MERIDA - WISP CONJURER (BECKON) HELPERS
// ============================================

/**
 * Score by enabler tier — how much exerted-entry pressure the enabler generates for BECKON:
 *   engine     8  board-wide / repeatable push of OTHER characters (win-condition engine)
 *   reanimator 7  a body that replays ITSELF exerted from the discard, repeatably
 *   self       5  a one-shot self-only body (Bodyguard reminder) — density baseline
 * 5 is the same-deck-density floor; 7/8 justify themselves by firing BECKON repeatedly.
 */
const BECKON_TIER_SCORE: Record<BeckonEnablerTier, number> = {
  engine: 8,
  reanimator: 7,
  self: 5,
};

/** Per-tier explanation fragment describing WHAT the enabler does (subject-free, the template adds the actor). */
const BECKON_TIER_REASON: Record<BeckonEnablerTier, string> = {
  engine: 'repeatedly pushes your characters into play exerted',
  reanimator: 'keeps replaying itself into play exerted from your discard',
  self: 'enters play exerted',
};

/**
 * Build a BECKON match. `searcherIsAnchor` is true when Merida (the anchor) is the card being
 * viewed, so she reads as {A} and the enabler as {B}; reversed on the enabler's page. The
 * token-swap keeps Merida framed as the payoff ("{Merida} draws when {enabler} ...") regardless
 * of direction, mirroring the Spike Suit token-swap.
 */
function makeBeckonMatch(
  enablerTier: BeckonEnablerTier,
  target: LorcanaCard,
  searcherIsAnchor: boolean,
): SynergyMatch {
  const anchorToken = searcherIsAnchor ? '{A}' : '{B}';
  const enablerToken = searcherIsAnchor ? '{B}' : '{A}';
  return {
    card: target,
    score: BECKON_TIER_SCORE[enablerTier],
    explanation: `${enablerToken} ${BECKON_TIER_REASON[enablerTier]}, so ${anchorToken} draws a card each time.`,
    bidirectional: true,
  };
}

/** Forward: the anchor (Merida) finds every card that pushes your characters into play exerted. */
function findBeckonEnablers(anchor: LorcanaCard, allCards: LorcanaCard[]): SynergyMatch[] {
  const matches: SynergyMatch[] = [];
  for (const other of allCards) {
    if (other.id === anchor.id) continue;
    const tier = getBeckonEnablerTier(other);
    if (tier === null) continue;
    matches.push(makeBeckonMatch(tier, other, true));
  }
  return matches;
}

/** Reverse: an exerted-entry enabler finds the anchor (Merida). */
function findBeckonAnchors(enabler: LorcanaCard, allCards: LorcanaCard[]): SynergyMatch[] {
  const tier = getBeckonEnablerTier(enabler);
  if (tier === null) return [];
  return allCards
    .filter((other) => other.id !== enabler.id && isBeckonAnchor(other))
    .map((anchor) => makeBeckonMatch(tier, anchor, false));
}

// ============================================
// SYNERGY RULES
// ============================================

export const synergyRules: SynergyRule[] = [
  // --------------------------------------------
  // SHIFT TARGETS
  // --------------------------------------------
  {
    id: 'shift-targets',
    name: TUNING.directRules['shift-targets'].name,
    category: 'direct',
    description: TUNING.directRules['shift-targets'].description,

    // Matches characters and items: Shift cards find targets (forward), base cards find
    // Shift cards (reverse). Items are included so item-target shifts (named-item) resolve
    // from the item side too.
    matches: (card) => isCharacter(card) || isItem(card),

    findSynergies: (card, allCards) => {
      if (getShiftType(card)) return findShiftTargets(card, allCards);
      return findShiftSourcesForBase(card, allCards);
    },
  },

  // --------------------------------------------
  // NAMED COMPANIONS (display label: "Companions")
  // --------------------------------------------
  {
    id: 'named-companions',
    name: 'Companions',
    category: 'direct',
    description: 'Cards that reference specific named characters, items, locations, or actions',

    matches: (card) => {
      // Forward: card references other named entities
      if (getNamedReferences(card).length > 0) return true;
      // Reverse: any card could be a target of a named reference (handled in findSynergies)
      return false;
    },

    findSynergies: (card, allCards) => {
      const refs = getNamedReferences(card);
      if (refs.length === 0) return [];

      const effectTier = classifyNamedEffect(card);
      const score = NAMED_EFFECT_SCORES[effectTier];
      const matches: SynergyMatch[] = [];

      for (const refName of refs) {
        // Find all cards whose base name matches the referenced name
        const targets = allCards.filter((other) => other.id !== card.id && other.name === refName);

        for (const target of targets) {
          matches.push({
            card: target,
            score,
            explanation: `Has a ${effectTier} effect when ${refName} is in play.`,
            bidirectional: true,
          });
        }
      }

      return matches;
    },
  },

  // --------------------------------------------
  // LORE LOSS
  // --------------------------------------------
  {
    id: 'lore-loss',
    name: 'Lore Loss',
    category: 'playstyle',
    playstyleId: 'lore-denial',
    description: 'Cards that make the opponent lose lore reinforce the same denial strategy',

    matches: isLoreDenialCard,

    findSynergies: (card, allCards) => {
      const cardRoles = getLoreDenialRoles(card);
      if (cardRoles.length === 0) return [];
      const cardRole = cardRoles[0]; // burn and steal are mutually exclusive — exactly one role per card

      const matches: SynergyMatch[] = [];
      for (const other of allCards) {
        if (other.id === card.id) continue;
        const otherRoles = getLoreDenialRoles(other);
        if (otherRoles.length === 0) continue;
        const otherRole = otherRoles[0];

        const {score, explanation} = scoreLoreDenialPair(cardRole, otherRole, card, other);
        matches.push({card: other, score, explanation, bidirectional: true});
      }
      return matches;
    },
  },

  // --------------------------------------------
  // LOCATION SYNERGIES
  // --------------------------------------------
  ...createLocationRules(),

  // --------------------------------------------
  // DISCARD CONTROL
  // --------------------------------------------
  {
    id: 'discard',
    name: 'Discard',
    category: 'playstyle',
    playstyleId: 'discard',
    description:
      'Cards that force opponents to discard synergize with each other and with hand-size payoffs',

    matches: isDiscardCard,

    findSynergies: (card, allCards) =>
      pairFindSynergies(card, allCards, getDiscardRoles, scoreDiscardPair),
  },

  // --------------------------------------------
  // SACRIFICE ("Banish Matters")
  // --------------------------------------------
  {
    id: 'sacrifice',
    name: 'Sacrifice',
    category: 'playstyle',
    playstyleId: 'sacrifice',
    description:
      'Self-banish cards banish your own characters on demand to cash in banish-trigger payoffs',

    matches: isSacrificeCard,

    findSynergies: (card, allCards) =>
      pairFindSynergies(card, allCards, getSacrificeRoles, scoreSacrificePair),
  },

  // --------------------------------------------
  // SELF-DISCARD ("Discard Matters" — player-side)
  // --------------------------------------------
  {
    id: 'self-discard',
    name: 'Self-Discard',
    category: 'playstyle',
    playstyleId: 'self-discard',
    description:
      'Discard your own cards to fill the discard, then replay them from the bin or trigger discard payoffs',

    matches: isSelfDiscardCard,

    findSynergies: (card, allCards) =>
      pairFindSynergies(card, allCards, getSelfDiscardRoles, scoreSelfDiscardPair),
  },

  // --------------------------------------------
  // SINGER + SONGS
  // --------------------------------------------
  {
    id: 'singer-songs',
    name: 'Singer + Songs',
    category: 'direct',
    description: 'Characters with Singer can exert to sing Song cards for free',

    matches: (card) => hasKeyword(card, 'Singer') || isSong(card),

    findSynergies: (card, allCards) => {
      if (hasKeyword(card, 'Singer')) return findSongsForSinger(card, allCards);
      return findSingersForSong(card, allCards);
    },
  },

  // --------------------------------------------
  // SPIKE SUIT (Dale - Ready for His Shot)
  // --------------------------------------------
  {
    id: 'spike-suit',
    name: 'Spike Suit',
    category: 'direct',
    description:
      'Spike Suit makes your characters deal combat damage with their willpower instead of their strength, so bodies with more willpower than strength hit far above their weight',

    // Anchor finds high-willpower payoffs (forward); payoffs find the anchor (reverse).
    matches: (card) => isSpikeSuitAnchor(card) || isSpikeSuitPayoff(card),

    findSynergies: (card, allCards) =>
      isSpikeSuitAnchor(card)
        ? findSpikeSuitPayoffs(card, allCards)
        : findSpikeSuitAnchors(card, allCards),
  },

  // --------------------------------------------
  // MERIDA ARCHER (Merida - Formidable Archer, STEADY AIM)
  // --------------------------------------------
  {
    id: 'merida-archer',
    name: 'Merida Archer',
    category: 'direct',
    description:
      "Merida's STEADY AIM adds 2 damage whenever one of your actions deals damage to an opposing character, so damage-dealing action cards hit far harder",

    // Anchor (Merida) finds damage-dealing Action payoffs (forward); the actions find the anchor (reverse).
    matches: (card) => isSteadyAimAnchor(card) || isMeridaDamageAction(card),

    findSynergies: (card, allCards) =>
      isSteadyAimAnchor(card)
        ? findMeridaActions(card, allCards)
        : findMeridaAnchors(card, allCards),
  },

  // --------------------------------------------
  // MERIDA - WISP CONJURER (BECKON)
  // --------------------------------------------
  {
    id: 'merida-wisp',
    name: 'Merida - Wisp Conjurer',
    category: 'direct',
    description:
      "Merida's BECKON draws a card whenever another of your characters enters play exerted, so she synergizes with cards that push your characters into play exerted — board-wide engines, self-reanimators, and Bodyguard bodies.",

    // Anchor finds exerted-entry enablers (forward); enablers find the anchor (reverse).
    matches: (card) => isBeckonAnchor(card) || getBeckonEnablerTier(card) !== null,

    findSynergies: (card, allCards) =>
      isBeckonAnchor(card)
        ? findBeckonEnablers(card, allCards)
        : findBeckonAnchors(card, allCards),
  },

  // --------------------------------------------
  // FREE PLAY (Pocahontas - Guiding the Tribe)
  // --------------------------------------------
  {
    id: 'free-play',
    name: 'Free Play',
    category: 'direct',
    description:
      "Pocahontas - Guiding the Tribe's STAY CLOSE plays a cost-1 character for free, so she pairs with every cheap body, and best with the ones whose on-play effect the free play also triggers.",

    // Anchor finds cost-1 payoffs (forward); cost-1 characters find the anchor (reverse).
    matches: (card) => isFreePlayAnchor(card) || isFreePlayPayoff(card),

    findSynergies: (card, allCards) =>
      isFreePlayAnchor(card)
        ? findFreePlayPayoffs(card, allCards)
        : findFreePlayAnchors(card, allCards),
  },

  // --------------------------------------------
  // INK RAMP (playstyle: ramp)
  // --------------------------------------------
  {
    id: 'ramp',
    name: 'Ramp',
    category: 'playstyle',
    playstyleId: 'ramp',
    description:
      'Inkwell ramp, inkwell triggers, and cost reduction cards accelerate your ink economy',

    matches: isRampCard,

    findSynergies: (card, allCards) => {
      const cardRoles = getRampRoles(card);
      if (cardRoles.length === 0) return [];

      const matches: SynergyMatch[] = [];

      for (const other of allCards) {
        if (other.id === card.id) continue;

        const otherRoles = getRampRoles(other);
        if (otherRoles.length === 0) continue;

        const score = getRampPairScore(card, cardRoles, other, otherRoles);
        if (score === 0) continue; // Skip non-overlapping cost↔cost pairs

        const explanation = getRampExplanation(card, cardRoles, other, otherRoles);

        matches.push({
          card: other,
          score,
          explanation,
          bidirectional: true,
        });
      }

      return matches;
    },
  },

  // --------------------------------------------
  // TOY TRIBAL
  // --------------------------------------------
  {
    id: 'toy',
    name: 'Toy',
    category: 'playstyle',
    playstyleId: 'toy',
    description:
      'Toy characters and Toy-payoff cards reinforce a tight tribal strategy with search effects, cost reduction, and banish recursion',

    matches: isToyCard,

    findSynergies: (card, allCards) =>
      pairFindSynergies(card, allCards, getToyRoles, scoreToyPair),
  },

  // --------------------------------------------
  // SEVEN DWARFS TRIBAL
  // --------------------------------------------
  {
    id: 'dwarfs',
    name: 'Seven Dwarfs',
    category: 'playstyle',
    playstyleId: 'dwarfs',
    description:
      'Seven Dwarfs characters and the payoffs that reward running them — density draws, free recruits, and bounce-for-value effects compound as you fill the board with Dwarfs',

    matches: isDwarfsCard,

    findSynergies: (card, allCards) =>
      pairFindSynergies(card, allCards, getDwarfsRoles, scoreDwarfsPair),
  },

  // --------------------------------------------
  // FLOODBORNS (Floodborn matters, payoff-anchored)
  // --------------------------------------------
  // Payoff-anchored: makePayoffAnchoredRule drops member-member pairs (neither side a
  // payoff) so two plain Floodborn never synergize.
  makePayoffAnchoredRule(
    {
      id: 'floodborn',
      name: 'Floodborns',
      category: 'playstyle',
      playstyleId: 'floodborn',
      description:
        'Floodborn characters and the Set 13 Vine payoffs that buff or trigger off them. Payoff-anchored: a Floodborn body synergizes with payoffs, but two plain Floodborn do not synergize with each other.',
      matches: isFloodbornCard,
    },
    getFloodbornRoles,
    isFloodbornPayoff,
    scoreFloodbornPair,
  ),

  // --------------------------------------------
  // ITEMS (Item Matters, payoff-anchored)
  // --------------------------------------------
  // Payoff-anchored (like Floodborn): a pair scores only when at least one side is an
  // item payoff. Pure density (item x item, item x engine, engine x engine) is dropped —
  // those engine connections already surface via Ramp / Self-Discard.
  makePayoffAnchoredRule(
    {
      id: 'items',
      name: 'Items',
      category: 'playstyle',
      playstyleId: 'items',
      description:
        'The Set 9-13 Inventor / artifacts axis: item members, the item engine (search / recursion / cost-reduction), and the payoffs that reward playing or having items. Payoff-anchored: two plain item cards do not synergize with each other.',
      matches: isItemCard,
    },
    getItemRoles,
    isItemPayoff,
    scoreItemPair,
  ),

  // --------------------------------------------
  // HEALING (Heal Matters, payoff-anchored)
  // --------------------------------------------
  // Payoff-anchored (like Floodborn / Items): a pair scores only when at least one side is a
  // heal payoff, so healer-healer pairs are dropped.
  makePayoffAnchoredRule(
    {
      id: 'healing',
      name: 'Healing',
      category: 'playstyle',
      playstyleId: 'healing',
      description:
        'Healers remove damage from your own characters to cash in the payoffs that reward healing. Payoff-anchored: a healer synergizes with payoffs, but two plain healers do not synergize with each other.',
      matches: isHealCard,
    },
    getHealRoles,
    isHealPayoff,
    scoreHealPair,
  ),

  // --------------------------------------------
  // HUNNY TRIBAL
  // --------------------------------------------
  {
    id: 'hunny',
    name: 'Hunny',
    category: 'playstyle',
    playstyleId: 'hunny',
    description:
      'Hunny characters and the payoffs that reward running them: searches that dig the tribe out of the deck, density payoffs that scale with Hunny in play, and single-target buffs.',

    matches: isHunnyCard,

    findSynergies: (card, allCards) =>
      tribalFindSynergies(card, allCards, getHunnyRoles, scoreHunnyPair),
  },

  // --------------------------------------------
  // RED PANDA TRIBAL
  // --------------------------------------------
  {
    id: 'red-panda',
    name: 'Red Panda',
    category: 'playstyle',
    playstyleId: 'red-panda',
    description:
      'Red Panda characters and the deck-search payoff that digs the tribe out of your deck.',

    matches: isRedPandaCard,

    findSynergies: (card, allCards) =>
      tribalFindSynergies(card, allCards, getRedPandaRoles, scoreRedPandaPair),
  },

  // --------------------------------------------
  // CLASSIFICATION TRIBES (Monster, Princess, Hero, Super, Royalty, Detective, Gargoyle)
  // Generated from one shared factory — all payoff-anchored, all 5-baseline.
  // --------------------------------------------
  makeTribalRule(
    TRIBAL_SPECS.monster,
    'Monsters',
    'Monster',
    'Monster characters and the payoffs that reward fielding the tribe. Payoff-anchored: plain Monster bodies do not synergize with each other.',
  ),
  makeTribalRule(
    TRIBAL_SPECS.princess,
    'Princesses',
    'Princess',
    'The Princess archetype: Princess characters and the payoffs that buff them, dig them out of the deck, or reward having a Princess in play.',
  ),
  makeTribalRule(
    TRIBAL_SPECS.hero,
    'Heroes',
    'Hero',
    'Hero characters and the Set 12 payoffs that buff or trigger off the tribe. Payoff-anchored, so a Hero body only surfaces against the payoffs that reward it.',
  ),
  makeTribalRule(
    TRIBAL_SPECS.super,
    'Supers',
    'Super',
    'The Incredibles "Super" package: Super characters and the payoffs that pump, ready, or reward them.',
  ),
  makeTribalRule(
    TRIBAL_SPECS.royalty,
    'Royalty',
    'Royalty',
    'Queen / King / Prince characters (Royalty, kept distinct from Princess) and the payoffs that buff or reward the crown.',
  ),
  makeTribalRule(
    TRIBAL_SPECS.detective,
    'Detectives',
    'Detective',
    'The Set 10 Detective tribe (Zootopia / Great Mouse Detective): Detective characters and the payoffs that buff them, search them out, or reward having one in play.',
  ),
  makeTribalRule(
    TRIBAL_SPECS.gargoyle,
    'Gargoyles',
    'Gargoyle',
    'The Gargoyles clan: Gargoyle characters and the payoffs that buff them, fire when they challenge, lift their Stone by Day drawback, or count them in your discard.',
  ),

  // --------------------------------------------
  // EXERT (Exert Matters, opponent-facing, payoff-anchored)
  // --------------------------------------------
  {
    id: 'exert',
    name: 'Exert',
    category: 'playstyle',
    playstyleId: 'exert',
    description:
      'Effects that exert an opposing character pair with the payoffs that banish, lock, or scale off the exerted body. Payoff-anchored: two exert enablers do not synergize with each other.',

    matches: isExertCard,

    // Payoff-anchored: scoreExertPair returns null for enabler↔enabler pairs, which
    // pairFindSynergies drops.
    findSynergies: (card, allCards) =>
      pairFindSynergies(card, allCards, getExertRoles, scoreExertPair),
  },

  // --------------------------------------------
  // BOUNCE ("return from play to hand")
  // --------------------------------------------
  {
    id: 'bounce',
    name: 'Bounce',
    category: 'playstyle',
    playstyleId: 'bounce',
    description:
      'Return characters from play to hand: self-bounce re-fires enter-play abilities, opponent-bounce buys tempo and feeds the lore payoff. Payoff-anchored, so two plain bounce cards do not synergize with each other. The re-buyable-ETB pool overlaps Hero / Self-Discard / Items by nature (a good enter-play body is a good enter-play body) — accepted cross-playstyle composition.',

    matches: isBounceCard,

    // Payoff-anchored: scoreBouncePair returns null for enabler↔enabler and payoff↔payoff
    // density, and for a re-buy the enabler's target gate cannot reach (cost cap /
    // classification), which pairFindSynergies drops. Card-aware so the gate can read cost.
    findSynergies: (card, allCards) =>
      pairFindSynergies(card, allCards, getBounceRoles, scoreBouncePair),
  },

  // --------------------------------------------
  // INK DROPS (Set 14, payoff-anchored)
  // --------------------------------------------
  {
    id: 'ink-drops',
    name: 'Ink Drops',
    category: 'playstyle',
    playstyleId: 'ink-drops',
    description:
      'Cards that make ink drops pair with the cards that spend, hold, or convert them. Payoff-anchored: two drop makers do not synergize with each other.',

    matches: isInkDropCard,

    // Payoff-anchored: scoreInkDropPair returns null for maker↔maker density and for payoffs that
    // compete for the same drops, which pairFindSynergies drops.
    findSynergies: (card, allCards) =>
      pairFindSynergies(card, allCards, getInkDropRoles, scoreInkDropPair),
  },
];

// Get all rules
export const getAllRules = (): SynergyRule[] => synergyRules;

// Get rules by category
export const getRulesByCategory = (category: SynergyRule['category']): SynergyRule[] => {
  return synergyRules.filter((rule) => rule.category === category);
};

// Get rules by playstyle
export const getRulesByPlaystyle = (playstyleId: PlaystyleId): SynergyRule[] => {
  return synergyRules.filter(
    (rule) => rule.category === 'playstyle' && rule.playstyleId === playstyleId,
  );
};

// Get a specific rule by ID
export const getRuleById = (id: string): SynergyRule | undefined => {
  return synergyRules.find((rule) => rule.id === id);
};
