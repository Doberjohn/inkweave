// Supabase access for public identity.
//
// TWO NAMES, different jobs:
//   * `handle`       — unique, lowercase, sluggable. The identity a /u/:handle URL and
//                      the uniqueness index are built on. Assigned once, never shown.
//   * `display_name` — what people read on a deck. Seeded from the handle in title case
//                      at claim time, then owned by the user. NOT unique.
//
// Same house rules as deckRepository: env-gated (getSupabase() may be null), every call
// wrapped so a network failure degrades instead of throwing, owner scoping by RLS.

import {getSupabase} from '../../shared/lib/supabase';
import {NOT_CONFIGURED, type RepoResult} from '../../shared/lib/repoResult';

type ProfilesClient = NonNullable<ReturnType<typeof getSupabase>>;

/** Both names for one account. */
export interface PublicIdentity {
  handle: string;
  displayName: string;
}

/**
 * What the database enforces on a display name (`profiles_display_name_len`) plus the
 * one rule it cannot: a name made only of whitespace passes a length check and renders
 * as a blank author. Trim first, then measure.
 */
export const DISPLAY_NAME_MAX = 60;
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_RULE = `Between ${DISPLAY_NAME_MIN} and ${DISPLAY_NAME_MAX} characters.`;

/** True when `name` is worth sending. Prevents a doomed request; never permits one. */
export function isValidDisplayName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= DISPLAY_NAME_MIN && trimmed.length <= DISPLAY_NAME_MAX;
}

async function run<T>(
  op: (client: ProfilesClient) => PromiseLike<{data: T | null; error: {message: string} | null}>,
): Promise<RepoResult<T>> {
  const supabase = getSupabase();
  if (!supabase) return {data: null, error: NOT_CONFIGURED};
  try {
    const {data, error} = await op(supabase);
    if (error) {
      console.error('[profileRepository] query failed:', error.message);
      return {data: null, error: error.message};
    }
    return {data, error: null};
  } catch (e) {
    console.error('[profileRepository] network error:', e);
    return {data: null, error: 'Network error'};
  }
}

/**
 * Get the caller's public identity, generating one if they have none.
 *
 * IDEMPOTENT by construction — the RPC returns an existing handle untouched, and
 * backfills a missing display name without overwriting one the user has chosen. So this
 * is safe on every sign-in with no guard, and can never rename someone.
 *
 * The generate-and-retry loop lives in the database because the namespace is shared:
 * from the client each collision would be another round trip, and there is no way to
 * reserve a name without writing it.
 *
 * Returns a ROW SET, not a row — `claim_handle` is `returns table (...)`, so PostgREST
 * hands back an array. It always has exactly one element; anything else is a shape the
 * caller should not trust, hence the explicit check rather than a bare `data[0]`.
 */
export function claimIdentity(): Promise<RepoResult<PublicIdentity>> {
  return run(async (c) => {
    const {data, error} = await c.rpc('claim_handle');
    const row = Array.isArray(data) && data.length === 1 ? data[0] : null;
    if (!row?.handle || !row.display_name) return {data: null, error};
    return {data: {handle: row.handle, displayName: row.display_name}, error};
  });
}

/**
 * Display names for a set of user ids, as `id -> name`.
 *
 * Deliberately a second query rather than a PostgREST embed on the deck list.
 * `decks.owner_id` references `auth.users`, not `profiles`, so there is no foreign key
 * for PostgREST to traverse — and adding one would fail against any account predating
 * the profiles table.
 *
 * A missing id is simply absent from the map, which is a real state rather than an
 * error: an account with no profile row yet has no name to show.
 */
export function getAuthorNames(userIds: readonly string[]): Promise<RepoResult<Map<string, string>>> {
  const unique = [...new Set(userIds)];
  // No ids means no query. `.in('id', [])` is a valid request that always returns
  // nothing, so this is purely about not making it.
  if (unique.length === 0) return Promise.resolve({data: new Map(), error: null});

  return run(async (c) => {
    const {data, error} = await c.from('profiles').select('id, display_name').in('id', unique);
    if (!data) return {data: null, error};
    const byId = new Map<string, string>();
    for (const row of data) {
      if (row.display_name) byId.set(row.id, row.display_name);
    }
    return {data: byId, error};
  });
}

/**
 * Set the caller's display name. Needs no RPC: `profiles_update_own` already permits it
 * and the only constraint is a length CHECK.
 *
 * Note what is NOT here: an availability check. Display names are not unique, so unlike
 * a handle there is nothing to collide with and no 23505 to map.
 */
export async function updateDisplayName(userId: string, displayName: string): Promise<RepoResult<string>> {
  const supabase = getSupabase();
  if (!supabase) return {data: null, error: NOT_CONFIGURED};
  const trimmed = displayName.trim();
  try {
    const {data, error} = await supabase
      .from('profiles')
      .update({display_name: trimmed})
      .eq('id', userId)
      .select('display_name')
      .maybeSingle();

    if (error) {
      // 23514: the length CHECK. The only way a well-formed request fails.
      if (error.code === '23514') return {data: null, error: DISPLAY_NAME_RULE};
      console.error('[profileRepository] display name update failed:', error.message);
      return {data: null, error: 'Could not save that name. Try again.'};
    }
    // A null row means RLS matched nothing, i.e. the id is not the caller's. Reported
    // rather than swallowed: succeeding silently would show the new name on screen
    // while the database still held the old one.
    if (!data?.display_name) return {data: null, error: 'Could not save that name. Try again.'};
    return {data: data.display_name, error: null};
  } catch (e) {
    console.error('[profileRepository] network error:', e);
    return {data: null, error: 'Network error'};
  }
}
