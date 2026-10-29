import type {CollectionSource} from './collectionStorage';

/**
 * What to do about a collection at sign-in (#555, #739).
 *
 * Pure and separate from the context for the same reason `collectionAction` is:
 * every interesting branch needs a real OAuth session plus a seeded database
 * row, so inside an effect these can only be verified by signing in and
 * clicking. As a function they are a table of assertions.
 *
 * TWO OWNER RULINGS ARE ENCODED HERE (2026-08-11):
 *   1. Server wins on conflict. A collection is ONE row per user, so uploading
 *      over an existing one destroys a remote import with no undo. The local
 *      copy is always re-creatable from the CSV; the remote one may not be.
 *   2. Sign-out keeps the local copy, unlike `decks`' `clearDraft()`. A deck
 *      draft is cheap to recreate; a collection costs a 300KB export and a
 *      deliberate import.
 *
 * Both say "the local copy" as though that were unambiguous, and until #739 the
 * inputs were three booleans that could not say WHOSE copy, WHERE it came from, or
 * WHICH one was uploaded. The inputs below carry all three.
 *
 * A pending DELETE (the tombstone) is not an input: the caller retries it before
 * resolving at all, and passes `hasServer: false` once it lands. Resolving first
 * and checking after would let one mount adopt the row the user cleared.
 *
 * A THIRD RULING (owner, 2026-10-19, #826): a copy the account had is DROPPED once
 * its row is gone, the collection having been cleared from another device. Kept, it
 * read as the collection still in force, and since counts change in the app, one
 * edit to it uploaded it again and undid the clear.
 */
export type CollectionSyncPlan = 'adopt-server' | 'upload' | 'drop-local' | 'none';

/** The parts of the local copy the decision reads. */
export interface LocalCopyFacts {
  importedAt: number;
  ownerUid: string | null;
  source: CollectionSource;
}

export interface SyncInput {
  uid: string;
  local: LocalCopyFacts | null;
  hasServer: boolean;
  /** `importedAt` of the copy this uid last got onto the server. */
  migratedImportedAt: number | null;
  /** `importedAt` of a copy whose upload this uid started but never confirmed. */
  pendingImportedAt: number | null;
}

/**
 * Whether `uid` may treat this copy as its own. An anonymous import belongs to
 * whoever signs in next, which is the anonymous-import-then-sign-in case the
 * upload branch exists for; a copy stamped with another uid never does.
 */
export function belongsTo(local: {ownerUid: string | null}, uid: string): boolean {
  return local.ownerUid === null || local.ownerUid === uid;
}

/**
 * Whether the current viewer may SEE this copy (owner ruling 2026-10-06: account B
 * on a shared browser sees an empty collection and the import prompt, not A's
 * cards, or every ownership badge would be reporting someone else's data).
 *
 * Signed out shows everything, per ruling 2 above. While the session is still
 * resolving an owned copy stays hidden: on reload the uid reads null until the
 * lookup lands, so "signed out" at that moment may be account B. The cost is a
 * brief empty state for the owner; the alternative is showing A's cards to B.
 */
export function visibleTo(
  local: {ownerUid: string | null},
  viewer: {uid: string | null; loading: boolean},
): boolean {
  if (local.ownerUid === null) return true;
  if (viewer.uid === null) return !viewer.loading;
  return local.ownerUid === viewer.uid;
}

/**
 * Whether the account had this copy: one mirrored from it, or this uid's import whose
 * upload the migrated marker confirmed (its re-stamp as `'server'` failed to land).
 * Never an anonymous copy, nor another account's.
 */
function wasOnAccount(local: LocalCopyFacts | null, uid: string, migratedImportedAt: number | null): boolean {
  if (local === null || local.ownerUid !== uid) return false;
  return local.source === 'server' || local.importedAt === migratedImportedAt;
}

/**
 * Whether `uid` may upload this copy. Never another account's (#739 defect 1), nor one
 * this browser RECEIVED from the server (defect 6), which is already what the server had.
 */
function isUploadable(local: LocalCopyFacts | null, uid: string): local is LocalCopyFacts {
  return local !== null && local.source === 'import' && belongsTo(local, uid);
}

export function resolveCollectionSync({
  uid,
  local,
  hasServer,
  migratedImportedAt,
  pendingImportedAt,
}: SyncInput): CollectionSyncPlan {
  const uploadable = isUploadable(local, uid);

  // A copy whose upload was started and never confirmed beats the server row.
  // Ahead of server-wins on purpose (defect 2): that ruling is about two devices
  // with two imports, not about a stale row eating an import this browser simply
  // failed to send. Matched on `importedAt` so the marker vouches for THIS copy only.
  if (uploadable && pendingImportedAt === local.importedAt) return 'upload';

  // The marker gates UPLOADS, never reads: a signed-in user must pick their
  // collection up on every load, not only the first.
  if (hasServer) return 'adopt-server';

  // THE RESURRECTION GUARD. After migrating, the user may clear their collection
  // from another device: the row is gone, but sign-out kept this browser's copy,
  // so "no server row, upload the local one" would silently undo their deletion.
  // The copy they deleted is the one the marker names; a NEW import has a
  // different `importedAt` and still uploads (defect 3).
  if (uploadable && local.importedAt !== migratedImportedAt) return 'upload';

  // And it goes here too, as the clear that removed the row would have taken it
  // (the third ruling above): not uploading it is no longer enough, since an edit
  // makes a new copy that does upload.
  if (wasOnAccount(local, uid, migratedImportedAt)) return 'drop-local';

  return 'none';
}

/**
 * Whether `uid` holds a collection once `plan` has run: the account's, adopted or uploaded, or
 * this browser's copy when it is theirs. A start waiting on the sync asks it (`startCollection`):
 * only an account holding none gets the empty collection.
 */
export function holdsAfterSync(plan: CollectionSyncPlan, local: {ownerUid: string | null} | null, uid: string): boolean {
  if (plan === 'adopt-server' || plan === 'upload') return true;
  if (plan === 'drop-local') return false;
  return local !== null && belongsTo(local, uid);
}
