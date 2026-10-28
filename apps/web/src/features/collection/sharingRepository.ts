import {loadSupabase, type InkweaveSupabase} from '../../shared/lib/supabase';
import {NOT_CONFIGURED, type RepoResult} from '../../shared/lib/repoResult';
import type {CollectionEntries} from './collectionParser';
import {isCollectionEntries} from './collectionEntryGuards';

/**
 * Collection sharing (#1045): a player's switch, `collection_sharing`, which only they read
 * and write, and their friends' collections, which a friend reads only through
 * `friend_collections()`. That function checks the friendship and the switch on every call,
 * so a friend who stops sharing, or stops being a friend, answers with no row from the next
 * read on. The binder's reads live here, in `features/collection`, so the binder's chunk and
 * the friends chunk share no module (`useFriendCollection`).
 *
 * Same house rules as `collectionRepository`: env-gated, every call wrapped, a `RepoResult`.
 */

const SCHEMA_VERSION = 1;

/** A handle as `profiles` stores it (`profiles_handle_format`): no query for anything else. */
const HANDLE = /^[a-z0-9_]{3,30}$/;

/** A player found by handle: their id, and their public name if they have one. */
export interface Player {
  id: string;
  handle: string;
  /** Null for a profile with no public name yet. */
  name: string | null;
}

/**
 * Load the client, run the op, normalise everything to a RepoResult. `loadSupabase()` sits
 * inside the try, as in `collectionRepository` (#729): it can reject on a failed download.
 */
async function run<T>(
  op: (client: InkweaveSupabase) => PromiseLike<{data: T | null; error: {message: string} | null}>,
): Promise<RepoResult<T>> {
  try {
    const supabase = await loadSupabase();
    if (!supabase) return {data: null, error: NOT_CONFIGURED};
    const {data, error} = await op(supabase);
    if (error) {
      console.error('[sharingRepository] query failed:', error.message);
      return {data: null, error: error.message};
    }
    return {data, error: null};
  } catch (e) {
    console.error('[sharingRepository] network error:', e);
    return {data: null, error: 'Network error'};
  }
}

/** The caller's switch; false when they have never set it (no row). */
export function getSharing(ownerId: string): Promise<RepoResult<boolean>> {
  return run(async (client) => {
    const {data, error} = await client
      .from('collection_sharing')
      .select('friends')
      .eq('owner_id', ownerId)
      .maybeSingle();
    return {data: error ? null : (data?.friends ?? false), error};
  });
}

/**
 * Turns the switch on or off: an upsert of `(owner_id, friends)`, the two columns the table
 * grants the client. The row needs the caller's collection row (a foreign key), so a player
 * with no collection gets an error.
 */
export function setSharing(ownerId: string, friends: boolean): Promise<RepoResult<null>> {
  return run(async (client) => {
    const {error} = await client.from('collection_sharing').upsert({owner_id: ownerId, friends}, {onConflict: 'owner_id'});
    return {data: null, error};
  });
}

/** One row of `friend_collections()`, before anything about it is checked. */
interface FriendRow {
  owner_id: unknown;
  entries: unknown;
  schema_version: unknown;
}

/**
 * A friend's entries, or null for a row this app can't read: a schema it doesn't know, or
 * entries that aren't a map of copy counts (`isCollectionEntries`), as `toStoredCollection`
 * refuses its own. A friend's binder then shows its error, never an empty binder.
 */
function friendEntries(row: FriendRow): CollectionEntries | null {
  if (row.schema_version !== SCHEMA_VERSION) return null;
  return isCollectionEntries(row.entries) ? row.entries : null;
}

/**
 * A friend's collection, or null data when they don't share it with the caller: not a
 * friend, a request still waiting, the switch off, or no collection. The function answers
 * each with no row, so the call tells a stranger nothing.
 */
export function getFriendCollection(friendId: string): Promise<RepoResult<CollectionEntries | null>> {
  return run(async (client) => {
    const {data, error} = await client.rpc('friend_collections', {only_friend: friendId});
    if (error || !data) return {data: null, error};
    const row = (data as FriendRow[]).find((each) => each.owner_id === friendId);
    if (row === undefined) return {data: null, error: null};
    const entries = friendEntries(row);
    if (entries === null) return {data: null, error: {message: `unusable friend collection (schema ${String(row.schema_version)})`}};
    return {data: entries, error: null};
  });
}

/**
 * A player's id, handle and name, looked up by handle, from their public `profiles` row,
 * which anyone may read once it has a handle. Null when no one has the handle.
 */
export function getPlayerByHandle(handle: string): Promise<RepoResult<Player | null>> {
  const wanted = handle.toLowerCase();
  if (!HANDLE.test(wanted)) return Promise.resolve({data: null, error: null});
  return run(async (client) => {
    const {data, error} = await client
      .from('profiles')
      .select('id, handle, display_name')
      .eq('handle', wanted)
      .maybeSingle();
    if (error || !data?.handle) return {data: null, error};
    return {data: {id: data.id, handle: data.handle, name: data.display_name}, error: null};
  });
}
