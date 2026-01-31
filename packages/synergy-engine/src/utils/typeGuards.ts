import type {CardType} from '../types/card.js';

const CARD_TYPES: CardType[] = ['Character', 'Action', 'Item', 'Location'];

/**
 * Type guard to check if a value is a valid CardType
 */
export function isCardType(value: unknown): value is CardType {
  return typeof value === 'string' && CARD_TYPES.includes(value as CardType);
}
