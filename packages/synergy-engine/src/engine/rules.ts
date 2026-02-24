import type {LorcanaCard} from '../types/card.js';
import type {SynergyRule, SynergyMatch, SynergyStrength} from '../types/synergy.js';
import {
  hasKeyword,
  getBaseName,
  getKeywordValue,
  isCharacter,
  textContains,
  isLocation,
  isLocationSupportCard,
  getLocationRoles,
  LOCATION_PATTERNS,
} from '../utils/cardHelpers.js';
import type {LocationRole} from '../utils/cardHelpers.js';

/**
 * Calculate Shift synergy strength based on curve alignment and base flexibility.
 *
 * Uses the Shift keyword cost (not the card's hard-cast cost) to determine how
 * naturally the base curves into the shift play. Inkable bases get a bump because
 * they provide fallback utility when drawn late.
 */
function calculateShiftStrength(shiftCard: LorcanaCard, baseCard: LorcanaCard): SynergyStrength {
  const shiftCost = getKeywordValue(shiftCard, 'Shift') ?? shiftCard.cost;
  const curveGap = shiftCost - baseCard.cost;

  if (curveGap >= 1 && curveGap <= 2) {
    return baseCard.inkwell ? 'strong' : 'moderate';
  }
  if (curveGap === 0 || curveGap === 3) {
    return 'moderate';
  }
  return 'weak';
}

/** Cards that directly make the opponent lose lore */
const LORE_LOSS_PATTERN = /(?:each |chosen |all )?opponents? loses? (?:\d+ )?lore/i;

// ============================================
// LOCATION SYNERGY HELPERS
// ============================================

/** Strength mapping for each location role when matched against a Location card */
const LOCATION_ROLE_STRENGTH: Record<LocationRole, SynergyStrength> = {
  'at-payoff': 'strong',
  'play-trigger': 'strong',
  buff: 'strong',
  move: 'moderate',
  'in-play-check': 'moderate',
  tutor: 'moderate',
};

/** Human-readable labels for each location role */
const ROLE_LABELS: Record<LocationRole, string> = {
  'at-payoff': 'at location payoff',
  'play-trigger': 'play trigger',
  buff: 'location buff',
  move: 'move to location',
  'in-play-check': 'location check',
  tutor: 'location tutor',
};

/** Roles that represent high-value location strategy pieces */
const HIGH_VALUE_ROLES: Set<LocationRole> = new Set(['at-payoff', 'play-trigger', 'buff']);

/**
 * Determine cross-synergy strength between two location-support cards.
 * All location-support cards share a strategy (wanting locations in play),
 * so any pair gets at least weak. Complementary roles get stronger ratings.
 */
export function getCrossSynergyStrength(
  rolesA: LocationRole[],
  rolesB: LocationRole[],
): SynergyStrength | null {
  // No cross-synergy if either has no roles
  if (rolesA.length === 0 || rolesB.length === 0) return null;

  const aHighValue = rolesA.some((r) => HIGH_VALUE_ROLES.has(r));
  const bHighValue = rolesB.some((r) => HIGH_VALUE_ROLES.has(r));

  // Check if they have complementary (different) roles
  const setA = new Set(rolesA);
  const setB = new Set(rolesB);
  const hasUniqueRole = rolesA.some((r) => !setB.has(r)) || rolesB.some((r) => !setA.has(r));

  if (hasUniqueRole && aHighValue && bHighValue) return 'moderate';
  return 'weak';
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
        strength: LOCATION_ROLE_STRENGTH[role],
        explanation: `${card.name} has ${ROLE_LABELS[role]} — works with locations`,
        bidirectional: true,
      });
    } else if (isLocationSupportCard(other)) {
      // Cross-synergy with other location-support cards
      const otherRoles = getLocationRoles(other);
      const strength = getCrossSynergyStrength(cardRoles, otherRoles);
      if (strength) {
        const otherLabel = otherRoles.map((r) => ROLE_LABELS[r]).join(' + ');
        matches.push({
          card: other,
          strength,
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

    // Use the strongest role for the strength rating
    const strength = roles.reduce<SynergyStrength>((best, r) => {
      const s = LOCATION_ROLE_STRENGTH[r];
      if (s === 'strong') return 'strong';
      if (s === 'moderate' && best !== 'strong') return 'moderate';
      return best;
    }, 'weak');

    const roleDesc = roles.map((r) => ROLE_LABELS[r]).join(' and ');
    matches.push({
      card: other,
      strength,
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
    type: 'location',
    description: `Location synergy: ${name}`,

    matches: (card) => {
      if (isLocation(card)) return true;
      if (!card.text) return false;
      const normalizedText = card.text.replace(/\n/g, ' ');
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

/** Create all 6 location synergy rules (order matters for deduplication) */
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
    type: 'shift',
    description: 'Characters with Shift and their same-named targets (bidirectional)',

    // Matches all characters: Shift cards find targets (forward), base characters find Shift cards (reverse)
    matches: (card) => isCharacter(card),

    findSynergies: (card, allCards) => {
      const baseName = getBaseName(card);
      const cardHasShift = hasKeyword(card, 'Shift');

      if (cardHasShift) {
        // Forward: Shift card finds non-Shift same-name characters to land on
        return allCards
          .filter((other) => {
            if (other.id === card.id) return false;
            return (
              getBaseName(other) === baseName && isCharacter(other) && !hasKeyword(other, 'Shift')
            );
          })
          .map(
            (target): SynergyMatch => ({
              card: target,
              strength: calculateShiftStrength(card, target),
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
            strength: calculateShiftStrength(shiftCard, card),
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
    type: 'mechanic',
    description: 'Cards that make the opponent lose lore reinforce the same denial strategy',

    matches: (card) => textContains(card, LORE_LOSS_PATTERN),

    findSynergies: (card, allCards) => {
      return allCards
        .filter((other) => other.id !== card.id && textContains(other, LORE_LOSS_PATTERN))
        .map(
          (other): SynergyMatch => ({
            card: other,
            strength: 'strong',
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

// Get rules by type
export const getRulesByType = (type: SynergyRule['type']): SynergyRule[] => {
  return synergyRules.filter((rule) => rule.type === type);
};

// Get a specific rule by ID
export const getRuleById = (id: string): SynergyRule | undefined => {
  return synergyRules.find((rule) => rule.id === id);
};
