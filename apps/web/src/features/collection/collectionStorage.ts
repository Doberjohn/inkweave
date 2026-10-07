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
//   2. THE STORED COPY CARRIES WHOSE IT IS AND WHERE IT CAME FROM (#739), and
//      three per-uid markers sit beside it, because sign-out keeps the local copy
//      and the cloud sync has to reason about it afterwards. See `LocalCollection`.
//
// Size is not a concern at the measured scale: 831 owned cards serialize to
// roughly 25 KB, well inside any browser's quota. The quota path is handled
// because OTHER things share that quota, not because this payload is large.

import type {RepoResult} from '../../shared/lib/repoResult';
import type {CollectionEntries} from './collectionParser';
import {isCollectionEntries} from './collectionEntryGuards';

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

/** Where a local copy came from (#739). */
export type CollectionSource = 'import' | 'server';

/**
 * The copy THIS BROWSER holds: a {@link StoredCollection} plus two facts the sync
 * needs and a server row cannot carry (#739).
 *
 *   - `ownerUid` is WHOSE copy it is: the uid signed in when it was imported or
 *     adopted, or null for an import made signed out. The collection key is global
 *     while the markers below are per-uid, so without this a second account on a
 *     shared browser reads the first one's copy as its own never-uploaded import.
 *   - `source` is WHERE it came from. A copy mirrored from the server is never
 *     uploaded back, whatever the migrated marker says, because that marker is a
 *     separate write that can fail on its own.
 *
 * Both are optional on disk: a store written before #739 has neither and loads as
 * an anonymous import (`null`, `'import'`). Guessing `'server'` would silently
 * suppress a first upload that should happen.
 */
export interface LocalCollection extends StoredCollection {
  ownerUid: string | null;
  source: CollectionSource;
}

/** Absent (a pre-#739 store), null (a signed-out import), or a uid. */
function isOptionalOwner(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

function isOptionalSource(value: unknown): boolean {
  return value === undefined || value === 'import' || value === 'server';
}

/**
 * True when `value` looks like a current-schema {@link StoredCollection}, with
 * `ownerUid` and `source` either absent or well-formed.
 *
 * `isCollectionEntries` carries the container AND contents check, including the
 * array case, and is shared with `collectionRepository`: the stored copy and the
 * server row are two doors onto the same data, and each had grown its own
 * half-check. See its docblock in `collectionParser` for why the contents matter.
 */
function isCollectionShape(value: unknown): value is StoredCollection & Partial<LocalCollection> {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Partial<LocalCollection>;
  return (
    c.schemaVersion === COLLECTION_SCHEMA_VERSION &&
    typeof c.importedAt === 'number' &&
    isCollectionEntries(c.entries) &&
    isOptionalOwner(c.ownerUid) &&
    isOptionalSource(c.source)
  );
}

/**
 * Read the stored collection, or `null` if none. A corrupt entry (bad JSON, wrong
 * shape, or a stale `schemaVersion`) is removed and treated as absent, so the app
 * starts from "no collection imported" instead of throwing.
 */
export function readCollection(): LocalCollection | null {
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
    if (isCollectionShape(parsed)) {
      return {...parsed, ownerUid: parsed.ownerUid ?? null, source: parsed.source ?? 'import'};
    }
    console.error('[collectionStorage] Unexpected collection shape, clearing.');
  } catch (e) {
    console.error('[collectionStorage] Corrupted collection JSON, clearing key:', e);
  }
  clearCollection();
  return null;
}

/**
 * A {@link RepoResult} narrowed to what this write guarantees: exactly one of the
 * two is null. Still assignable to `RepoResult`, so the storage-swap contract in the
 * header holds; narrower so a caller that checked `error` gets a non-null copy.
 */
type WriteResult = RepoResult<LocalCollection> &
  ({data: LocalCollection; error: null} | {data: null; error: string});

/**
 * Persist freshly imported entries, reporting whether they landed.
 *
 * Takes the entries rather than a built {@link StoredCollection} so the schema
 * version is never the caller's business: there is exactly one place that stamps
 * it, which is what a version is for. `ownerUid` and `source` have no defaults on
 * purpose: every caller has to say whose copy this is and where it came from.
 *
 * The caller is expected to surface a failure. An import that cannot be stored
 * has not happened, and telling someone otherwise costs them the whole import.
 */
export function writeCollection(
  entries: CollectionEntries,
  importedAt: number,
  ownerUid: string | null,
  source: CollectionSource,
): WriteResult {
  const collection: LocalCollection = {
    schemaVersion: COLLECTION_SCHEMA_VERSION,
    importedAt,
    entries,
    ownerUid,
    source,
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

/** A Supabase auth user id, named so the many string parameters below say which strings are accounts. */
type Uid = string;

/*
 * PER-UID MARKERS (#555, #739). Three of them, one fact each, all keyed by uid so
 * two accounts on one browser never read each other's.
 *
 * Marker writes swallow their own failure, so an otherwise good import or sync is
 * never broken by one, and a denied READ counts as "no marker". That is NOT safe
 * in the same direction for all three, and it is accepted rather than solved:
 *   - a lost MIGRATED marker can re-upload a copy; confirmed uploads are also
 *     re-stamped `source: 'server'` on the copy itself, which closes that;
 *   - a lost PENDING marker means a failed upload is not retried, and a lost
 *     TOMBSTONE means a failed delete is not retried. Each needs two failures at
 *     once (the network write AND the marker write), and the rulings of 2026-10-06
 *     chose silence over surfacing either.
 */

function markerStore(prefix: string) {
  const keyFor = (uid: Uid) => `${prefix}:${uid}`;
  const guarded = (action: () => void) => {
    try {
      action();
    } catch (e) {
      console.warn(`[collectionStorage] ${prefix} write failed:`, e);
    }
  };
  return {
    read(uid: Uid): string | null {
      try {
        return localStorage.getItem(keyFor(uid));
      } catch (e) {
        console.warn(`[collectionStorage] ${prefix} read denied:`, e);
        return null;
      }
    },
    write(uid: Uid, value: string): void {
      guarded(() => localStorage.setItem(keyFor(uid), value));
    },
    remove(uid: Uid): void {
      guarded(() => localStorage.removeItem(keyFor(uid)));
    },
  };
}

/** A marker holding an `importedAt`, read back as a number or null. */
function timestampMarker(prefix: string) {
  const store = markerStore(prefix);
  return {
    ...store,
    readTime(uid: Uid): number | null {
      const raw = store.read(uid);
      if (raw === null) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    },
  };
}

/**
 * MIGRATED: the `importedAt` of the copy this uid last got onto the server.
 *
 * NOT merely an optimisation, unlike `deckStorage`'s `hasMigratedDraft`. Sign-out
 * deliberately KEEPS the local collection (owner ruling 2026-08-11), so without it
 * "no server row, upload the local one" would resurrect a collection the user
 * deleted from another device. See `resolveCollectionSync`.
 *
 * A timestamp rather than a flag (#739 defect 3). The flag said only THAT something
 * was uploaded, so a genuinely new import and the stale copy the guard exists for
 * were the same input. The deleted copy is the one whose `importedAt` equals this;
 * a new import differs.
 *
 * A pre-#739 `'1'` reads as 1 and matches no real import, so the copy beside it
 * would be uploadable again, guard case included. Accepted because none can exist
 * in production: nothing mounted `CollectionProvider` before #739 shipped.
 */
const migrated = timestampMarker('inkweave:collection:migrated');

export function migratedImportedAt(uid: Uid): number | null {
  return migrated.readTime(uid);
}

export function markCollectionMigrated(uid: Uid, importedAt: number): void {
  migrated.write(uid, String(importedAt));
}

/**
 * PENDING: the `importedAt` of a copy whose upload was STARTED but not yet
 * confirmed (#739 defect 2). Set before the upsert and cleared only on success, so
 * a failed or interrupted upload is retried by the next sync instead of being
 * overwritten by the older server row. Owner ruling 2026-10-06: silently, no UI.
 */
const pending = timestampMarker('inkweave:collection:pending');

export function pendingUploadImportedAt(uid: Uid): number | null {
  return pending.readTime(uid);
}

export function markUploadPending(uid: Uid, importedAt: number): void {
  pending.write(uid, String(importedAt));
}

/**
 * Clear the pending marker, but only while it still names `importedAt` (always,
 * when omitted). Uploads are queued, so an earlier one can confirm after a later
 * import set a newer marker, and clearing that would drop the newer one's retry.
 */
export function clearUploadPending(uid: Uid, importedAt?: number): void {
  if (importedAt !== undefined && pending.readTime(uid) !== importedAt) return;
  pending.remove(uid);
}

/**
 * TOMBSTONE: a delete of this uid's row that was started but not confirmed (#739
 * defect 4). The next sync retries it BEFORE it may adopt anything, so a row that a
 * failed delete left behind is never adopted back. Owner ruling 2026-10-06.
 *
 * The value is a token rather than a flag for the same reason the pending clear is
 * conditional: a delete confirming after a LATER clear started must not erase that
 * later clear's tombstone. Not `crypto.randomUUID`, which is undefined outside a
 * secure context (a phone on the LAN dev server), and this only needs to differ
 * between two clears on one browser.
 */
const tombstone = markerStore('inkweave:collection:tombstone');

export function hasDeleteTombstone(uid: Uid): boolean {
  return tombstone.read(uid) !== null;
}

/** Set a tombstone, returning the token {@link clearDeleteTombstone} checks. */
export function markDeleteTombstone(uid: Uid): string {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  tombstone.write(uid, token);
  return token;
}

/** Clear the tombstone, but only while it is still the one `token` names (always, when omitted). */
export function clearDeleteTombstone(uid: Uid, token?: string): void {
  if (token !== undefined && tombstone.read(uid) !== token) return;
  tombstone.remove(uid);
}
