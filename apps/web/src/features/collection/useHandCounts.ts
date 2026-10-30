import {trackHandCount, type HandCount, type HandCountPlace} from './binderEvents';
import type {CollectionEntries, CollectionEntry, Finish} from './collectionParser';
import {useKeptCards} from './useKeptCards';

const NO_COPIES: CollectionEntry = {normal: 0, foil: 0};

/** Where Browse is as a count is set by hand. */
interface HandCountView {
  collectionMode: boolean;
  /** Whether the binder is a friend's. */
  friend: boolean;
  /** The binder's current view, which keeps the cards counted in it (`useKeptCards`). */
  view: string;
}

/** What a count set by hand needs of the collection (`useCollection`). */
interface Counting {
  entries: CollectionEntries;
  /** Answers whether the count landed. */
  setCount: (cardId: string, finish: Finish, count: number) => boolean;
}

/** Browse's mode, for `collection_copies_changed`: the grid, your own binder, or a friend's. */
function modeOf({collectionMode, friend}: HandCountView): HandCountPlace['mode'] {
  if (!collectionMode) return 'grid';
  return friend ? 'friend_binder' : 'binder';
}

/**
 * Counts set by hand in Browse, from a pocket's stripe or the card window's (#826). The view keeps
 * each card whose count lands (`useKeptCards`), and the card's first count in the view is
 * `collection_copies_changed`, so a run of presses on one card is one event. A count the
 * collection refuses changes nothing, so it is neither kept nor counted.
 */
export function useHandCounts(where: HandCountView, {entries, setCount}: Counting) {
  const {kept, keep} = useKeptCards(where.view);
  // A string, so the handlers below keep their identity across renders that pass a new `where`.
  const mode = modeOf(where);
  const note = (edit: HandCount, surface: HandCountPlace['surface']) => {
    if (!kept.has(edit.cardId)) trackHandCount(edit, {surface, mode});
    keep(edit.cardId);
  };
  return {
    kept,
    /** A pocket's stripe asks for a count: the collection writes it, and one that lands is noted. */
    changeCount: (cardId: string, finish: Finish, count: number) => {
      const before = entries[cardId] ?? NO_COPIES;
      if (setCount(cardId, finish, count)) note({cardId, finish, count, before}, 'pocket');
    },
    /** A count the card window wrote (`WindowCopies` reports only those that land). */
    noteWindowEdit: (edit: HandCount) => note(edit, 'window'),
  };
}
