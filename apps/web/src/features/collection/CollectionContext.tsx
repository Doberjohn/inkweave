// Imported-collection state (#553): what the user owns, read from localStorage
// once on mount and replaced wholesale by an import.
//
// Far simpler than `DeckContext`, and deliberately so. A draft is mutated
// continuously, which is why that provider carries a debounce, a dirty
// fingerprint, and a sign-out latch. A collection is written ONCE per import and
// read on every pool tile, so none of that applies: no debounce (there is no
// stream of edits to coalesce), no dirty tracking (there is no unsaved state -
// an import either landed or reported why not), and no first-sign-in migration
// (the cloud half is deferred with the `collections` table).
//
// It takes no other context. Entries are keyed by card id, and resolving those to
// cards is the consumer's job, so this does not depend on `CardDataContext` and
// can mount anywhere.

import {createContext, useContext, useState, type ReactNode} from 'react';
import type {CollectionEntries} from './collectionParser';
import {totalOwned} from './collectionParser';
import {clearCollection, readCollection, writeCollection} from './collectionStorage';

interface CollectionContextValue {
  /** Owned copies per card id. Empty when nothing has been imported. */
  entries: CollectionEntries;
  /** Epoch ms of the import in force, or null when there is none. */
  importedAt: number | null;
  /**
   * Whether a collection has been imported at all.
   *
   * THE GUARD FOR ANY OWNERSHIP UI. "Owns nothing" and "has told us nothing" are
   * different states that {@link owns} cannot distinguish, and conflating them is
   * how an "only cards I own" filter blanks the entire pool for someone who has
   * simply never imported. Check this before offering that filter or a badge.
   */
  hasCollection: boolean;
  /** Copies owned of one card, both finishes. 0 when unowned or none imported. */
  ownedCount: (cardId: string) => number;
  /** Owned means at least one copy, not a full playset (owner ruling 2026-08-10). */
  owns: (cardId: string) => boolean;
  /**
   * Replace the collection with a fresh import, persisting it.
   *
   * Returns null on success, or a message to show the user. An import that could
   * not be stored has not happened, and the caller must not report otherwise.
   */
  importCollection: (entries: CollectionEntries, importedAt: number) => string | null;
  /** Drop the collection entirely. */
  clearImported: () => void;
}

const CollectionContext = createContext<CollectionContextValue | null>(null);

/** The stored collection at mount, read once. */
function loadStored(): {entries: CollectionEntries; importedAt: number | null} {
  const stored = readCollection();
  return stored ? {entries: stored.entries, importedAt: stored.importedAt} : {entries: {}, importedAt: null};
}

export function CollectionProvider({children}: {children: ReactNode}) {
  const [state, setState] = useState(loadStored);

  // No useMemo/useCallback anywhere below: the React Compiler memoizes this file
  // (#291), and the repo's lint forbids hand-rolling it.
  function importCollection(entries: CollectionEntries, importedAt: number): string | null {
    const {error} = writeCollection(entries, importedAt);
    // State moves only on a successful write, so what is on screen and what
    // survives a reload cannot disagree.
    if (error !== null) return error;
    setState({entries, importedAt});
    return null;
  }

  function clearImported() {
    clearCollection();
    setState({entries: {}, importedAt: null});
  }

  const ownedCount = (cardId: string) => totalOwned(state.entries[cardId]);

  const value: CollectionContextValue = {
    entries: state.entries,
    importedAt: state.importedAt,
    hasCollection: state.importedAt !== null,
    ownedCount,
    owns: (cardId: string) => ownedCount(cardId) > 0,
    importCollection,
    clearImported,
  };

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

/**
 * The imported collection. Throws outside its provider rather than returning an
 * empty collection, because the two are indistinguishable at the call site and
 * the silent version renders every card as unowned.
 */
export function useCollection(): CollectionContextValue {
  const ctx = useContext(CollectionContext);
  if (ctx === null) throw new Error('useCollection must be used within a CollectionProvider');
  return ctx;
}
