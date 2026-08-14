// Imported-collection state (#553, cloud-backed since #555): what the user owns.
//
// Reads localStorage on mount, then reconciles with the `collections` table once
// a uid appears. Still far simpler than `DeckContext`, and deliberately so: a
// draft is mutated continuously, which is why that provider carries a debounce
// and a dirty fingerprint. A collection is written ONCE per import, so there is
// no stream of edits to coalesce and no unsaved state to track — an import
// either landed or reported why not.
//
// TWO PLACES IT DIVERGES FROM `DeckContext`, both owner rulings (2026-08-11):
//   - SIGN-OUT KEEPS the local copy. `DeckContext` calls `clearDraft()`; a deck
//     draft is cheap to recreate, a collection costs a 300KB export.
//   - SERVER WINS on conflict, because a collection is ONE row per user, so an
//     upload over an existing one destroys a remote import with no undo.
// The decision itself lives in `resolveCollectionSync`, pure and tested, because
// its branches need a real session AND a seeded row to reach.
//
// It still takes no other context beyond the session. Entries are keyed by card
// id, and resolving those to cards is the consumer's job.

import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import type {CollectionEntries} from './collectionParser';
import {totalOwned} from './collectionParser';
import {
  clearCollection,
  hasMigratedCollection,
  markCollectionMigrated,
  readCollection,
  writeCollection,
  type StoredCollection,
} from './collectionStorage';
import {deleteCollection, getCollection, upsertCollection} from './collectionRepository';
import {resolveCollectionSync} from './collectionSync';
import {useSession} from '../../shared/contexts/SessionContext';

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

type CollectionState = {entries: CollectionEntries; importedAt: number | null};

/**
 * Act on a resolved sync plan. Hoisted out of the effect so the hook holds the
 * subscription concerns (claim, cancel, read-failure) and this holds the
 * outcome — they change for unrelated reasons.
 */
function applySyncPlan(
  uid: string,
  server: StoredCollection | null,
  local: CollectionState,
  setState: (next: CollectionState) => void,
): void {
  const plan = resolveCollectionSync({
    hasLocal: local.importedAt !== null,
    hasServer: server !== null,
    alreadyMigrated: hasMigratedCollection(uid),
  });

  if (plan === 'adopt-server' && server !== null) {
    // Mirrored into localStorage too, so a later signed-out visit sees the
    // collection this account actually holds rather than a stale import.
    writeCollection(server.entries, server.importedAt);
    markCollectionMigrated(uid);
    setState({entries: server.entries, importedAt: server.importedAt});
    return;
  }
  if (plan === 'upload' && local.importedAt !== null) {
    void upsertCollection(uid, local.entries, local.importedAt).then(({error}) => {
      if (error === null) markCollectionMigrated(uid);
    });
  }
}

/**
 * Reconcile this browser's collection with the account's, once per uid.
 *
 * `claimedUid` is a REF, not state, and claimed before the first await: two
 * renders in the same tick would both see a stale `null` and fire the fetch
 * twice — the same guard `useFirstSignInMigration` uses, for the same reason.
 *
 * Deliberately NOT gated on `state`: the effect must run on the sign-in moment,
 * not on every import. `latest` carries the current value in without making it
 * a dependency, so importing a collection cannot re-trigger a sync of it.
 *
 * Fire-and-forget on failure. If the network is down the local copy still
 * stands and the next load retries, so a failed sync degrades to exactly the
 * pre-#555 behaviour rather than to an error the user must act on.
 */
function useCollectionSync(
  uid: string | null,
  state: CollectionState,
  setState: (next: CollectionState) => void,
) {
  const claimedUid = useRef<string | null>(null);
  // Synced in an unkeyed effect, never mutated in render — the React Compiler
  // forbids the latter, and `DeckContext`'s `latestDeck` does exactly this.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  });

  useEffect(() => {
    if (uid === null) {
      // A real sign-out. Release the claim so signing back in re-syncs, and
      // deliberately DO NOT clear the local collection — see the header.
      claimedUid.current = null;
      return;
    }
    if (claimedUid.current === uid) return;
    claimedUid.current = uid;

    let cancelled = false;
    void getCollection(uid).then(({data: server, error}) => {
      if (cancelled) return;
      // A failed READ must not be mistaken for "the server has none", which
      // would upload over a row we simply could not see.
      if (error !== null) return;

      applySyncPlan(uid, server, latest.current, setState);
    });

    return () => {
      cancelled = true;
    };
  }, [uid, setState]);
}

export function CollectionProvider({children}: {children: ReactNode}) {
  const [state, setState] = useState(loadStored);
  const {user} = useSession();
  const uid = user?.id ?? null;
  useCollectionSync(uid, state, setState);

  // No useMemo/useCallback anywhere below: the React Compiler memoizes this file
  // (#291), and the repo's lint forbids hand-rolling it.
  function importCollection(entries: CollectionEntries, importedAt: number): string | null {
    const {error} = writeCollection(entries, importedAt);
    // State moves only on a successful LOCAL write, so what is on screen and
    // what survives a reload cannot disagree. The cloud write is deliberately
    // fire-and-forget after that: a network failure must not make a successful
    // import report failure, and the next sign-in re-runs the sync anyway.
    if (error !== null) return error;
    setState({entries, importedAt});
    if (uid) {
      void upsertCollection(uid, entries, importedAt).then(({error: remote}) => {
        if (remote === null) markCollectionMigrated(uid);
      });
    }
    return null;
  }

  function clearImported() {
    clearCollection();
    setState({entries: {}, importedAt: null});
    // Clearing while signed in must clear it EVERYWHERE, or the collection
    // reappears from another device and reads as the delete having failed. The
    // migrated marker stays set on purpose: it is what stops this browser's
    // now-absent local copy from being re-uploaded later.
    if (uid) void deleteCollection(uid);
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
