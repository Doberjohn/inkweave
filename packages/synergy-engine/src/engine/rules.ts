import type {LorcanaCard, PlaystyleId, SynergyMatch, SynergyRule} from '../types';
import {
  classifyNamedEffect,
  getBaseName,
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
  isLocation,
  isLocationSupportCard,
  isRampCard,
  isRepeatingTrigger,
  costReductionTargetsOverlap,
  isSong,
  isToyCard,
  getToyRoles,
  isLoreDenialCard,
  getLoreDenialRoles,
  LOCATION_PATTERNS,
  NAMED_EFFECT_SCORES,
  normalizeCardText,
  type DiscardRole,
  type LocationRole,
  type LoreDenialRole,
  type RampRole,
  type ShiftType,
  type ToyRole,
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
      reason: `${base.reason} ${baseCard.fullName} is both a Shift target and enables the free Shift condition.`,
    };
  }

  return base;
}

/** Score a free Shift (cost 0) — only the base card's cost matters since the shift itself is free. */
function freeShiftScore(
  shiftCard: LorcanaCard,
  baseCard: LorcanaCard,
): {score: number; reason: string} {
  if (baseCard.cost <= 3) {
    return {
      score: 9,
      reason: `Free Shift: Play ${baseCard.fullName} early, then shift into ${shiftCard.fullName} for 0 ink.`,
    };
  }
  if (baseCard.cost <= 5) {
    return {
      score: 7,
      reason: `Free Shift: Shift ${baseCard.fullName} into ${shiftCard.fullName} for 0 ink, but the base takes longer to set up.`,
    };
  }
  return {
    score: 5,
    reason: `Free Shift but expensive base — Hard to get ${baseCard.fullName} into play first.`,
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
      reason: `Perfect curve: Play ${baseCard.fullName} on turn ${baseCard.cost}, Shift next turn. Both cards are inkable as fallback.`,
    };
  }
  if (baseCard.inkwell || shiftCard.inkwell) {
    return {
      score: 8,
      reason: `Perfect curve: Play ${baseCard.fullName} on turn ${baseCard.cost}, Shift next turn. One card is inkable as fallback.`,
    };
  }
  return {
    score: 7,
    reason: `On curve: Play ${baseCard.fullName} on turn ${baseCard.cost}, Shift next turn. Neither card is inkable — Less flexible if drawn off-curve.`,
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
      reason: `Smooth curve: ${baseCard.fullName} flows naturally into Shift within a couple of turns.`,
    };
  }
  if (curveGap === 0) {
    return {score: 5, reason: `Same cost — No ink savings from Shifting, but skips the drying phase.`};
  }
  if (curveGap === 3) {
    return {score: 5, reason: `Wide 3-turn gap — Playable but slow to set up.`};
  }
  // Poor alignment: 4+ turn gap or negative (shift costs less than base)
  return {
    score: 3,
    reason: `The cost gap makes it hard to set up ${baseCard.fullName} in time to shift ${shiftCard.fullName} onto it.`,
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
 * - standard: same base name
 * - classification: target has the required classification
 * - universal: any character
 */
function isValidShiftTarget(
  shiftType: ShiftType,
  shiftCard: LorcanaCard,
  target: LorcanaCard,
): boolean {
  switch (shiftType.kind) {
    case 'standard':
      return getBaseName(target) === getBaseName(shiftCard);
    case 'classification':
      return hasClassification(target, shiftType.classification);
    case 'universal':
      return true;
  }
}

// ============================================
// LOCATION SYNERGY HELPERS
// ============================================

/** Score mapping for each location role when matched against a Location card */
const LOCATION_ROLE_SCORE: Record<LocationRole, number> = {
  'at-payoff': 7,
  'play-trigger': 7,
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
  buff: 'location buff',
  'location-ramp': 'location ramp',
  move: 'move to location',
  'in-play-check': 'location check',
  search: 'location search',
  boost: 'location boost',
};

/** Short chip labels for each location role (used in UI) */
export const LOCATION_ROLE_CHIP_LABELS: Record<LocationRole, string> = {
  'at-payoff': 'Payoff',
  'play-trigger': 'Trigger',
  buff: 'Buff',
  'location-ramp': 'Ramp',
  move: 'Move',
  'in-play-check': 'Check',
  search: 'Search',
  boost: 'Boost',
};

/** Educational descriptions explaining what each location role means, templated with card name and location name */
export const LOCATION_ROLE_DESCRIPTIONS: Record<LocationRole, (cardName: string, locationName: string) => string> = {
  'at-payoff': (name, loc) => `${name} gets bonuses when characters are at ${loc}`,
  'play-trigger': (name, loc) => `${name} activates effects whenever you play ${loc}`,
  buff: (name, loc) => `${name} strengthens ${loc} with resist, protection, or stat boosts`,
  'location-ramp': (name, loc) => `${name} reduces the cost of playing or moving characters to ${loc}`,
  move: (name, loc) => `${name} moves characters to ${loc} to create an advantage`,
  'in-play-check': (name, loc) => `${name} gains benefits when you have ${loc} in play`,
  search: (name, loc) => `${name} searches your deck or discard for ${loc}`,
  boost: (name, loc) => `${name} can power up ${loc} through the Boost keyword`,
};

/**
 * Complementary role pairs — roles that mechanically interact.
 * Each key lists roles that it directly enables or benefits from.
 * Only pairs with at least one complementary interaction get cross-synergy.
 */
const COMPLEMENTARY_ROLES: Partial<Record<LocationRole, LocationRole[]>> = {
  // Enablers: these roles help get locations into play or onto the board
  search: ['at-payoff', 'play-trigger', 'buff', 'move', 'in-play-check', 'boost'],
  'location-ramp': ['at-payoff', 'play-trigger', 'buff', 'move', 'in-play-check', 'boost'],
  // Positioning: move enables payoffs and benefits from buffs
  move: ['at-payoff', 'buff'],
  // Consumers: these need locations/positioning that enablers provide
  'at-payoff': ['move', 'search', 'location-ramp', 'buff'],
  'play-trigger': ['search', 'location-ramp'],
  buff: ['move', 'search', 'location-ramp', 'at-payoff', 'in-play-check'],
  'in-play-check': ['search', 'location-ramp'],
  boost: ['search', 'location-ramp'],
};

/** Roles that represent high-value location strategy pieces */
const HIGH_VALUE_ROLES: Set<LocationRole> = new Set([
  'at-payoff',
  'play-trigger',
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
  card: LorcanaCard,
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
    explanation: `${card.name} (${ROLE_LABELS[role]}) and ${other.name} (${otherLabel}) — Complementary location strategy`,
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

/** Specs for all 8 location rules (order matters for deduplication). */
const LOCATION_RULE_SPECS: readonly LocationRuleSpec[] = [
  {id: 'at-payoff', name: 'At Location Payoff', role: 'at-payoff', pattern: LOCATION_PATTERNS['at-payoff']},
  {id: 'play-trigger', name: 'Location Play Trigger', role: 'play-trigger', pattern: LOCATION_PATTERNS['play-trigger']},
  {id: 'buff', name: 'Location Buff', role: 'buff', pattern: LOCATION_PATTERNS.buff},
  {id: 'location-ramp', name: 'Location Ramp', role: 'location-ramp', pattern: LOCATION_PATTERNS['location-ramp']},
  {id: 'move', name: 'Move to Location', role: 'move', pattern: LOCATION_PATTERNS.move, excludePattern: LOCATION_PATTERNS['move-exclude']},
  {id: 'in-play-check', name: 'Location In-Play Check', role: 'in-play-check', pattern: LOCATION_PATTERNS['in-play-check']},
  {id: 'search', name: 'Location Search', role: 'search', pattern: LOCATION_PATTERNS.search},
  {id: 'boost', name: 'Location Boost', role: 'boost', pattern: LOCATION_PATTERNS.boost},
];

/** Create all 8 location synergy rules (order matters for deduplication) */
function createLocationRules(): SynergyRule[] {
  return LOCATION_RULE_SPECS.map(createLocationRule);
}

// ============================================
// DISCARD ROLE UI LABELS
// ============================================

/** Short chip labels for each discard role (used in UI) */
export const DISCARD_ROLE_CHIP_LABELS: Record<DiscardRole, string> = {
  targeted: 'Targeted',
  random: 'Random',
  standard: 'Standard',
  payoff: 'Payoff',
};

/** Educational descriptions explaining what each discard role means */
export const DISCARD_ROLE_DESCRIPTIONS: Record<DiscardRole, string> = {
  targeted: 'Choose which card opponents discard',
  random: 'Force opponents to discard at random',
  standard: 'Force opponents to choose and discard',
  payoff: 'Get benefits for having more cards than your opponent',
};

/** Standalone educational descriptions for location roles (no card name needed) */
export const LOCATION_ROLE_TOOLTIP: Record<LocationRole, string> = {
  'at-payoff': 'Get benefits when characters are at a location',
  'play-trigger': 'Trigger effects when you play or move to a location',
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

function makeSingerSongMatch(singer: LorcanaCard, song: LorcanaCard, target: LorcanaCard): SynergyMatch {
  const singerValue = getKeywordValue(singer, 'Singer') ?? singer.cost;
  return {
    card: target,
    score: singerSongScore(singerValue - song.cost),
    explanation: `${singer.fullName} (Singer ${singerValue}) can sing ${song.fullName} (cost ${song.cost}) for free`,
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

function makeShiftMatch(shiftCard: LorcanaCard, baseCard: LorcanaCard, target: LorcanaCard): SynergyMatch {
  const {score, reason} = calculateShiftSynergy(shiftCard, baseCard);
  return {card: target, score, explanation: reason, bidirectional: true};
}

/** Forward: a Shift card finds valid base targets per its variant. */
function findShiftTargets(shiftCard: LorcanaCard, allCards: LorcanaCard[]): SynergyMatch[] {
  const shiftType = getShiftType(shiftCard);
  if (!shiftType) return [];
  return allCards
    .filter((other) => other.id !== shiftCard.id && isCharacter(other) && isValidShiftTarget(shiftType, shiftCard, other))
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

    // Matches all characters: Shift cards find targets (forward), base characters find Shift cards (reverse)
    matches: (card) => isCharacter(card),

    findSynergies: (card, allCards) => {
      if (getShiftType(card)) return findShiftTargets(card, allCards);
      return findShiftSourcesForBase(card, allCards);
    },
  },

  // --------------------------------------------
  // NAMED COMPANIONS
  // --------------------------------------------
  {
    id: 'named-companions',
    name: 'Named Companions',
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
            explanation: `${card.fullName} benefits from having ${refName} — ${effectTier} synergy when companion is in play`,
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
];

// ============================================
// RAMP ROLE LABELS & DESCRIPTIONS
// ============================================

/** Short chip labels for each ramp role (used in UI) */
export const RAMP_ROLE_CHIP_LABELS: Record<RampRole, string> = {
  'inkwell-ramp': 'Ramp',
  'inkwell-trigger': 'Trigger',
  'cost-reduction': 'Discount',
};

/** Educational descriptions explaining what each ramp role means */
export const RAMP_ROLE_DESCRIPTIONS: Record<RampRole, string> = {
  'inkwell-ramp': 'Put extra cards into your inkwell',
  'inkwell-trigger': 'Trigger an effect when a card is put into your inkwell',
  'cost-reduction': 'Reduce the cost of other cards you play',
};

/** Short chip labels for each lore-denial role (used in UI) */
export const LORE_DENIAL_ROLE_CHIP_LABELS: Record<LoreDenialRole, string> = {
  burn: 'Burn',
  steal: 'Steal',
};

/** Educational descriptions explaining what each lore-denial role means */
export const LORE_DENIAL_ROLE_DESCRIPTIONS: Record<LoreDenialRole, string> = {
  burn: 'Make your opponents lose lore',
  steal: 'Steal lore from your opponents to gain your own',
};

/**
 * Short chip labels for each Toy role.
 * Cross-playstyle mechanics get explicit Toy-context labels (Strategy B):
 * source playstyles keep their short labels (e.g., "Burn" on Lore Denial page),
 * but Toys disambiguates with the noun (e.g., "Lore Burn" on Toys page) since the
 * playstyle name no longer provides context. Descriptions stay shared.
 * 'Ramp' and 'Discount' are universal enough to read clearly in any playstyle.
 */
export const TOY_ROLE_CHIP_LABELS: Record<ToyRole, string> = {
  member: 'Member',
  search: 'Search',
  draw: 'Card Draw',
  'banish-trigger': 'Banish Trigger',
  'self-discount': 'Self Discount',
  burn: 'Lore Burn',
  steal: 'Lore Steal',
  targeted: 'Targeted Discard',
  random: 'Random Discard',
  standard: 'Forced Discard',
  'inkwell-ramp': 'Ramp',
  'inkwell-trigger': 'Ink Trigger',
  'cost-reduction': 'Cost Reduction',
};

/** Educational descriptions for each Toy role — composed from source playstyles where applicable */
export const TOY_ROLE_DESCRIPTIONS: Record<ToyRole, string> = {
  member: 'Toy character — counts toward tribal density',
  search: 'Search your deck for Toy characters',
  draw: 'Draw extra cards',
  'banish-trigger': 'Trigger an effect when a Toy character is banished',
  'self-discount': 'Pay less to play a character under some condition',
  burn: LORE_DENIAL_ROLE_DESCRIPTIONS.burn,
  steal: LORE_DENIAL_ROLE_DESCRIPTIONS.steal,
  targeted: DISCARD_ROLE_DESCRIPTIONS.targeted,
  random: DISCARD_ROLE_DESCRIPTIONS.random,
  standard: DISCARD_ROLE_DESCRIPTIONS.standard,
  'inkwell-ramp': RAMP_ROLE_DESCRIPTIONS['inkwell-ramp'],
  'inkwell-trigger': RAMP_ROLE_DESCRIPTIONS['inkwell-trigger'],
  'cost-reduction': RAMP_ROLE_DESCRIPTIONS['cost-reduction'],
};

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
  card: LorcanaCard,
  cardRoles: DiscardRole[],
  other: LorcanaCard,
  otherRoles: DiscardRole[],
): SynergyMatch {
  const cardDisruption = hasDiscardDisruption(cardRoles);
  const otherDisruption = hasDiscardDisruption(otherRoles);
  const cardPayoff = cardRoles.includes('payoff');
  const otherPayoff = otherRoles.includes('payoff');

  if (isDiscardKillCombo(cardDisruption, cardPayoff, otherDisruption, otherPayoff)) {
    const disruption = cardDisruption ? card : other;
    const payoff = cardPayoff ? card : other;
    return {
      card: other,
      score: 8,
      explanation: `${disruption.fullName} depletes the opponent's hand, powering up ${payoff.fullName}'s hand-size advantage`,
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
      ? `Both ${card.fullName} and ${other.fullName} reward hand-size advantage over opponents`
      : `Both ${card.fullName} and ${other.fullName} disrupt the opponent's hand`,
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
  cardA: LorcanaCard,
  cardB: LorcanaCard,
): {score: number; explanation: string} {
  if (roleA === 'steal' && roleB === 'steal') {
    return {
      score: 7,
      explanation: `Both ${cardA.fullName} and ${cardB.fullName} steal lore — every trigger swings the race in your favor twice`,
    };
  }
  if (roleA === 'burn' && roleB === 'burn') {
    return {
      score: 5,
      explanation: `Both ${cardA.fullName} and ${cardB.fullName} make the opponent lose lore — stacking denial pressure`,
    };
  }
  // Mixed pair — pick the burn-side and steal-side cards regardless of order
  const burn = roleA === 'burn' ? cardA : cardB;
  const steal = roleA === 'steal' ? cardA : cardB;
  return {
    score: 6,
    explanation: `${burn.fullName} pushes the opponent down while ${steal.fullName} pulls you up — pressing both ends of the lore race`,
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
function hasMixedRoles(a: RampRoleFlags, b: RampRoleFlags, x: keyof RampRoleFlags, y: keyof RampRoleFlags): boolean {
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
  if (flags.shape === 'ramp-trigger') return scoreRampTriggerChain(flags.rampCard, flags.triggerCard);
  if (flags.shape === 'cost-cost') return costReductionTargetsOverlap(cardA, cardB) ? 6 : 0;
  return 5;
}

/** Explanation templates keyed by ramp pair shape. */
const RAMP_EXPLANATIONS: Record<
  RampPairShape,
  (cardA: LorcanaCard, cardB: LorcanaCard, flags: RampPairFlags) => string
> = {
  'ramp-trigger': (_a, _b, f) =>
    `${f.rampCard.fullName} adds ink to your inkwell, triggering ${f.triggerCard.fullName}'s inkwell effect`,
  'ramp-ramp': (a, b) =>
    `Both ${a.fullName} and ${b.fullName} accelerate your ink, getting you ahead faster`,
  'ramp-cost': (_a, _b, f) =>
    `${f.rampCard.fullName} adds extra ink while ${f.costCard.fullName} discounts your plays`,
  'trigger-trigger': (a, b) =>
    `Both ${a.fullName} and ${b.fullName} effects activate on inkwell events`,
  'cost-cost': (a, b) =>
    `Both ${a.fullName} and ${b.fullName} reduce costs — stacking discounts lets you play cards faster`,
  'trigger-cost': (a, b) =>
    `${a.fullName} and ${b.fullName} both support an accelerated game plan`,
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
  const searcher = ctx.aHasSearch ? ctx.card : ctx.other;
  const trigger = ctx.aHasBanish ? ctx.card : ctx.other;
  return {
    score: 8,
    explanation: `${searcher.fullName} loads a Toy onto the board, then ${trigger.fullName} pays off when it's banished — peak tribal chain`,
  };
}

/** 8 — Member ↔ search (search converts a deck slot to a tribal member). */
function tryToyMemberSearch(ctx: ToyPairCtx): ToyPairResult | null {
  const matched = (ctx.aMember && ctx.bHasSearch) || (ctx.aHasSearch && ctx.bMember);
  if (!matched) return null;
  const searcher = ctx.aHasSearch ? ctx.card : ctx.other;
  const memberCard = ctx.aHasSearch ? ctx.other : ctx.card;
  return {
    score: 8,
    explanation: `${searcher.fullName} can fetch ${memberCard.fullName} from the deck — direct tribal access`,
  };
}

/** 7 — Tribal ↔ Tribal (multiple density rewards compound). */
function tryToyTribalCompound(ctx: ToyPairCtx): ToyPairResult | null {
  if (!(ctx.aTribal && ctx.bTribal)) return null;
  return {
    score: 7,
    explanation: `${ctx.card.fullName} and ${ctx.other.fullName} both reward Toy density — tribal payoffs compound`,
  };
}

/** 7 — Member ↔ Tribal (member feeds the tribal payoff). */
function tryToyMemberTribal(ctx: ToyPairCtx): ToyPairResult | null {
  const matched = (ctx.aMember && ctx.bTribal) || (ctx.aTribal && ctx.bMember);
  if (!matched) return null;
  const tribalCard = ctx.aTribal ? ctx.card : ctx.other;
  const memberCard = ctx.aTribal ? ctx.other : ctx.card;
  return {
    score: 7,
    explanation: `${memberCard.fullName} contributes to the Toy density that ${tribalCard.fullName} rewards`,
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
      explanation: `${card.fullName} and ${other.fullName} share the Toys deck — density baseline`,
    }
  );
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
