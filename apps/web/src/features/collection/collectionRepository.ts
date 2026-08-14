import {getSupabase} from '../../shared/lib/supabase';
import type {Json} from '../../shared/lib/database.types';
import {NOT_CONFIGURED, type RepoResult} from '../../shared/lib/repoResult';
import type {CollectionEntries} from './collectionParser';
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

/** The same shell deckRepository uses: env-gate, await, normalise to RepoResult. */
async function run<T>(
  op: (
    client: NonNullable<ReturnType<typeof getSupabase>>,
  ) => PromiseLike<{data: T | null; error: {message: string} | null}>,
): Promise<RepoResult<T>> {
  const supabase = getSupabase();
  if (!supabase) return {data: null, error: NOT_CONFIGURED};
  try {
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

/**
 * Shape guard: `entries` is `jsonb`, so the row's TYPE is only a promise — the
 * column's CHECK enforces "object" in the database, but nothing enforces it
 * between there and here.
 *
 * Three separate returns rather than one `||` chain: each rejects a different
 * thing (absent, scalar, array), and the array case is the one that would
 * otherwise slip through `typeof raw === 'object'`.
 */
function isEntriesObject(raw: unknown): raw is CollectionEntries {
  if (raw === null) return false;
  if (typeof raw !== 'object') return false;
  return !Array.isArray(raw);
}

function toEntries(raw: unknown): CollectionEntries {
  return isEntriesObject(raw) ? raw : {};
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
    return {
      data: {
        schemaVersion: data.schema_version,
        importedAt: Date.parse(data.imported_at),
        entries: toEntries(data.entries),
      },
      error: null,
    };
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
