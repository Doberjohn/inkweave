import type {PageSide} from '../../cards/components/binderGeometry';

/**
 * My collection's page size, remembered in this browser for the account it belongs to, so a
 * visit's loading binder draws the size the shelf row will answer with rather than a new binder's.
 *
 * ONLY THE SIZE. Binders, their names, rules and covers stay in memory alone. The shelf
 * (`shelfStore.ts`) writes it on each read and size change and forgets it on a Clear, so a change
 * made on another device shows from the next read; the writing stays there, in the binders' own
 * chunk, and this module, which Browse loads, only reads. Storage that can't be read leaves the
 * loading binder at a new binder's size, as it was before anything was remembered.
 */

/** Where this browser keeps `uid`'s page size: one key per account, holding 2, 3 or 4. */
export const pagesKey = (uid: string) => `inkweave:collection:pages:${uid}`;

/** My collection's page size as this browser last saw it for `uid`, or null for none. */
export function rememberedPages(uid: string): PageSide | null {
  try {
    const side = Number(localStorage.getItem(pagesKey(uid)));
    return side === 2 || side === 3 || side === 4 ? side : null;
  } catch {
    return null;
  }
}
