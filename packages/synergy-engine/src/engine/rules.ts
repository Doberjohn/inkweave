import type {LorcanaCard, PlaystyleId, SynergyMatch, SynergyRule} from '../types';
import type {LocationRole} from '../utils';
import {
  getBaseName,
  getKeywordValue,
  getLocationRoles,
  hasKeyword,
  isCharacter,
  isLocation,
  isLocationSupportCard,
  LOCATION_PATTERNS,
  textContains,
} from '../utils';

/**
 * Calculate Shift synergy score based on curve alignment and base flexibility.
 *
 * Uses the Shift keyword cost (not the card's hard-cast cost) to determine how
 * naturally the base curves into the shift play. Inkable bases get a bump because
 * they provide fallback utility when drawn late.
 *
 * See SCORING_DESIGN.md "Rule 1: Shift Targets" for the full score table.
 */
function calculateShiftScore(shiftCard: LorcanaCard, baseCard: LorcanaCard): number {
  const shiftCost = getKeywordValue(shiftCard, 'Shift') ?? shiftCard.cost;
  const curveGap = shiftCost - baseCard.cost;

  // Best case: gap=1 with inkable base — perfect curve AND fallback utility
  if (curveGap === 1 && baseCard.inkwell) return 9;

  // Good curve (gap 1-2) but base lacks inkwell flexibility
  if (curveGap >= 1 && curveGap <= 2) return 7;

  // Same cost (no ink savings) or wide 3-turn gap
  if (curveGap === 0 || curveGap === 3) return 5;

  // Poor alignment: 4+ turn gap or negative (shift costs less than base)
  return 3;
}

/** Cards that directly make the opponent lose lore */
const LORE_LOSS_PATTERN = /(?:each |chosen |all )?opponents? loses? (?:\d+ )?lore/i;

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
  tutor: 5,
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
  tutor: 'location tutor',
  boost: 'location boost',
};

/** Roles that represent high-value location strategy pieces */
const HIGH_VALUE_ROLES: Set<LocationRole> = new Set([
  'at-payoff',
  'play-trigger',
  'buff',
  'location-ramp',
]);

/**
 * Determine cross-synergy score between two location-support cards.
 * All location-support cards share a strategy (wanting locations in play),
 * so any pair gets at least 3. Complementary high-value roles get 5.
 */
export function getCrossSynergyScore(
  rolesA: LocationRole[],
  rolesB: LocationRole[],
): number | null {
  // No cross-synergy if either has no roles
  if (rolesA.length === 0 || rolesB.length === 0) return null;

  const aHighValue = rolesA.some((r) => HIGH_VALUE_ROLES.has(r));
  const bHighValue = rolesB.some((r) => HIGH_VALUE_ROLES.has(r));

  // Check if they have complementary (different) roles
  const setA = new Set(rolesA);
  const setB = new Set(rolesB);
  const hasUniqueRole = rolesA.some((r) => !setB.has(r)) || rolesB.some((r) => !setA.has(r));

  if (hasUniqueRole && aHighValue && bHighValue) return 5;
  return 3;
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

    if (isLocation(other)) {
      // Location-support card ↔ Location = direct synergy
      matches.push({
        card: other,
        score: LOCATION_ROLE_SCORE[role],
        explanation: `${card.name} has ${ROLE_LABELS[role]} — works with locations`,
        bidirectional: true,
      });
    } else if (isLocationSupportCard(other)) {
      // Cross-synergy with other location-support cards
      const otherRoles = getLocationRoles(other);
      const score = getCrossSynergyScore(cardRoles, otherRoles);
      if (score !== null) {
        const otherLabel = otherRoles.map((r) => ROLE_LABELS[r]).join(' + ');
        matches.push({
          card: other,
          score,
          explanation: `Both support location-based gameplay (${ROLE_LABELS[role]} + ${otherLabel})`,
          bidirectional: true,
        });
      }
    }
  }

  return matches;
}

/** Build synergies for a Location card: find all location-support cards */
function findLocationCardSynergies(card: LorcanaCard, allCards: LorcanaCard[]): SynergyMatch[] {
  const matches: SynergyMatch[] = [];

  for (const other of allCards) {
    if (other.id === card.id) continue;
    if (isLocation(other)) continue; // Locations don't synergize with each other

    const roles = getLocationRoles(other);
    if (roles.length === 0) continue;

    // Use the highest-scoring role
    const score = Math.max(...roles.map((r) => LOCATION_ROLE_SCORE[r]));

    const roleDesc = roles.map((r) => ROLE_LABELS[r]).join(' and ');
    matches.push({
      card: other,
      score,
      explanation: `${other.name} has ${roleDesc}`,
      bidirectional: true,
    });
  }

  return matches;
}

/** Create a single location rule for a specific pattern */
function createLocationRule(
  id: string,
  name: string,
  role: LocationRole,
  pattern: RegExp,
  excludePattern?: RegExp,
): SynergyRule {
  return {
    id: `location-${id}`,
    name,
    category: 'playstyle',
    playstyleId: 'location-control',
    description: `Location synergy: ${name}`,

    matches: (card) => {
      if (isLocation(card)) return true;
      if (!card.text) return false;
      const normalizedText = card.text.replace(/\n/g, ' ');
      // Exclude anti-location cards (banish/remove locations)
      if (LOCATION_PATTERNS['anti-location'].test(normalizedText)) return false;
      if (excludePattern && excludePattern.test(normalizedText)) return false;
      return pattern.test(normalizedText);
    },

    findSynergies: (card, allCards) => {
      if (isLocation(card)) {
        return findLocationCardSynergies(card, allCards);
      }
      return findLocationSupportSynergies(card, allCards, role);
    },
  };
}

/** Create all 8 location synergy rules (order matters for deduplication) */
function createLocationRules(): SynergyRule[] {
  return [
    createLocationRule(
      'at-payoff',
      'At Location Payoff',
      'at-payoff',
      LOCATION_PATTERNS['at-payoff'],
    ),
    createLocationRule(
      'play-trigger',
      'Location Play Trigger',
      'play-trigger',
      LOCATION_PATTERNS['play-trigger'],
    ),
    createLocationRule('buff', 'Location Buff', 'buff', LOCATION_PATTERNS.buff),
    createLocationRule(
      'location-ramp',
      'Location Ramp',
      'location-ramp',
      LOCATION_PATTERNS['location-ramp'],
    ),
    createLocationRule(
      'move',
      'Move to Location',
      'move',
      LOCATION_PATTERNS.move,
      LOCATION_PATTERNS['move-exclude'],
    ),
    createLocationRule(
      'in-play-check',
      'Location In-Play Check',
      'in-play-check',
      LOCATION_PATTERNS['in-play-check'],
    ),
    createLocationRule('tutor', 'Location Tutor', 'tutor', LOCATION_PATTERNS.tutor),
    createLocationRule('boost', 'Location Boost', 'boost', LOCATION_PATTERNS.boost),
  ];
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
    description: 'Characters with Shift and their same-named targets',

    // Matches all characters: Shift cards find targets (forward), base characters find Shift cards (reverse)
    matches: (card) => isCharacter(card),

    findSynergies: (card, allCards) => {
      const baseName = getBaseName(card);
      const cardHasShift = hasKeyword(card, 'Shift');

      if (cardHasShift) {
        // Forward: Shift card finds same-name characters to shift onto
        return allCards
          .filter((other) => {
            if (other.id === card.id) return false;
            return getBaseName(other) === baseName && isCharacter(other);
          })
          .map(
            (target): SynergyMatch => ({
              card: target,
              score: calculateShiftScore(card, target),
              explanation: `${card.name} can Shift onto ${target.fullName} (cost ${target.cost})`,
              bidirectional: true,
            }),
          );
      }

      // Reverse: non-Shift character finds Shift cards with the same base name
      return allCards
        .filter((other) => {
          if (other.id === card.id) return false;
          return (
            getBaseName(other) === baseName && isCharacter(other) && hasKeyword(other, 'Shift')
          );
        })
        .map(
          (shiftCard): SynergyMatch => ({
            card: shiftCard,
            score: calculateShiftScore(shiftCard, card),
            explanation: `${shiftCard.fullName} (Shift, cost ${shiftCard.cost}) can Shift onto this card`,
            bidirectional: true,
          }),
        );
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

    matches: (card) => textContains(card, LORE_LOSS_PATTERN),

    findSynergies: (card, allCards) => {
      return allCards
        .filter((other) => other.id !== card.id && textContains(other, LORE_LOSS_PATTERN))
        .map(
          (other): SynergyMatch => ({
            card: other,
            score: 7,
            explanation: `Both ${card.name} and ${other.name} make the opponent lose lore`,
            bidirectional: true,
          }),
        );
    },
  },

  // --------------------------------------------
  // LOCATION SYNERGIES
  // --------------------------------------------
  ...createLocationRules(),
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
