import {isPromoScope} from '../binderCards';
import type {BinderShelf} from './binderShelf';

/*
 * The words and the count the shelf's heading, its covers and the Binders tab's All your binders
 * row share, so they never disagree, and how Save as a binder counts a binder's cards.
 */

/** My collection's name, on its cover and its row. */
export const MY_COLLECTION = 'My collection';

/** "binders", or "binder" for one: My collection counts as one. */
export const binderWord = (count: number) => (count === 1 ? 'binder' : 'binders');

/** How many binders the shelf holds, My collection included, once they have read; else null. */
export const shelfCount = (shelf: BinderShelf): number | null =>
  shelf.status === 'ready' ? shelf.binders.length + 1 : null;

/** The most binders a shelf holds, My collection aside: the insert trigger's cap. */
export const SHELF_MAX = 30;

/** Why a shelf takes no other binder: what a save that meets the cap says. */
export const SHELF_FULL_WORDS = `Your shelf holds ${SHELF_MAX} binders, the most it can.`;

/** What stands in New binder's place once the shelf holds `SHELF_MAX`. */
export const SHELF_FULL_LINE = `${SHELF_FULL_WORDS} Delete one to make another.`;

/** How many cards a binder holds, as a sentence counts them: "625 cards", or for promos alone "1 promo". */
export function cardCount(cards: number, scope: string): string {
  const noun = isPromoScope(scope) ? 'promo' : 'card';
  return `${cards.toLocaleString('en-US')} ${noun}${cards === 1 ? '' : 's'}`;
}
