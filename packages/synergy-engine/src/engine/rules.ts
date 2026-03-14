import type {LorcanaCard, PlaystyleId, SynergyMatch, SynergyRule} from '../types';
import {
  classifyNamedEffect,
  getBaseName,
  getLocationRoles,
  getNamedReferences,
  getShiftType,
  hasClassification,
  isCharacter,
  isLocation,
  isLocationSupportCard,
  LOCATION_PATTERNS,
  NAMED_EFFECT_SCORES,
  textContains,
  type LocationRole,
  type ShiftType,
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

function calculateShiftBaseScore(
  shiftCard: LorcanaCard,
  baseCard: LorcanaCard,
  shiftCost: number,
): {score: number; reason: string} {
  // Free Shift — scoring based on base cost
  if (shiftCost === 0) {
    if (baseCard.cost <= 3)
      return {
        score: 9,
        reason: `Free Shift: Play ${baseCard.fullName} early, then shift into ${shiftCard.fullName} for 0 ink.`,
      };
    if (baseCard.cost <= 5)
      return {
        score: 7,
        reason: `Free Shift: Shift ${baseCard.fullName} into ${shiftCard.fullName} for 0 ink, but the base takes longer to set up.`,
      };
    return {
      score: 5,
      reason: `Free Shift but expensive base — Hard to get ${baseCard.fullName} into play first.`,
    };
  }

  const curveGap = shiftCost - baseCard.cost;

  // Best case: gap=1 with both inkable — perfect curve AND full flexibility
  if (curveGap === 1 && baseCard.inkwell && shiftCard.inkwell)
    return {
      score: 9,
      reason: `Perfect curve: Play ${baseCard.fullName} on turn ${baseCard.cost}, Shift next turn. Both cards are inkable as fallback.`,
    };

  // Great curve: gap=1, one card inkable — still perfect tempo, slightly less flexible
  if (curveGap === 1 && (baseCard.inkwell || shiftCard.inkwell))
    return {
      score: 8,
      reason: `Perfect curve: Play ${baseCard.fullName} on turn ${baseCard.cost}, Shift next turn. One card is inkable as fallback.`,
    };

  // On curve but neither inkable — perfect tempo, no fallback flexibility
  if (curveGap === 1)
    return {
      score: 7,
      reason: `On curve: Play ${baseCard.fullName} on turn ${baseCard.cost}, Shift next turn. Neither card is inkable — Less flexible if drawn off-curve.`,
    };

  // 2-turn gap — still smooth but slightly slower
  if (curveGap === 2)
    return {
      score: 7,
      reason: `Smooth curve: ${baseCard.fullName} flows naturally into Shift within a couple of turns.`,
    };

  // Same cost (no ink savings) or wide 3-turn gap
  if (curveGap === 0)
    return {
      score: 5,
      reason: `Same cost — No ink savings from Shifting, but skips the drying phase.`,
    };
  if (curveGap === 3)
    return {
      score: 5,
      reason: `Wide 3-turn gap — Playable but slow to set up.`,
    };

  // Poor alignment: 4+ turn gap or negative (shift costs less than base)
  return {
    score: 3,
    reason: `The cost gap makes it hard to set up ${baseCard.fullName} in time to shift ${shiftCard.fullName} onto it.`,
  };
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

/** Educational descriptions explaining what each location role means, templated with card name */
export const LOCATION_ROLE_DESCRIPTIONS: Record<LocationRole, (cardName: string) => string> = {
  'at-payoff': (name) => `${name} gets bonuses when characters are at a location`,
  'play-trigger': (name) => `${name} activates effects whenever you play a location`,
  buff: (name) => `${name} strengthens locations with resist, protection, or stat boosts`,
  'location-ramp': (name) => `${name} reduces the cost of playing or moving to locations`,
  move: (name) => `${name} moves characters to locations for positioning advantage`,
  'in-play-check': (name) => `${name} gains benefits when you have locations in play`,
  tutor: (name) => `${name} searches your deck or discard for location cards`,
  boost: (name) => `${name} works with the Boost keyword to power up locations`,
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
        explanation: `${card.name} has ${ROLE_LABELS[role]} — Works with locations`,
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
          explanation: `${card.name} (${ROLE_LABELS[role]}) and ${other.name} (${otherLabel}) — Complementary location strategy`,
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
    description: 'Characters with Shift and their valid targets',

    // Matches all characters: Shift cards find targets (forward), base characters find Shift cards (reverse)
    matches: (card) => isCharacter(card),

    findSynergies: (card, allCards) => {
      const shiftType = getShiftType(card);

      if (shiftType) {
        // Forward: Shift card finds valid targets based on variant
        return allCards
          .filter((other) => {
            if (other.id === card.id) return false;
            if (!isCharacter(other)) return false;
            return isValidShiftTarget(shiftType, card, other);
          })
          .map((target): SynergyMatch => {
            const {score, reason} = calculateShiftSynergy(card, target);
            return {
              card: target,
              score,
              explanation: reason,
              bidirectional: true,
            };
          });
      }

      // Reverse: non-Shift character finds Shift cards that can target it
      return allCards
        .filter((other) => {
          if (other.id === card.id) return false;
          if (!isCharacter(other)) return false;
          const otherShift = getShiftType(other);
          if (!otherShift) return false;
          return isValidShiftTarget(otherShift, other, card);
        })
        .map((shiftCard): SynergyMatch => {
          const {score, reason} = calculateShiftSynergy(shiftCard, card);
          return {
            card: shiftCard,
            score,
            explanation: reason,
            bidirectional: true,
          };
        });
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

    matches: (card) => textContains(card, LORE_LOSS_PATTERN),

    findSynergies: (card, allCards) => {
      return allCards
        .filter((other) => other.id !== card.id && textContains(other, LORE_LOSS_PATTERN))
        .map(
          (other): SynergyMatch => ({
            card: other,
            score: 7,
            explanation: `Both ${card.fullName} and ${other.fullName} make the opponent lose lore`,
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
