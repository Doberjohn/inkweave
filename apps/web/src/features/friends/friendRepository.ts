// Supabase access for friends (#852): the caller's friend code, their friendships, and
// the public names of the other side of each one.
//
// Same house rules as profileRepository: env-gated (loadSupabase() may resolve null), and
// every call wrapped so a network failure degrades instead of throwing. RLS scopes every
// read and delete to rows the caller is in; the writes go through SECURITY DEFINER RPCs.
//
// The names live here, not in profileRepository: that module loads on every page
// (ProfileProvider mounts in AppLayout), and this one only with the Friends section.

import type {PublicIdentity} from '../profile';
import {loadSupabase, type InkweaveSupabase} from '../../shared/lib/supabase';
import {NOT_CONFIGURED, type RepoResult} from '../../shared/lib/repoResult';
import {reportFailure, type FailureSite} from '../../shared/lib/reportFailure';

export type FriendStatus = 'pending' | 'accepted';

export interface Friendship {
  requesterId: string;
  addresseeId: string;
  status: FriendStatus;
  createdAt: string;
  acceptedAt: string | null;
}

/** The two ids that name a friendship row. */
export type FriendshipPair = Pick<Friendship, 'requesterId' | 'addresseeId'>;

/** What a sent code turned into: a waiting request, or friends at once. */
export interface SentRequest {
  friendId: string;
  status: FriendStatus;
}

/** What a friend's name shows when they have no public name yet. */
export const UNNAMED = 'Inkweave player';

/** A friend as every list names them, the Friends list and Friends who have it alike. */
export interface NamedFriend {
  /** Their account id. */
  id: string;
  name: string;
  /** Null for a friend with no public name yet: there is no binder link to them. */
  handle: string | null;
}

/** The other player in a friendship row, seen from `userId`'s side. */
export const otherSide = (row: FriendshipPair, userId: string) =>
  row.requesterId === userId ? row.addresseeId : row.requesterId;

/** A friend by their public name (`listFriendIdentities`), or `UNNAMED` with no handle when they have none. */
export function namedFriend(id: string, names: ReadonlyMap<string, PublicIdentity>): NamedFriend {
  const identity = names.get(id);
  return {id, name: identity?.displayName ?? UNNAMED, handle: identity?.handle ?? null};
}

/** What the section shows when a send fails for a reason other than a refusal. */
export const SEND_FAILED = 'Could not send the request. Try again.';

/** A refusal `send_friend_request` answers with instead of a friend (#852, #860). */
type Refusal = 'invalid' | 'unknown' | 'own' | 'too_many' | 'slow_down';

/** What a send came to, as the friends events name it: the pair's status, a refusal, or failed. */
export type SendAnswer = FriendStatus | Refusal | 'failed';

/** A send's result, with the database's answer beside the words the section shows. */
export interface SentResult extends RepoResult<SentRequest> {
  answer: SendAnswer;
}

/**
 * The words for each refusal `send_friend_request` answers with. Refusals are answers,
 * not errors (#852): raised, they would come back as HTTP errors and reach Sentry as
 * unhandled, once per mistyped code.
 */
const REFUSALS = new Map<Refusal, string>([
  ['invalid', 'A friend code is 8 letters and numbers, like ABCD-2345.'],
  ['unknown', 'No one has that friend code. Check it with your friend.'],
  ['own', "That's your own friend code."],
  ['too_many', 'You have 20 requests waiting. Cancel one to send another.'],
  ['slow_down', "You've entered a lot of codes. Try again in an hour."],
]);

/** A row of `send_friend_request`'s answer, before anything about it is checked. */
type SendAnswerRow = {friend_id?: unknown; status?: unknown};

function isFriendStatus(status: unknown): status is FriendStatus {
  return status === 'pending' || status === 'accepted';
}

function isRefusal(status: unknown): status is Refusal {
  return REFUSALS.has(status as Refusal);
}

/**
 * Runs one call; `failure` replaces a query error's own text when the UI shows it. Both
 * failures also go to Sentry, named by `site`. A site rather than its operation's name keeps
 * this module under CodeScene's limit on string arguments.
 */
async function run<T>(
  site: FailureSite,
  op: (client: InkweaveSupabase) => PromiseLike<{data: T | null; error: {message: string} | null}>,
  failure?: string,
): Promise<RepoResult<T>> {
  try {
    const supabase = await loadSupabase();
    if (!supabase) return {data: null, error: NOT_CONFIGURED};
    const {data, error} = await op(supabase);
    if (error) {
      console.error('[friendRepository] query failed:', error.message);
      reportFailure(site, error);
      return {data: null, error: failure ?? error.message};
    }
    return {data, error: null};
  } catch (e) {
    console.error('[friendRepository] network error:', e);
    reportFailure(site, e);
    return {data: null, error: 'Network error'};
  }
}

/** The caller's code, which the database makes the first time it is asked for. */
export function claimFriendCode(): Promise<RepoResult<string>> {
  return run({area: 'friends', operation: 'claim code'}, async (c) => {
    const {data, error} = await c.rpc('claim_friend_code');
    return {data: typeof data === 'string' ? data : null, error};
  });
}

/** A send's failures report under one name, the call's and its answer's alike. */
const SEND_REQUEST: FailureSite = {area: 'friends', operation: 'send request'};

/** The single row `send_friend_request` answers with, or null for an answer of any other shape. */
function onlyRow(rows: unknown): SendAnswerRow | null {
  return Array.isArray(rows) && rows.length === 1 ? (rows[0] as SendAnswerRow) : null;
}

/**
 * The one-row answer `send_friend_request` returns: the friend and the pair's status, or
 * a refusal with no friend, which comes back as its words with nothing logged.
 */
function readSendAnswer(rows: unknown): SentResult {
  const row = onlyRow(rows);
  if (typeof row?.friend_id === 'string' && isFriendStatus(row.status)) {
    return {data: {friendId: row.friend_id, status: row.status}, error: null, answer: row.status};
  }
  const status = row?.status;
  if (isRefusal(status)) return {data: null, error: REFUSALS.get(status) ?? SEND_FAILED, answer: status};
  console.error('[friendRepository] unexpected answer from send_friend_request:', rows);
  // Never the rows themselves: they carry account ids.
  reportFailure(SEND_REQUEST, new Error('unexpected answer from send_friend_request'));
  return {data: null, error: SEND_FAILED, answer: 'failed'};
}

/** Sends a request to whoever holds `code`, or accepts theirs if they asked first. */
export async function sendFriendRequest(code: string): Promise<SentResult> {
  const {data, error} = await run(SEND_REQUEST, (c) => c.rpc('send_friend_request', {friend_code: code}), SEND_FAILED);
  if (error) return {data: null, error, answer: 'failed'};
  return readSendAnswer(data);
}

/** Accepts a request sent to the caller. False when there was none to accept. */
export function acceptFriendRequest(requesterId: string): Promise<RepoResult<boolean>> {
  return run({area: 'friends', operation: 'accept request'}, (c) =>
    c.rpc('accept_friend_request', {requester: requesterId}),
  );
}

/** Every friendship row the caller is in, waiting or accepted, either side. */
export function listFriendships(): Promise<RepoResult<Friendship[]>> {
  return run({area: 'friends', operation: 'list'}, async (c) => {
    const {data, error} = await c
      .from('friendships')
      .select('requester_id, addressee_id, status, created_at, accepted_at');
    const rows = data?.flatMap((row) =>
      isFriendStatus(row.status)
        ? [
            {
              requesterId: row.requester_id,
              addresseeId: row.addressee_id,
              status: row.status,
              createdAt: row.created_at,
              acceptedAt: row.accepted_at,
            },
          ]
        : [],
    );
    return {data: rows ?? null, error};
  });
}

/**
 * Removes the pair's row: declining, cancelling and removing a friend are all this. A
 * delete that matched nothing (the other side removed it first) is still done.
 */
export function removeFriendship({requesterId, addresseeId}: FriendshipPair): Promise<RepoResult<null>> {
  return run({area: 'friends', operation: 'remove'}, (c) =>
    c.from('friendships').delete().eq('requester_id', requesterId).eq('addressee_id', addresseeId),
  );
}

/**
 * Public names for the other side of each friendship, as `id -> {handle, displayName}`.
 * `profiles` is world-readable once an account has a handle, so this reveals nothing new.
 * A missing id is simply absent: an account with no public name yet has nothing to show.
 */
export function listFriendIdentities(ids: readonly string[]): Promise<RepoResult<Map<string, PublicIdentity>>> {
  const unique = [...new Set(ids)];
  // No ids means no query, as in getAuthorNames.
  if (unique.length === 0) return Promise.resolve({data: new Map(), error: null});

  return run({area: 'friends', operation: 'read names'}, async (c) => {
    const {data, error} = await c.from('profiles').select('id, handle, display_name').in('id', unique);
    if (!data) return {data: null, error};
    const byId = new Map<string, PublicIdentity>();
    for (const row of data) {
      if (row.handle && row.display_name) byId.set(row.id, {handle: row.handle, displayName: row.display_name});
    }
    return {data: byId, error};
  });
}

/**
 * The friends who share their collection with the caller, by id: accepted friends
 * whose switch is on, as `shared_friends()` checks on every call.
 */
export function listSharingFriends(): Promise<RepoResult<Set<string>>> {
  return run({area: 'friends', operation: 'read sharing'}, async (c) => {
    const {data, error} = await c.rpc('shared_friends');
    const ids = Array.isArray(data) ? data.filter((id): id is string => typeof id === 'string') : null;
    return {data: ids ? new Set(ids) : null, error};
  });
}
