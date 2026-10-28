import type {Page, Route} from '@playwright/test';
import {E2E_SUPABASE_ORIGIN} from '../fixtures/supabaseStub';

/** A player as `profiles` and `friend_codes` hold them. */
export interface Player {
  id: string;
  handle: string;
  displayName: string;
  /** Their friend code as stored: 8 characters, no hyphen. */
  code: string;
}

/** A `friendships` row as PostgREST hands it back. */
export interface FriendshipRow {
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
  accepted_at: string | null;
}

/**
 * The friends side of the placeholder project, kept in the test (#852): the signed-in
 * player, everyone else, and the friendship rows. `serveFriends` answers from it and changes
 * it as the database would, so a spec acts on the page and reads the page again.
 */
export interface FriendsWorld {
  me: Player;
  others: Player[];
  rows: FriendshipRow[];
  /** Who has turned on sharing with their friends (#1045), by id; the player's own switch is `mySharing`. */
  sharing?: string[];
  /** Each other player's collection, by id, as `collections` holds it. */
  collections?: Record<string, Record<string, {normal: number; foil: number}>>;
  /** The player's own switch: absent is no row, as for a player who never set it. */
  mySharing?: boolean;
  /** Every switch the player's page wrote, oldest first. */
  sharingWrites?: boolean[];
}

type Pair = Pick<FriendshipRow, 'requester_id' | 'addressee_id'>;

const rest = (path: string) => (url: URL) => url.origin === E2E_SUPABASE_ORIGIN && url.pathname === `/rest/v1/${path}`;

const answer = (route: Route, body: unknown) =>
  route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body)});

const rowOf = (world: FriendsWorld, pair: Pair) =>
  world.rows.find((row) => row.requester_id === pair.requester_id && row.addressee_id === pair.addressee_id);

/** Makes a waiting row a friendship, as `accept_friend_request` does. */
function befriend(row: FriendshipRow): void {
  if (row.status === 'accepted') return;
  row.status = 'accepted';
  row.accepted_at = new Date().toISOString();
}

/** `send_friend_request`'s one-row answer: the friend and the pair's status, or a refusal. */
type SendAnswer = {friend_id: string | null; status: string};

/** The most requests a player can have waiting; the database refuses the next as `too_many`. */
const MAX_WAITING = 20;

const waitingFrom = (world: FriendsWorld) =>
  world.rows.filter((row) => row.requester_id === world.me.id && row.status === 'pending').length;

/** The answer when the pair already has a row: theirs accepted (entering their code is a yes), or what is there. */
function answerExisting(world: FriendsWorld, them: Player): SendAnswer | null {
  const pair =
    rowOf(world, {requester_id: them.id, addressee_id: world.me.id}) ??
    rowOf(world, {requester_id: world.me.id, addressee_id: them.id});
  if (!pair) return null;
  if (pair.requester_id === them.id) befriend(pair);
  return {friend_id: them.id, status: pair.status};
}

/**
 * `send_friend_request`, in the migration's order: your own code; a pair that already has a
 * row; the cap, which answers before an unused code does, so a full sender can't probe which
 * codes exist; an unknown code; then a new waiting request.
 */
function send(world: FriendsWorld, request: {friend_code: string}): SendAnswer {
  const {me} = world;
  if (request.friend_code === me.code) return {friend_id: null, status: 'own'};
  const them = world.others.find((player) => player.code === request.friend_code);
  const existing = them && answerExisting(world, them);
  if (existing) return existing;
  if (waitingFrom(world) >= MAX_WAITING) return {friend_id: null, status: 'too_many'};
  if (!them) return {friend_id: null, status: 'unknown'};
  const now = new Date().toISOString();
  world.rows.push({requester_id: me.id, addressee_id: them.id, status: 'pending', created_at: now, accepted_at: null});
  return {friend_id: them.id, status: 'pending'};
}

/** `accept_friend_request`: true when a request from `requester` was waiting. */
function accept(world: FriendsWorld, request: {requester: string}): boolean {
  const row = rowOf(world, {requester_id: request.requester, addressee_id: world.me.id});
  if (row?.status !== 'pending') return false;
  befriend(row);
  return true;
}

/** The ids in a PostgREST `in.(a,b)` filter. */
const idsIn = (filter: string | null) => filter?.replace(/^in\.\(|\)$/g, '').split(',') ?? [];

/** A GET of the caller's rows, or the delete of one: `requester_id=eq.X&addressee_id=eq.Y`. */
async function friendships(route: Route, world: FriendsWorld): Promise<void> {
  if (route.request().method() !== 'DELETE') return answer(route, world.rows);
  const params = new URL(route.request().url()).searchParams;
  const pair = {
    requester_id: params.get('requester_id')?.replace(/^eq\./, '') ?? '',
    addressee_id: params.get('addressee_id')?.replace(/^eq\./, '') ?? '',
  };
  world.rows = world.rows.filter((row) => row !== rowOf(world, pair));
  await route.fulfill({status: 204, body: ''});
}

/** Whether `id` is the player's accepted friend, either way round. */
const isFriend = (world: FriendsWorld, id: string) =>
  world.rows.some(
    (row) =>
      row.status === 'accepted' &&
      ((row.requester_id === world.me.id && row.addressee_id === id) ||
        (row.addressee_id === world.me.id && row.requester_id === id)),
  );

/** `shared_friends()`: the player's accepted friends whose switch is on. */
const sharedFriends = (world: FriendsWorld) => (world.sharing ?? []).filter((id) => isFriend(world, id));

/** `friend_collections(only_friend)`: those friends' collections, or the one asked for, and nothing else of the row. */
function friendCollections(world: FriendsWorld, request: {only_friend?: string | null}) {
  return sharedFriends(world)
    .filter((id) => !request.only_friend || id === request.only_friend)
    .flatMap((id) => {
      const entries = world.collections?.[id];
      return entries ? [{owner_id: id, entries, schema_version: 1}] : [];
    });
}

/** The player's switch: its row, or none, and the upsert that writes it. */
async function collectionSharing(route: Route, world: FriendsWorld): Promise<void> {
  if (route.request().method() !== 'POST') {
    return answer(route, world.mySharing === undefined ? [] : [{friends: world.mySharing}]);
  }
  const sent = route.request().postDataJSON() as {owner_id: string; friends: boolean};
  world.mySharing = sent.friends;
  (world.sharingWrites ??= []).push(sent.friends);
  await route.fulfill({status: 201, body: ''});
}

/** A `profiles` read: by ids for the Friends list's names, or by handle for a friend's binder. */
function profiles(route: Route, world: FriendsWorld) {
  const everyone = [world.me, ...world.others];
  const params = new URL(route.request().url()).searchParams;
  const handle = params.get('handle')?.replace(/^eq\./, '');
  const ids = idsIn(params.get('id'));
  const rows = everyone.filter((player) => (handle ? player.handle === handle : ids.includes(player.id)));
  return answer(route, rows.map((player) => ({id: player.id, handle: player.handle, display_name: player.displayName})));
}

/**
 * Answers every friends call the Friends section and a friend's binder make, from `world`,
 * which it changes as it goes. Register it after `signInAsCollector`, so a cleared collection
 * takes its switch with it (`on delete cascade`) before the collector's own route answers.
 */
export async function serveFriends(page: Page, world: FriendsWorld): Promise<void> {
  await page.route(rest('rpc/claim_handle'), (route) =>
    answer(route, [{handle: world.me.handle, display_name: world.me.displayName}]),
  );
  await page.route(rest('rpc/claim_friend_code'), (route) => answer(route, world.me.code));
  await page.route(rest('profiles'), (route) => profiles(route, world));
  await page.route(rest('friendships'), (route) => friendships(route, world));
  await page.route(rest('rpc/send_friend_request'), (route) => answer(route, [send(world, route.request().postDataJSON())]));
  await page.route(rest('rpc/accept_friend_request'), (route) => answer(route, accept(world, route.request().postDataJSON())));
  await page.route(rest('rpc/shared_friends'), (route) => answer(route, sharedFriends(world)));
  await page.route(rest('rpc/friend_collections'), (route) =>
    answer(route, friendCollections(world, route.request().postDataJSON() ?? {})),
  );
  await page.route(rest('collection_sharing'), (route) => collectionSharing(route, world));
  await page.route(rest('collections'), async (route) => {
    if (route.request().method() === 'DELETE') world.mySharing = undefined;
    await route.fallback();
  });
}
