import {loadSupabase, type InkweaveSupabase} from '../../shared/lib/supabase';
import type {Json} from '../../shared/lib/database.types';
import {NOT_CONFIGURED, type RepoResult} from '../../shared/lib/repoResult';
import type {CollectionEntries} from './collectionParser';
import {isCollectionEntries} from './collectionEntryGuards';
import type {StoredCollection} from './collectionStorage';

/**
 * The `collections` table (#555), one row per user.
 *
 * Mirrors `deckRepository`'s shape deliberately — same `RepoResult` contract,
 * same `run` shell, same `NOT_CONFIGURED` gate — so a reader who knows one knows
 * this. The differences are all consequences of the table being ONE ROW PER
 * USER rather than a list:
 *
 *   - keyed by `owner_id`, which IS the primary key, so writes are a plain
 *     upsert with no read-then-write race and no id to generate;
 *   - `getCollection` resolves `null` DATA for "no row yet", which is a normal
 *     state (a user who has never imported), not an error;
 *   - there is no list/public variant, because a collection is never shared.
 */

export type {RepoResult} from '../../shared/lib/repoResult';

const SCHEMA_VERSION = 1 as const;

type CollectionsClient = InkweaveSupabase;

/**
 * Load the client, run the op, normalise everything to a RepoResult.
 *
 * `loadSupabase()` is INSIDE the try, and that placement is load-bearing (#729).
 * It is a cached dynamic import of the SDK chunk, so it can reject on a failed
 * download, not merely resolve null when unconfigured. Hoisted above the try,
 * that rejection escapes as an unhandled promise instead of becoming the
 * 'Network error' every caller already handles. TypeScript flags the call-site
 * rename but cannot see this, so it has to be remembered rather than checked.
 */
async function run<T>(
  op: (client: CollectionsClient) => PromiseLike<{data: T | null; error: {message: string} | null}>,
): Promise<RepoResult<T>> {
  try {
    const supabase = await loadSupabase();
    if (!supabase) return {data: null, error: NOT_CONFIGURED};
    const {data, error} = await op(supabase);
    if (error) {
      console.error('[collectionRepository] query failed:', error.message);
      return {data: null, error: error.message};
    }
    return {data, error: null};
  } catch (e) {
    console.error('[collectionRepository] network error:', e);
    return {data: null, error: 'Network error'};
  }
}

/** The three columns a collection row is read back through. */
interface CollectionRow {
  entries: unknown;
  imported_at: string;
  schema_version: number;
}

/**
 * A row we can safely adopt, or null when we cannot.
 *
 * The row's TYPE is a promise, not a guarantee: `entries` is `jsonb`, and the
 * column's CHECK enforces only "object" in the database. Three ways that bites,
 * each silent in its own way:
 *
 *   - A FUTURE `schema_version` would be adopted as version 1.
 *   - `Date.parse` yields NaN on a malformed timestamp. `writeCollection` then
 *     serializes NaN as `null`, `readCollection` rejects the mirror on the next
 *     load and clears it, and the collection vanishes with no error anywhere.
 *   - `entries: {"2001": null}` passes any container-only check, and
 *     `adoptServerCopy` puts it straight into React state, where
 *     `collectionStats` dereferences it. This door was open after the
 *     localStorage one was closed, which is why the guard is now SHARED
 *     (`isCollectionEntries`) rather than written once per reader.
 *
 * Sequential returns rather than a `&&` chain so the caller can say which check
 * rejected the row, and so adding a fourth does not deepen anything.
 */
function toStoredCollection(row: CollectionRow): StoredCollection | null {
  if (row.schema_version !== SCHEMA_VERSION) return null;
  const importedAt = Date.parse(row.imported_at);
  if (Number.isNaN(importedAt)) return null;
  if (!isCollectionEntries(row.entries)) return null;
  return {schemaVersion: row.schema_version, importedAt, entries: row.entries};
}

/**
 * The signed-in user's collection, or `null` data when they have none.
 *
 * `maybeSingle`, not `single`: no row is the expected state for anyone who has
 * not imported yet, and `single` turns that into an error the caller would have
 * to pattern-match out of a message string.
 */
export function getCollection(ownerId: string): Promise<RepoResult<StoredCollection | null>> {
  return run(async (client) => {
    const {data, error} = await client
      .from('collections')
      .select('entries, imported_at, schema_version')
      .eq('owner_id', ownerId)
      .maybeSingle();
    if (error || data === null) return {data: null, error};
    // An unusable row is an ERROR, never empty data. `useCollectionSync` returns
    // early on a read error rather than treating it as "the server has none", so
    // failing here keeps a bad row from displacing a good local copy. Returning
    // `{}` entries instead, which this used to do, would quietly adopt an empty
    // collection over the user's real one.
    const collection = toStoredCollection(data);
    if (collection === null) {
      const shape = `schema ${String(data.schema_version)}, imported_at ${String(data.imported_at)}`;
      return {data: null, error: {message: `unusable collection row (${shape})`}};
    }
    return {data: collection, error: null};
  });
}

/**
 * Write the collection, replacing whatever is there.
 *
 * An upsert rather than insert-or-update-by-branch: the primary key already
 * guarantees one row, so the database resolves the conflict and there is no
 * window between a caller's read and its write.
 *
 * `updated_at` is omitted on purpose — the trigger owns it on both INSERT and
 * UPDATE, so sending one would be ignored at best and forged at worst.
 */
export function upsertCollection(
  ownerId: string,
  entries: CollectionEntries,
  importedAt: number,
): Promise<RepoResult<null>> {
  return run(async (client) => {
    const {error} = await client.from('collections').upsert(
      {
        owner_id: ownerId,
        // Cast at the boundary, and it is a TypeScript artefact rather than a
        // real mismatch: `CollectionEntry` is an `interface`, and interfaces get
        // no implicit index signature, so they never satisfy `Json`'s
        // `{[k: string]: Json}` however plain their fields are. The runtime
        // value is already valid JSON, and the column's CHECK constraint
        // (`jsonb_typeof(entries) = 'object'`) is the real guard.
        entries: entries as unknown as Json,
        imported_at: new Date(importedAt).toISOString(),
        schema_version: SCHEMA_VERSION,
      },
      {onConflict: 'owner_id'},
    );
    return {data: null, error};
  });
}

/** Drop the row. Clearing a collection while signed in must clear it everywhere. */
export function deleteCollection(ownerId: string): Promise<RepoResult<null>> {
  return run(async (client) => {
    const {error} = await client.from('collections').delete().eq('owner_id', ownerId);
    return {data: null, error};
  });
}
