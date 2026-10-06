// localStorage persistence for the imported collection (#553), following
// `features/deck/state/deckStorage.ts`: every access is wrapped so a denied or
// corrupt store can never wedge the app, and a bad entry clears itself rather
// than being trusted.
//
// TWO DELIBERATE DIVERGENCES from that file, both because a collection is not a
// draft:
//
//   1. A FAILED WRITE IS REPORTED, not swallowed. `deckStorage.writeDraft` returns
//      void and logs, which is right for a draft: writes are continuous, so the
//      next keystroke retries and last-write-wins. A collection is written ONCE,
//      by an explicit import the user just sat through. Silently losing it means
//      they see a success screen and an empty collection after reload. So this
//      returns `RepoResult`, the same contract the Supabase repositories use —
//      which is also what lets the storage layer swap later without touching a
//      single consumer, the stated design goal for this module.
//   2. NO MIGRATION GUARD. There is no anonymous-to-account copy to be idempotent
//      about yet; the cloud half is deferred with the `collections` migration.
//
// Size is not a concern at the measured scale: 831 owned cards serialize to
// roughly 25 KB, well inside any browser's quota. The quota path is handled
// because OTHER things share that quota, not because this payload is large.

import type {RepoResult} from '../../shared/lib/repoResult';
import type {CollectionEntries, CollectionEntry} from './collectionParser';

/** The single stored collection. Namespaced alongside `inkweave:deck:*`. */
export const COLLECTION_KEY = 'inkweave:collection';

/** Persisted-shape version; a stored collection with a different one is discarded. */
const COLLECTION_SCHEMA_VERSION = 1;

export interface StoredCollection {
  schemaVersion: number;
  /** Epoch ms of the import that produced this, matching `Deck.createdAt`. */
  importedAt: number;
  entries: CollectionEntries;
}

/**
 * True when every VALUE in `entries` is a real `CollectionEntry`.
 *
 * Checking the container alone is not enough, and the gap is not theoretical.
 * `holdingOf` in `collectionStats` guards `entry === undefined`, which is the
 * right guard for a card nobody owns, but `null !== undefined`: a stored
 * `{"1234": null}` sails past the container check, reaches `entry.normal` and
 * throws, taking the whole binder down. The validator admits a malformed
 * presence that the consumer's absence guard was never written to catch.
 */
function hasValidEntries(entries: object): boolean {
  return Object.values(entries).every(
    (e: unknown) =>
      typeof e === 'object' &&
      e !== null &&
      typeof (e as Partial<CollectionEntry>).normal === 'number' &&
      typeof (e as Partial<CollectionEntry>).foil === 'number',
  );
}

/** True when `value` looks like a current-schema {@link StoredCollection}. */
function isCollectionShape(value: unknown): value is StoredCollection {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Partial<StoredCollection>;
  return (
    c.schemaVersion === COLLECTION_SCHEMA_VERSION &&
    typeof c.importedAt === 'number' &&
    typeof c.entries === 'object' &&
    c.entries !== null &&
    // An array is an object, and `entries` is a Record. Without this a stored
    // `[]` round-trips as a valid empty collection instead of being discarded.
    !Array.isArray(c.entries) &&
    hasValidEntries(c.entries)
  );
}

/**
 * Read the stored collection, or `null` if none. A corrupt entry (bad JSON, wrong
 * shape, or a stale `schemaVersion`) is removed and treated as absent, so the app
 * starts from "no collection imported" instead of throwing.
 */
export function readCollection(): StoredCollection | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(COLLECTION_KEY);
  } catch (e) {
    console.warn('[collectionStorage] localStorage read denied:', e);
    return null;
  }
  if (raw === null) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isCollectionShape(parsed)) return parsed;
    console.error('[collectionStorage] Unexpected collection shape, clearing.');
  } catch (e) {
    console.error('[collectionStorage] Corrupted collection JSON, clearing key:', e);
  }
  clearCollection();
  return null;
}

/**
 * Persist freshly imported entries, reporting whether they landed.
 *
 * Takes the entries rather than a built {@link StoredCollection} so the schema
 * version is never the caller's business: there is exactly one place that stamps
 * it, which is what a version is for.
 *
 * The caller is expected to surface a failure. An import that cannot be stored
 * has not happened, and telling someone otherwise costs them the whole import.
 */
export function writeCollection(
  entries: CollectionEntries,
  importedAt: number,
): RepoResult<StoredCollection> {
  const collection: StoredCollection = {
    schemaVersion: COLLECTION_SCHEMA_VERSION,
    importedAt,
    entries,
  };
  try {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
    return {data: collection, error: null};
  } catch (e) {
    console.error('[collectionStorage] localStorage write failed:', e);
    return {data: null, error: 'Your browser would not let us save this collection.'};
  }
}

/** Drop the stored collection entirely. */
export function clearCollection(): void {
  try {
    localStorage.removeItem(COLLECTION_KEY);
  } catch (e) {
    console.warn('[collectionStorage] localStorage cleanup failed:', e);
  }
}

/**
 * Per-uid "this browser's collection has been uploaded" marker (#555), mirroring
 * `deckStorage`'s `hasMigratedDraft`.
 *
 * NOT merely an optimisation, unlike the decks one. Sign-out deliberately KEEPS
 * the local collection (owner ruling 2026-08-11, because re-importing costs a
 * 300KB export), so without this marker the rule "no server row, upload the
 * local one" would resurrect a collection the user deleted from another device.
 * See `resolveCollectionSync`.
 *
 * Keyed by uid so two accounts on one browser never read each other's marker.
 *
 * NOTE THE ASYMMETRY, which is a known defect rather than a design: the MARKER is
 * per-uid, the COLLECTION key above is not. So a second account signing in on a
 * shared browser finds no marker of its own and reads that as "this local copy has
 * never been uploaded for me", when the truth is "this local copy belongs to someone
 * else". Tracked by #739.
 */
const MIGRATED_PREFIX = 'inkweave:collection:migrated';

function migratedKey(uid: string): string {
  return `${MIGRATED_PREFIX}:${uid}`;
}

export function hasMigratedCollection(uid: string): boolean {
  try {
    return localStorage.getItem(migratedKey(uid)) === '1';
  } catch (e) {
    // Read denied (private mode, blocked storage). Treat as NOT migrated: the
    // cost is one redundant upsert, where guessing the other way would skip a
    // real first upload and lose the import.
    console.warn('[collectionStorage] migrated-flag read denied:', e);
    return false;
  }
}

export function markCollectionMigrated(uid: string): void {
  try {
    localStorage.setItem(migratedKey(uid), '1');
  } catch (e) {
    console.warn('[collectionStorage] migrated-flag write failed:', e);
  }
}
