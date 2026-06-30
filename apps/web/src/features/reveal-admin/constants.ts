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
export const FEATURED_FRANCHISE_HINT = 'Monsters, Inc. · Up · Turning Red (exact match groups it; blank = returning)';

export const REVEAL_SET_CODE = '13';
export const REVEAL_ID_BASE = 13000;
