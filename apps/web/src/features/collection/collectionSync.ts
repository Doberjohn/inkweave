/**
 * What to do about a collection at sign-in (#555).
 *
 * Pure and separate from the context for the same reason `collectionAction` is:
 * every interesting branch needs a real OAuth session plus a seeded database
 * row, so inside an effect these can only be verified by signing in and
 * clicking. As a function they are six assertions.
 *
 * TWO OWNER RULINGS ARE ENCODED HERE (2026-08-11):
 *   1. Server wins on conflict. A collection is ONE row per user, so uploading
 *      over an existing one destroys a remote import with no undo. The local
 *      copy is always re-creatable from the CSV; the remote one may not be.
 *   2. Sign-out keeps the local copy, unlike `decks`' `clearDraft()`. A deck
 *      draft is cheap to recreate; a collection costs a 300KB export and a
 *      deliberate import.
 *
 * Ruling 2 is what makes `alreadyMigrated` load-bearing rather than a mere
 * optimisation — see the guard below.
 */
export type CollectionSyncPlan = 'adopt-server' | 'upload' | 'none';

export function resolveCollectionSync({
  hasLocal,
  hasServer,
  alreadyMigrated,
}: {
  hasLocal: boolean;
  hasServer: boolean;
  alreadyMigrated: boolean;
}): CollectionSyncPlan {
  // Checked first, so it holds whether or not anything is stored locally. The
  // marker gates UPLOADS, never reads: a signed-in user must pick their
  // collection up on every load, not only the first.
  if (hasServer) return 'adopt-server';

  // THE RESURRECTION GUARD. Without it, this reads `hasLocal && !hasServer` and
  // is wrong in one real case: after migrating, the user clears their collection
  // from another device. The server row is gone, but this browser still holds
  // the local copy — because sign-out deliberately keeps it — so a plain
  // "no server row, upload the local one" would silently undo their deletion.
  if (hasLocal && !alreadyMigrated) return 'upload';

  return 'none';
}
