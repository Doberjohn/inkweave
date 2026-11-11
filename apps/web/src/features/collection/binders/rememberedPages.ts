import type {PageSide} from '../../cards/components/binderGeometry';
import {pagesKey} from '../collectionStorage';

/**
 * My collection's page size, remembered in this browser for the account it belongs to, so a
 * visit's loading binder draws the size the shelf row will answer with rather than a new binder's.
 *
 * ONLY THE SIZE. Binders, their names, rules and covers stay in memory alone. The shelf
 * (`shelfStore.ts`) writes it on each read and size change, so a change made on another device
 * shows from the next read; the writing stays there, in the binders' own chunk, and this module,
 * which Browse loads, only reads. A Clear forgets it with the collection (`collectionStorage.ts`,
 * which keeps the key). Storage that can't be read leaves the loading binder at a new binder's
 * size, as it was before anything was remembered.
 */

/** My collection's page size as this browser last saw it for `uid`, or null for none. */
export function rememberedPages(uid: string): PageSide | null {
  try {
    const side = localStorage.getItem(pagesKey(uid));
    return side === '2' ? 2 : side === '3' ? 3 : side === '4' ? 4 : null;
  } catch {
    return null;
  }
}
