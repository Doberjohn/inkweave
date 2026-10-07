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
 */
export type CollectionSyncPlan = 'adopt-server' | 'upload' | 'none';

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

export function resolveCollectionSync({
  uid,
  local,
  hasServer,
  migratedImportedAt,
  pendingImportedAt,
}: SyncInput): CollectionSyncPlan {
  // Never a candidate: another account's copy (#739 defect 1), or one this browser
  // RECEIVED from the server (defect 6), which is already what the server had.
  const uploadable = local !== null && local.source === 'import' && belongsTo(local, uid);

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

  return 'none';
}
