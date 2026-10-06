// Supabase access for public identity.
//
// TWO NAMES, different jobs:
//   * `handle`       — unique, lowercase, sluggable. The identity a /u/:handle URL and
//                      the uniqueness index are built on. Assigned once, never shown.
//   * `display_name` — what people read on a deck. Seeded from the handle in title case
//                      at claim time, then owned by the user. NOT unique.
//
// Same house rules as deckRepository: env-gated (loadSupabase() may resolve null), every call
// wrapped so a network failure degrades instead of throwing, owner scoping by RLS.

import {isSupabaseConfigured, loadSupabase, type InkweaveSupabase} from '../../shared/lib/supabase';
import {NOT_CONFIGURED, type RepoResult} from '../../shared/lib/repoResult';

type ProfilesClient = InkweaveSupabase;

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

/**
 * True when `name` is worth sending. Prevents a doomed request; never permits one.
 *
 * Measured in CODE POINTS, because `profiles_display_name_len` uses `char_length`, which
 * counts characters rather than UTF-16 code units. A non-BMP character such as an emoji
 * is one `char_length` but two units of `.length`, so measuring with `.length` scores a
 * 60-character emoji name as 120 and rejects it. That skew was safe (stricter than the
 * database, never looser) but it capped such names at half the documented limit.
 * `[...s]` iterates code points, which is exactly what `char_length` counts.
 */
export function isValidDisplayName(name: string): boolean {
  const points = [...name.trim()].length;
  return points >= DISPLAY_NAME_MIN && points <= DISPLAY_NAME_MAX;
}

/**
 * Cut a draft down to the column's limit, counting the same units as the CHECK.
 *
 * The input field used `maxLength`, which the platform counts in UTF-16 code units, so it
 * truncated an emoji name at 60 units rather than 60 characters. A controlled clamp is the
 * only way to hold the field to the limit the rule text promises.
 */
export function clampDisplayName(value: string): string {
  const points = [...value];
  return points.length <= DISPLAY_NAME_MAX ? value : points.slice(0, DISPLAY_NAME_MAX).join('');
}

async function run<T>(
  op: (client: ProfilesClient) => PromiseLike<{data: T | null; error: {message: string} | null}>,
): Promise<RepoResult<T>> {
  try {
    const supabase = await loadSupabase();
    if (!supabase) return {data: null, error: NOT_CONFIGURED};
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
  if (!isSupabaseConfigured()) return {data: null, error: NOT_CONFIGURED};
  const trimmed = displayName.trim();
  // Checked here, not just in the dialog. `profiles_display_name_len` caps the length
  // but sets no minimum, so the database would happily store "" or "a"; this is the
  // only place the documented 2-character floor is enforced against every caller.
  if (!isValidDisplayName(trimmed)) return {data: null, error: DISPLAY_NAME_RULE};
  try {
    const supabase = await loadSupabase();
    if (!supabase) return {data: null, error: NOT_CONFIGURED};
    const {data, error} = await supabase
      .from('profiles')
      .update({display_name: trimmed})
      .eq('id', userId)
      .select('display_name')
      .maybeSingle();

    if (error) {
      // No 23514 special case. The guard above mirrors `profiles_display_name_len`
      // exactly, so a request that gets this far cannot violate it; and a bare 23514
      // would not prove it was that constraint anyway, since `profiles_handle_format`
      // sits on the same row and Postgres evaluates every CHECK on an UPDATE. A check
      // violation here therefore means something unforeseen, which the generic message
      // reports honestly and the log makes debuggable.
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
