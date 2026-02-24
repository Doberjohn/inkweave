import type {LorcanaCard} from '../types/card.js';
import type {SynergyRule, SynergyMatch, SynergyStrength} from '../types/synergy.js';
import {hasKeyword, getBaseName, getKeywordValue, isCharacter, textContains} from '../utils/cardHelpers.js';

/**
 * Calculate Shift synergy strength based on curve alignment and base flexibility.
 *
 * Uses the Shift keyword cost (not the card's hard-cast cost) to determine how
 * naturally the base curves into the shift play. Inkable bases get a bump because
 * they provide fallback utility when drawn late.
 */
function calculateShiftStrength(
  shiftCard: LorcanaCard,
  baseCard: LorcanaCard,
): SynergyStrength {
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
            return getBaseName(other) === baseName && isCharacter(other) && !hasKeyword(other, 'Shift');
          })
          .map((target): SynergyMatch => ({
            card: target,
            strength: calculateShiftStrength(card, target),
            explanation: `${card.name} can Shift onto ${target.fullName} (cost ${target.cost})`,
            bidirectional: true,
          }));
      }

      // Reverse: non-Shift character finds Shift cards with the same base name
      return allCards
        .filter((other) => {
          if (other.id === card.id) return false;
          return getBaseName(other) === baseName && isCharacter(other) && hasKeyword(other, 'Shift');
        })
        .map((shiftCard): SynergyMatch => ({
          card: shiftCard,
          strength: calculateShiftStrength(shiftCard, card),
          explanation: `${shiftCard.fullName} (Shift, cost ${shiftCard.cost}) can Shift onto this card`,
          bidirectional: true,
        }));
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
        .map((other): SynergyMatch => ({
          card: other,
          strength: 'strong',
          explanation: `Both ${card.name} and ${other.name} make the opponent lose lore`,
          bidirectional: true,
        }));
    },
  },
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
