import type {CardType} from 'inkweave-synergy-engine';

export const CARD_TYPES: readonly CardType[] = ['Character', 'Action', 'Item', 'Location'];

export const RARITIES: readonly string[] = [
  'Common',
  'Uncommon',
  'Rare',
  'Super Rare',
  'Legendary',
  'Enchanted',
];

/** Shown as a hint under the franchise field; matching one groups the card under that franchise on /reveals. */
export const FEATURED_FRANCHISE_HINT = 'Coco (exact match groups it; blank = returning)';

export {REVEAL_SET_CODE, REVEAL_ID_BASE} from '../../shared/constants';
