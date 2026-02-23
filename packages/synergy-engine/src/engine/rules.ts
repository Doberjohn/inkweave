import type {SynergyRule, SynergyMatch, SynergyStrength} from '../types/synergy.js';
import {hasKeyword, getBaseName, isCharacter} from '../utils/cardHelpers.js';

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
    description: 'Floodborn characters can Shift onto same-named characters',

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
          .map((target): SynergyMatch => {
            const costDiff = card.cost - target.cost;
            const strength: SynergyStrength =
              costDiff >= 4 ? 'strong' : costDiff >= 2 ? 'moderate' : 'weak';

            return {
              card: target,
              strength,
              explanation: `${card.name} can Shift onto ${target.fullName} (cost ${target.cost})`,
              bidirectional: true,
            };
          });
      }

      // Reverse: non-Shift character finds Shift cards with the same base name
      return allCards
        .filter((other) => {
          if (other.id === card.id) return false;
          return getBaseName(other) === baseName && isCharacter(other) && hasKeyword(other, 'Shift');
        })
        .map((shiftCard): SynergyMatch => {
          const costDiff = shiftCard.cost - card.cost;
          const strength: SynergyStrength =
            costDiff >= 4 ? 'strong' : costDiff >= 2 ? 'moderate' : 'weak';

          return {
            card: shiftCard,
            strength,
            explanation: `${shiftCard.fullName} (Shift, cost ${shiftCard.cost}) can Shift onto this card`,
            bidirectional: true,
          };
        });
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
