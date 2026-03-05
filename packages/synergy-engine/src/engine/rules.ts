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

/** Short chip labels for each location role (used in UI) */
export const LOCATION_ROLE_CHIP_LABELS: Record<LocationRole, string> = {
  'at-payoff': 'Payoff',
  'play-trigger': 'Trigger',
  buff: 'Buff',
  'location-ramp': 'Ramp',
  move: 'Move',
  'in-play-check': 'Check',
  tutor: 'Tutor',
  boost: 'Boost',
};

/** Educational descriptions explaining what each location role means */
export const LOCATION_ROLE_DESCRIPTIONS: Record<LocationRole, string> = {
  'at-payoff': 'Gets bonuses when your characters are at a location',
  'play-trigger': 'Activates effects whenever you play a location card',
  buff: 'Strengthens your locations with resist, protection, or stat boosts',
  'location-ramp': 'Reduces the cost of playing or moving to locations',
  move: 'Moves characters to locations for positioning advantage',
  'in-play-check': 'Gains benefits when you have locations in play',
  tutor: 'Searches your deck or discard for location cards',
  boost: 'Works with the Boost keyword to power up locations',
};

/**
 * Complementary role pairs — roles that mechanically interact.
 * Each key lists roles that it directly enables or benefits from.
 * Only pairs with at least one complementary interaction get cross-synergy.
 */
const COMPLEMENTARY_ROLES: Partial<Record<LocationRole, LocationRole[]>> = {
  // Enablers: these roles help get locations into play or onto the board
  tutor: ['at-payoff', 'play-trigger', 'buff', 'move', 'in-play-check', 'boost'],
  'location-ramp': ['at-payoff', 'play-trigger', 'buff', 'move', 'in-play-check', 'boost'],
  // Positioning: move enables payoffs and benefits from buffs
  move: ['at-payoff', 'buff'],
  // Consumers: these need locations/positioning that enablers provide
  'at-payoff': ['move', 'tutor', 'location-ramp', 'buff'],
  'play-trigger': ['tutor', 'location-ramp'],
  buff: ['move', 'tutor', 'location-ramp', 'at-payoff', 'in-play-check'],
  'in-play-check': ['tutor', 'location-ramp'],
  boost: ['tutor', 'location-ramp'],
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
 * Only cards with complementary roles get cross-synergy — same-role or
 * unrelated-role pairs return null (no synergy).
 * Complementary high-value pairs score 5, others score 3.
 */
export function getCrossSynergyScore(
  rolesA: LocationRole[],
  rolesB: LocationRole[],
): number | null {
  if (rolesA.length === 0 || rolesB.length === 0) return null;

  // Check if any role pair is complementary (A enables/benefits B or vice versa)
  let hasComplementary = false;
  for (const roleA of rolesA) {
    const complements = COMPLEMENTARY_ROLES[roleA];
    if (complements && rolesB.some((roleB) => complements.includes(roleB))) {
      hasComplementary = true;
      break;
    }
  }
  if (!hasComplementary) {
    // Check reverse direction
    for (const roleB of rolesB) {
      const complements = COMPLEMENTARY_ROLES[roleB];
      if (complements && rolesA.some((roleA) => complements.includes(roleA))) {
        hasComplementary = true;
        break;
      }
    }
  }

  if (!hasComplementary) return null;

  const aHighValue = rolesA.some((r) => HIGH_VALUE_ROLES.has(r));
  const bHighValue = rolesB.some((r) => HIGH_VALUE_ROLES.has(r));

  if (aHighValue && bHighValue) return 5;
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
        return findLocationCardSynergiesForRole(card, allCards, role);
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
