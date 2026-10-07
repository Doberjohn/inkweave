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
// CLOUD FAILURES ARE SILENT AND DURABLE (owner rulings 2026-10-06, #739). A failed
// upload leaves a pending marker and a failed delete leaves a tombstone; the next
// sync retries either. Neither is surfaced: the local write already succeeded, so
// there is nothing the user could do except wait, which the markers do for them.
//
// ONE LOCAL SLOT, NOT ONE PER ACCOUNT (owner ruling 2026-10-06: per-uid slots
// declined as not-MVP). Each copy records whose it is, so another account never
// sees or uploads it, but an import or adopt by account B still REPLACES it. An
// import A had not yet got onto the server is then gone from this browser, and A's
// pending marker names a copy that no longer exists, which simply never matches.
//
// It still takes no other context beyond the session. Entries are keyed by card
// id, and resolving those to cards is the consumer's job.

import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import type {CollectionEntries} from './collectionParser';
import {totalOwned} from './collectionParser';
import {
  clearCollection,
  clearDeleteTombstone,
  clearUploadPending,
  hasDeleteTombstone,
  markCollectionMigrated,
  markDeleteTombstone,
  markUploadPending,
  migratedImportedAt,
  pendingUploadImportedAt,
  readCollection,
  writeCollection,
  type LocalCollection,
  type Uid,
  type StoredCollection,
} from './collectionStorage';
import {deleteCollection, getCollection, upsertCollection} from './collectionRepository';
import {resolveCollectionSync, visibleTo} from './collectionSync';
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
   *
   * `importedAt` is kept unless it would collide with a copy this browser already
   * holds, in which case it moves just past it; read the stored one back from
   * {@link importedAt}, not from the argument.
   */
  importCollection: (entries: CollectionEntries, importedAt: number) => string | null;
  /** Drop the collection entirely. */
  clearImported: () => void;
}

const CollectionContext = createContext<CollectionContextValue | null>(null);

type CollectionState = LocalCollection | null;

const NO_ENTRIES: CollectionEntries = {};

/**
 * EVERY server write goes through this one chain, so each is issued only after the
 * previous one settled (#739 defect 5). Without it a clear's delete could land
 * before an upsert started earlier, and that upsert would then RECREATE the row the
 * user just cleared. The `localEpoch` latch cannot catch that: it discards a stale
 * READ that is still in memory, while a stale write has already committed.
 *
 * Module scope rather than a provider ref, so the order also holds across a
 * remount: a provider that unmounts with an upsert in flight would otherwise leave
 * it free to land after the next provider's delete. Nothing is persisted here; a
 * reload starts an empty chain, and the markers carry anything left undone.
 *
 * One chain PER UID: two accounts write two different rows, so they never need
 * ordering against each other, and a write hung for one must not hold up another.
 * Deliberately no timeout: a timed-out write is not cancelled, so it could still
 * land after the writes released behind it, which is this defect again. A write
 * that hangs for good is healed by a reload, through the markers.
 */
const writeChains = new Map<Uid, Promise<unknown>>();

function enqueueWrite<T>(uid: Uid, op: () => Promise<T>): Promise<T> {
  const run = (writeChains.get(uid) ?? Promise.resolve()).then(op);
  // The chain itself must never reject, or one failed write stalls every later one.
  writeChains.set(
    uid,
    run.catch((e: unknown) => console.error('[CollectionContext] queued write threw:', e)),
  );
  return run;
}

/**
 * An `importedAt` that names no other copy this browser holds for `uid`.
 *
 * `importedAt` is the identity the markers and the re-stamp guard match on, so two
 * copies sharing one would let a queued upload of the older confirm as the newer:
 * re-stamping the newer copy with the older's entries, and clearing its pending
 * marker. The caller's value is kept unless it collides, which human-paced
 * `Date.now()` stamps practically never do; the contract simply does not promise it.
 */
function uniqueImportStamp(requested: number, uid: Uid | null, local: CollectionState): number {
  const taken = [local?.importedAt ?? null];
  if (uid !== null) taken.push(pendingUploadImportedAt(uid), migratedImportedAt(uid));
  const stamps = taken.filter((t): t is number => t !== null);
  return stamps.includes(requested) ? Math.max(...stamps) + 1 : requested;
}

/**
 * Upload `copy`, recording that it is owed to the server until it lands.
 *
 * The pending marker is set BEFORE the write is even queued, so a reload or a
 * failure anywhere after this line leaves the retry in place (#739 defect 2). It
 * is cleared only for this copy: a later import may already have replaced it.
 */
function uploadCopy(uid: Uid, copy: LocalCollection, setState: (next: CollectionState) => void): void {
  markUploadPending(uid, copy.importedAt);
  void enqueueWrite(uid, async () => {
    const {error} = await upsertCollection(uid, copy.entries, copy.importedAt);
    if (error !== null) return;
    markCollectionMigrated(uid, copy.importedAt);
    clearUploadPending(uid, copy.importedAt);
    restampAsServerCopy(uid, copy, setState);
  });
}

/**
 * Record a confirmed upload ON THE COPY, by re-stamping it `source: 'server'`.
 *
 * The markers alone are not enough: each is a separate write that swallows its own
 * failure. A lost migrated marker would let the copy be uploaded again once the row
 * is deleted elsewhere, and a pending marker that failed to clear would re-upload
 * it over the server on every sync. A server-sourced copy is never uploadable, so
 * this closes both, and the markers become the second line rather than the only one.
 *
 * Only while storage still holds THIS copy: a clear or a newer import may have
 * replaced it while the upload was queued, and neither may be overwritten.
 */
function restampAsServerCopy(uid: Uid, copy: LocalCollection, setState: (next: CollectionState) => void): void {
  const current = readCollection();
  if (current?.importedAt !== copy.importedAt || current.ownerUid !== uid) return;
  const {data} = writeCollection(copy.entries, copy.importedAt, uid, 'server');
  if (data !== null) setState(data);
}

/**
 * Delete this uid's row, leaving a tombstone until it is confirmed gone (#739
 * defect 4). Resolves whether the delete landed, for the sync's retry.
 *
 * Any pending upload is dropped with it: the copy it was owed for has just been
 * cleared, so retrying it later would undo this delete.
 */
function deleteFromServer(uid: Uid): Promise<boolean> {
  const token = markDeleteTombstone(uid);
  clearUploadPending(uid);
  return enqueueWrite(uid, async () => {
    const {error} = await deleteCollection(uid);
    if (error === null) clearDeleteTombstone(uid, token);
    return error === null;
  });
}

/**
 * Take the server's copy, mirroring it into localStorage so a later signed-out
 * visit sees what this account actually holds rather than a stale import.
 *
 * The mirror is stamped `source: 'server'`, which is what keeps it from ever being
 * uploaded back if the migrated marker below fails to write (#739 defect 6).
 *
 * The mirror's error is CHECKED rather than discarded. The marker records that
 * this copy is on the server, so setting it after a failed mirror claims a durable
 * local copy that does not exist. State still moves, because the server data in
 * memory is correct and the user should see it; only the durability claim is
 * withheld, so the next mount reconciles again instead of trusting a failed write.
 */
function adoptServerCopy(uid: Uid, server: StoredCollection, setState: (next: CollectionState) => void): void {
  const {error} = writeCollection(server.entries, server.importedAt, uid, 'server');
  if (error === null) {
    markCollectionMigrated(uid, server.importedAt);
  } else {
    // The mirror failed, so localStorage still holds the copy the server just
    // SUPERSEDED. Leaving it is worse than holding nothing: a later signed-out
    // mount would read a collection this very sync decided had lost, and present
    // it as current. "Server wins on conflict" (owner ruling 2026-08-11) has to
    // hold on the failure path too, or it only means "server wins when nothing
    // goes wrong". Best-effort by design: `clearCollection` swallows its own
    // failure, and there is nothing further to try if removal is denied as well.
    clearCollection();
  }
  // Any pending marker named a different copy, or the plan would have been upload.
  clearUploadPending(uid);
  setState({...server, ownerUid: uid, source: 'server'});
}

/**
 * Upload this browser's copy, first CLAIMING an anonymous one for `uid`.
 *
 * The claim comes first and gates the upload (#739 defect 1). Once a signed-out
 * import has been sent to account A it is A's, and left unstamped it would still
 * read as anyone's: B signing in on the same browser would upload A's collection
 * into B's row. If the claim cannot be written, nothing is sent; the copy stays
 * local and anonymous, and the next sign-in tries again.
 */
function uploadLocalCopy(uid: Uid, local: LocalCollection, setState: (next: CollectionState) => void): void {
  let copy = local;
  if (local.ownerUid === null) {
    const {data, error} = writeCollection(local.entries, local.importedAt, uid, 'import');
    if (error !== null) return;
    copy = data;
    setState(copy);
  }
  uploadCopy(uid, copy, setState);
}

/**
 * Everything the decision reads from THIS browser, taken BEFORE the server round
 * trip. Read after it instead, an upload confirming mid-read could clear the
 * pending marker and re-stamp the copy, and a GET served before that upload landed
 * would then look like a genuine server win and be adopted over the newer import.
 * Taken first, the same race costs one redundant upsert of the same copy.
 */
interface SyncSnapshot {
  local: CollectionState;
  migratedImportedAt: number | null;
  pendingImportedAt: number | null;
}

function snapshotFor(uid: Uid, local: CollectionState): SyncSnapshot {
  return {local, migratedImportedAt: migratedImportedAt(uid), pendingImportedAt: pendingUploadImportedAt(uid)};
}

/**
 * Act on a resolved sync plan. Hoisted out of the effect so the hook holds the
 * subscription concerns (claim, cancel, staleness) and this holds the outcome:
 * they change for unrelated reasons.
 */
function applySyncPlan(
  uid: Uid,
  server: StoredCollection | null,
  snapshot: SyncSnapshot,
  setState: (next: CollectionState) => void,
): void {
  const plan = resolveCollectionSync({uid, ...snapshot, hasServer: server !== null});

  if (plan === 'adopt-server' && server !== null) {
    adoptServerCopy(uid, server, setState);
    return;
  }
  if (plan === 'upload' && snapshot.local !== null) {
    uploadLocalCopy(uid, snapshot.local, setState);
  }
}

/**
 * What the server holds for `uid`, as far as this sync may act on it, or
 * `undefined` when it must not act at all.
 *
 * A tombstone is retried FIRST and replaces the read (#739 defect 4, owner ruling
 * 2026-10-06): once the row is confirmed gone the answer is "nothing", and while it
 * is not the sync stops. Checking the tombstone after resolving the plan would let
 * one mount adopt the very row the user cleared.
 */
async function serverStateFor(uid: Uid): Promise<StoredCollection | null | undefined> {
  if (hasDeleteTombstone(uid)) return (await deleteFromServer(uid)) ? null : undefined;
  const {data, error} = await getCollection(uid);
  // A failed READ must not be mistaken for "the server has none", which
  // would upload over a row we simply could not see.
  return error === null ? data : undefined;
}

/**
 * Reconcile this browser's collection with the account's, once per uid.
 *
 * `claimedUid` is a REF, not state, and claimed before the first await: two
 * renders in the same tick would both see a stale `null` and fire the fetch twice.
 *
 * Deliberately NOT gated on `state`: the effect must run on the sign-in moment,
 * not on every import. `latest` carries the current value in without making it
 * a dependency, so importing a collection cannot re-trigger a sync of it.
 *
 * Silent on failure: the local copy still stands, and the pending marker or
 * tombstone left by whichever write failed is what the next sync retries.
 */
function useCollectionSync(
  uid: Uid | null,
  state: CollectionState,
  setState: (next: CollectionState) => void,
  localEpoch: {current: number},
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
    // A result goes stale for THREE reasons, and `cancelled` only covers two of them
    // (uid change, unmount). The third is a local mutation landing mid-flight: a
    // clear during the fetch would be undone by the adopt-server branch applying a
    // snapshot taken before it, restoring the collection the user just deleted, and
    // an import in the same window is overwritten the same way.
    const epochAtRead = localEpoch.current;
    const isStale = () => cancelled || localEpoch.current !== epochAtRead;
    const snapshot = snapshotFor(uid, latest.current);
    void serverStateFor(uid).then((server) => {
      if (isStale() || server === undefined) return;
      applySyncPlan(uid, server, snapshot, setState);
    });

    return () => {
      cancelled = true;
    };
  }, [uid, setState, localEpoch]);
}

export function CollectionProvider({children}: {children: ReactNode}) {
  const [state, setState] = useState<CollectionState>(readCollection);
  const {user, loading} = useSession();
  const uid = user?.id ?? null;
  /** Bumped by every local mutation, so an in-flight server read can tell it is stale. */
  const localEpoch = useRef(0);
  // The sync reasons about the FULL local copy, another account's included; only
  // what is exposed below is filtered (owner ruling 2026-10-06).
  useCollectionSync(uid, state, setState, localEpoch);
  const visible = state !== null && visibleTo(state, {uid, loading}) ? state : null;

  // No useMemo/useCallback anywhere below: the React Compiler memoizes this file
  // (#291), and the repo's lint forbids hand-rolling it.
  function importCollection(entries: CollectionEntries, importedAt: number): string | null {
    const stamp = uniqueImportStamp(importedAt, uid, state);
    const {data, error} = writeCollection(entries, stamp, uid, 'import');
    // State moves only on a successful LOCAL write, so what is on screen and
    // what survives a reload cannot disagree. The cloud write is deliberately
    // silent after that: a network failure must not make a successful LOCAL
    // import report failure. The pending marker retries it instead.
    if (error !== null) return error;
    setState(data);
    localEpoch.current += 1;
    if (uid) {
      // This import supersedes any clear still owed to the server: its upsert is
      // queued behind that delete and replaces the row either way, so a tombstone
      // left in place would make the next sync delete THIS import.
      clearDeleteTombstone(uid);
      uploadCopy(uid, data, setState);
    }
    return null;
  }

  function clearImported() {
    clearCollection();
    setState(null);
    localEpoch.current += 1;
    // Clearing while signed in clears it everywhere, or the collection reappears
    // from another device. Queued behind any upload already in flight, and
    // tombstoned until it lands.
    if (uid) void deleteFromServer(uid);
  }

  const ownedCount = (cardId: string) => totalOwned(visible?.entries[cardId]);

  const value: CollectionContextValue = {
    entries: visible?.entries ?? NO_ENTRIES,
    importedAt: visible?.importedAt ?? null,
    hasCollection: visible !== null,
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
