import type {SynergyMatchDisplay} from '../types';
import type {SynergySortOrder} from '../../../shared/constants';
import {ALL_INKS} from '../../../shared/constants';

/**
 * Sort synergy matches by the given order.
 * Returns a new array — does not mutate the input.
 */
export function applySynergySortOrder(
  synergies: SynergyMatchDisplay[],
  order: SynergySortOrder,
): SynergyMatchDisplay[] {
  return [...synergies].sort((a, b) => {
    switch (order) {
      case 'ink-cost': {
        const inkA = ALL_INKS.indexOf(a.card.ink);
        const inkB = ALL_INKS.indexOf(b.card.ink);
        return inkA !== inkB ? inkA - inkB : a.card.cost - b.card.cost;
      }
      case 'cost-asc':
        return a.card.cost - b.card.cost;
      case 'cost-desc':
        return b.card.cost - a.card.cost;
      case 'strength-desc':
        return b.score - a.score;
      case 'strength-asc':
        return a.score - b.score;
      case 'name-asc':
        return a.card.fullName.localeCompare(b.card.fullName);
      case 'name-desc':
        return b.card.fullName.localeCompare(a.card.fullName);
      default:
        return 0;
    }
  });
}
