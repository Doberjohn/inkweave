import type {LorcanaCard, PlaystyleId, SynergyMatch, SynergyRule} from '../types';
import {
  classifyNamedEffect,
  getBaseName,
  getShiftBaseNames,
  getDiscardRoles,
  getKeywordValue,
  getLocationRoles,
  getNamedReferences,
  getRampRoles,
  getShiftType,
  hasClassification,
  hasKeyword,
  isBoostBeneficiaryLocation,
  isCharacter,
  isDeckRamp,
  isDiscardCard,
  isItem,
  isLocation,
  isLocationSupportCard,
  isRampCard,
  isRepeatingTrigger,
  costReductionTargetsOverlap,
  isSong,
  isToyCard,
  getToyRoles,
  isDwarfsCard,
  getDwarfsRoles,
  getFloodbornRoles,
  isFloodbornCard,
  getHunnyRoles,
  isHunnyCard,
  getRedPandaRoles,
  isRedPandaCard,
  isLoreDenialCard,
  getLoreDenialRoles,
  getSacrificeRoles,
  isSacrificeCard,
  LOCATION_PATTERNS,
  mechanicLabel,
  NAMED_EFFECT_SCORES,
  normalizeCardText,
  type DiscardRole,
  type LocationRole,
  type LoreDenialRole,
  type RampRole,
  type SacrificeRole,
  type ShiftType,
  type ToyRole,
  type DwarfsRole,
  type FloodbornRole,
  type HunnyRole,
  type RedPandaRole,
} from '../utils';

// ============================================
// CONDITIONAL SHIFT MATCHERS
// ============================================

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
  const shiftText = shiftCard.text.replace(/\n/g, ' ');
  const baseText = baseCard.text.replace(/\n/g, ' ');

  return SHIFT_CONDITION_MATCHERS.some(
    (matcher) => matcher.condition.test(shiftText) && matcher.satisfiedBy.test(baseText),
  );
}

/**
 * Calculate Shift synergy score and explanation based on curve alignment,
 * inkwell flexibility, free Shift tiers, and condition activation.
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
  const shiftType = getShiftType(shiftCard);
  const shiftCost = shiftType?.cost ?? shiftCard.cost;

  // Compute base score and reason from curve math
  const base = calculateShiftBaseScore(shiftCard, baseCard, shiftCost);

  // +1 bonus if the base card activates a conditional Shift condition
  const activates = baseActivatesShiftCondition(shiftCard, baseCard);
  if (activates) {
    return {
      score: Math.min(base.score + 1, 10),
      reason: `Same target. Also unlocks the free Shift condition.`,
    };
  }

  return base;
}

/** Score a free Shift (cost 0) — only the base card's cost matters since the shift itself is free. */
function freeShiftScore(
  _shiftCard: LorcanaCard,
  baseCard: LorcanaCard,
): {score: number; reason: string} {
  if (baseCard.cost <= 3) {
    return {
      score: 9,
      reason: `Free Shift. Play <BASE> early, then shift <SHIFT> in for 0 ink.`,
    };
  }
  if (baseCard.cost <= 5) {
    return {
      score: 7,
      reason: `Free Shift saves ink, but <BASE> takes longer to set up.`,
    };
  }
  return {
    score: 5,
    reason: `Free Shift, but <BASE> is expensive and hard to set up first.`,
  };
}

/** Score the gap=1 case based on inkable fallback flexibility (both / one / neither). */
function onCurveScore(
  shiftCard: LorcanaCard,
  baseCard: LorcanaCard,
): {score: number; reason: string} {
  if (baseCard.inkwell && shiftCard.inkwell) {
    return {
      score: 9,
      reason: `Perfect curve. Both cards inkable as fallback.`,
    };
  }
  if (baseCard.inkwell || shiftCard.inkwell) {
    return {
      score: 8,
      reason: `Perfect curve. One card inkable as fallback.`,
    };
  }
  return {
    score: 7,
    reason: `On curve, but neither card is inkable. Less flexible off-curve.`,
  };
}

/** Score a paid Shift based on the curve gap (shiftCost - baseCost). */
function curveAlignmentScore(
  shiftCard: LorcanaCard,
  baseCard: LorcanaCard,
  curveGap: number,
): {score: number; reason: string} {
  if (curveGap === 1) return onCurveScore(shiftCard, baseCard);
  if (curveGap === 2) {
    return {
      score: 7,
      reason: `Smooth curve. <BASE> flows into Shift in a couple of turns.`,
    };
  }
  if (curveGap === 0) {
    return {
      score: 5,
      reason: `Same cost. No ink savings from Shifting, but skips the drying phase.`,
    };
  }
  if (curveGap === 3) {
    return {score: 5, reason: `Wide 3-turn gap. Playable but slow to set up.`};
  }
  // Poor alignment: 4+ turn gap or negative (shift costs less than base)
  return {
    score: 3,
    reason: `The cost gap makes it hard to set up <BASE> in time to Shift.`,
  };
}

function calculateShiftBaseScore(
  shiftCard: LorcanaCard,
  baseCard: LorcanaCard,
  shiftCost: number,
): {score: number; reason: string} {
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
// SYNERGY RULES
// ============================================

export const synergyRules: SynergyRule[] = [
  // --------------------------------------------
  // SHIFT TARGETS
  // --------------------------------------------
  {
    id: 'shift-targets',
    name: 'Shift Targets',
    category: 'direct',
    description: 'Characters with Shift and their valid targets',

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

    findSynergies: (card, allCards) => {
      const cardRoles = getDiscardRoles(card);
      if (cardRoles.length === 0) return [];

      const matches: SynergyMatch[] = [];
      for (const other of allCards) {
        if (other.id === card.id) continue;
        const otherRoles = getDiscardRoles(other);
        if (otherRoles.length === 0) continue;
        matches.push(scoreDiscardPair(card, cardRoles, other, otherRoles));
      }
      return matches;
    },
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

    findSynergies: (card, allCards) => {
      const cardRoles = getSacrificeRoles(card);
      if (cardRoles.length === 0) return [];

      const matches: SynergyMatch[] = [];
      for (const other of allCards) {
        if (other.id === card.id) continue;
        const otherRoles = getSacrificeRoles(other);
        if (otherRoles.length === 0) continue;
        matches.push(scoreSacrificePair(card, cardRoles, other, otherRoles));
      }
      return matches;
    },
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

    findSynergies: (card, allCards) => {
      const cardRoles = getToyRoles(card);
      if (cardRoles.length === 0) return [];

      const matches: SynergyMatch[] = [];

      for (const other of allCards) {
        if (other.id === card.id) continue;
        const otherRoles = getToyRoles(other);
        if (otherRoles.length === 0) continue;

        const {score, explanation} = scoreToyPair(card, cardRoles, other, otherRoles);
        matches.push({card: other, score, explanation, bidirectional: true});
      }

      return matches;
    },
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

    findSynergies: (card, allCards) => {
      const cardRoles = getDwarfsRoles(card);
      if (cardRoles.length === 0) return [];

      const matches: SynergyMatch[] = [];

      for (const other of allCards) {
        if (other.id === card.id) continue;
        const otherRoles = getDwarfsRoles(other);
        if (otherRoles.length === 0) continue;

        const {score, explanation} = scoreDwarfsPair(card, cardRoles, other, otherRoles);
        matches.push({card: other, score, explanation, bidirectional: true});
      }

      return matches;
    },
  },

  // --------------------------------------------
  // FLOODBORNS (Floodborn matters, payoff-anchored)
  // --------------------------------------------
  {
    id: 'floodborn',
    name: 'Floodborns',
    category: 'playstyle',
    playstyleId: 'floodborn',
    description:
      'Floodborn characters and the Set 13 Vine payoffs that buff or trigger off them. Payoff-anchored: a Floodborn body synergizes with payoffs, but two plain Floodborn do not synergize with each other.',

    matches: isFloodbornCard,

    // Payoff-anchored: the scorePair callback returns null for member-member pairs
    // (neither side is a payoff), so they are never emitted.
    findSynergies: (card, allCards) =>
      tribalFindSynergies(card, allCards, getFloodbornRoles, (cardRoles, otherRoles) =>
        isFloodbornPayoff(cardRoles) || isFloodbornPayoff(otherRoles)
          ? scoreFloodbornPair(cardRoles, otherRoles)
          : null,
      ),
  },

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
];

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

function scoreDiscardPair(
  _card: LorcanaCard,
  cardRoles: DiscardRole[],
  other: LorcanaCard,
  otherRoles: DiscardRole[],
): SynergyMatch {
  const cardDisruption = hasDiscardDisruption(cardRoles);
  const otherDisruption = hasDiscardDisruption(otherRoles);
  const cardPayoff = cardRoles.includes('payoff');
  const otherPayoff = otherRoles.includes('payoff');

  if (isDiscardKillCombo(cardDisruption, cardPayoff, otherDisruption, otherPayoff)) {
    // _card is the searcher (modal cardA / left / token A); other is the partner (B).
    const disruptionToken = cardDisruption ? '{A}' : '{B}';
    const payoffToken = cardDisruption ? '{B}' : '{A}';
    return {
      card: other,
      score: 8,
      explanation: `${disruptionToken} empties the opponent's hand, powering up ${payoffToken}'s hand-size edge.`,
      bidirectional: true,
    };
  }

  // Same-side pair (both disruption or both payoff): density baseline.
  // Two enablers don't compound — they stack pressure. Two payoffs share an axis without amplifying it.
  const bothPayoff = cardPayoff && otherPayoff;
  return {
    card: other,
    score: 5,
    explanation: bothPayoff
      ? `Both reward hand-size advantage over opponents.`
      : `Both disrupt the opponent's hand.`,
    bidirectional: true,
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
function scoreSacrificePair(
  _card: LorcanaCard,
  cardRoles: SacrificeRole[],
  other: LorcanaCard,
  otherRoles: SacrificeRole[],
): SynergyMatch {
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
    // Token-swap so the SELF-BANISH side always reads as the actor, regardless of
    // which card is the searcher (token {A}) and which is the partner (token {B}).
    const selfBanishToken = cardSelfBanish ? '{A}' : '{B}';
    const payoffToken = cardSelfBanish ? '{B}' : '{A}';
    return {
      card: other,
      score: 8,
      explanation: `${selfBanishToken} banishes your own character on demand, guaranteeing ${payoffToken}'s banish payoff.`,
      bidirectional: true,
    };
  }

  // Same-side pair: density baseline. Two payoffs share the banish axis without
  // amplifying it; two self-banish cards are parallel enablers that still need a payoff body.
  const bothPayoff = cardPayoff && otherPayoff;
  return {
    card: other,
    score: 5,
    explanation: bothPayoff
      ? `Both pay off when your characters are banished: a board that trades into value.`
      : `Both banish your own characters: parallel self-banish cards.`,
    bidirectional: true,
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
function scoreLoreDenialPair(
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
  // Mixed pair — A is the searcher (modal cardA / left card), B is the partner. Compute
  // which token corresponds to burn vs steal based on which role the searcher holds.
  const burnIsA = roleA === 'burn';
  const burnToken = burnIsA ? '{A}' : '{B}';
  const stealToken = burnIsA ? '{B}' : '{A}';
  return {
    score: 6,
    explanation: `${burnToken} pushes opponents down. ${stealToken} pulls you up. Both ends pressed.`,
  };
}

// ============================================
// RAMP SCORING
// ============================================

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
  if (deckRamp && repeatingTrigger) return 9;
  if (deckRamp || repeatingTrigger) return 8;
  return 7;
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
function getRampPairScore(
  cardA: LorcanaCard,
  rolesA: RampRole[],
  cardB: LorcanaCard,
  rolesB: RampRole[],
): number {
  const flags = classifyRampPair(cardA, rolesA, cardB, rolesB);
  if (flags.shape === 'ramp-trigger')
    return scoreRampTriggerChain(flags.rampCard, flags.triggerCard);
  if (flags.shape === 'cost-cost') return costReductionTargetsOverlap(cardA, cardB) ? 6 : 0;
  return 5;
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
    return `${rampToken} adds ink to your inkwell, triggering ${triggerToken}'s inkwell effect.`;
  },
  'ramp-ramp': (_a, _b) => `Both accelerate your ink. Gets you ahead faster.`,
  'ramp-cost': (a, _b, f) => {
    const rampIsA = f.rampCard.id === a.id;
    const rampToken = rampIsA ? '{A}' : '{B}';
    const costToken = rampIsA ? '{B}' : '{A}';
    return `${rampToken} adds extra ink, ${costToken} discounts your plays.`;
  },
  'trigger-trigger': (_a, _b) => `Both effects activate on inkwell events.`,
  'cost-cost': (_a, _b) => `Both reduce costs. Stacking discounts plays cards faster.`,
  'trigger-cost': (_a, _b) => `Both support an accelerated game plan.`,
};

/** Generate a human-readable explanation for a ramp synergy pair. */
function getRampExplanation(
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
function scoreToyPair(
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
function scoreDwarfsPair(
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

// ============================================
// FLOODBORNS SCORING (payoff-anchored, 5-baseline)
// ============================================

const isFloodbornPayoff = (roles: FloodbornRole[]): boolean =>
  roles.includes('buff') || roles.includes('trigger');

/**
 * Score a Floodborns pair. Called only when at least one side is a payoff
 * (the rule's findSynergies skips member-member pairs).
 *   - payoff <-> payoff           = 7 (two payoffs stack on the same Floodborn board)
 *   - member <-> trigger payoff   = 7 (the body fires the repeating trigger)
 *   - member <-> buff payoff      = 6 (the body is pumped by the team buff)
 */
function scoreFloodbornPair(
  cardRoles: FloodbornRole[],
  otherRoles: FloodbornRole[],
): {score: number; explanation: string} {
  const cardPayoff = isFloodbornPayoff(cardRoles);
  const otherPayoff = isFloodbornPayoff(otherRoles);

  if (cardPayoff && otherPayoff) {
    return {score: 7, explanation: 'Both reward a wide Floodborn board, so the payoffs stack.'};
  }
  // Exactly one side is a payoff; the other is a member only.
  const payoffRoles = cardPayoff ? cardRoles : otherRoles;
  if (payoffRoles.includes('trigger')) {
    return {score: 7, explanation: 'The Floodborn body fires the repeating payoff trigger.'};
  }
  return {score: 6, explanation: 'The Floodborn body is pumped by the team buff.'};
}

// ============================================
// SHARED TRIBAL SCORING HELPERS
// ============================================

/** Direction-agnostic role-cross matcher: true iff one side has `x` and the other has `y`. */
function crossMatcher<T extends string>(aRoles: T[], bRoles: T[]): (x: T, y: T) => boolean {
  const a = new Set(aRoles);
  const b = new Set(bRoles);
  return (x, y) => (a.has(x) && b.has(y)) || (b.has(x) && a.has(y));
}

/**
 * Shared tribal `findSynergies` loop: pair the card against every other role-bearing
 * card, scoring each via `scorePair`. A `null` result skips the pair (the payoff-anchored
 * Floodborns rule uses this to drop member-member pairs).
 */
function tribalFindSynergies<R>(
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

// ============================================
// HUNNY TRIBAL SCORING (5-baseline)
// ============================================

/**
 *   - search <-> member | search <-> density = 8 (fetch converts a slot / fuels the payoff)
 *   - density <-> density | density <-> member = 7 (compounding / member feeds payoff)
 *   - buff <-> member                          = 6 (single-target pump on a Hunny body)
 *   - everything else                          = 5 (same-deck density baseline)
 */
function scoreHunnyPair(
  cardRoles: HunnyRole[],
  otherRoles: HunnyRole[],
): {score: number; explanation: string} {
  const cross = crossMatcher(cardRoles, otherRoles);
  if (cross('search', 'member') || cross('search', 'density')) {
    return {score: 8, explanation: 'A Hunny search digs the tribe out of your deck, fueling the payoffs.'};
  }
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

// ============================================
// RED PANDA TRIBAL SCORING (5-baseline)
// ============================================

function scoreRedPandaPair(
  cardRoles: RedPandaRole[],
  otherRoles: RedPandaRole[],
): {score: number; explanation: string} {
  const cross = crossMatcher(cardRoles, otherRoles);
  if (cross('search', 'member')) {
    return {score: 8, explanation: 'A Red Panda search converts a deck slot into a tribe member.'};
  }
  return {score: 5, explanation: 'Both share the Red Panda deck. Density baseline.'};
}

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
