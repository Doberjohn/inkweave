import {useEffect, useSyncExternalStore} from 'react';
import {useSession} from '../../shared/contexts/SessionContext';
import type {PublicIdentity} from '../profile';
import {
  UNNAMED,
  listFriendIdentities,
  listFriendships,
  listSharingFriends,
  type Friendship,
} from '../friends/friendRepository';
import type {CollectionEntries} from './collectionParser';
import {getSharedCollections} from './sharingRepository';

/**
 * The reader's friends and the copies of those who share their collection, for Friends who
 * have it.
 *
 * IN MEMORY ONLY, as a friend's binder is (`useFriendCollection`): never written to the
 * browser's storage. Read once per visit, the first time something needs it, for the reader
 * who asked: another account starts empty. Nothing that shows it is mounted once the reader
 * signs out, and signing in again loads a new page (the OAuth redirect), which reads afresh.
 * Read again whenever the tab is shown while something uses it, the newest answer winning, so
 * a friend who stopped sharing drops out then.
 */

export interface Friend {
  id: string;
  name: string;
  /** Null for a friend with no public name yet: there is no binder link to them. */
  handle: string | null;
}

/** A sharing friend and their copies, as saved: the reader places them (`useCollection().place`). */
export interface SharingFriend extends Friend {
  entries: CollectionEntries;
}

interface Loaded {
  sharing: SharingFriend[];
  notSharing: Friend[];
}

export type FriendsCopies =
  | {status: 'idle' | 'loading'}
  | ({status: 'ready'} & Loaded)
  | {status: 'failed'; retry: () => void};

/** What the module holds, for one reader. */
interface Held {
  readerId: string;
  value: Loaded | 'loading' | 'failed';
}

let held: Held | null = null;
let newest = 0;
const listeners = new Set<() => void>();
/** The reader whose copies something on screen uses, and how many things do. */
let watching: {readerId: string; count: number} | null = null;

function publish(next: Held | null): void {
  held = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = () => held;

/** Forgets every friend's copies, and drops any answer still on its way: for tests, which share the module between cases. */
export function forgetFriendsCopies(): void {
  newest++;
  publish(null);
}

const otherSide = (row: Friendship, readerId: string) =>
  row.requesterId === readerId ? row.addresseeId : row.requesterId;

function friendOf(id: string, names: ReadonlyMap<string, PublicIdentity>): Friend {
  const identity = names.get(id);
  return {id, name: identity?.displayName ?? UNNAMED, handle: identity?.handle ?? null};
}

/** Sharing friends' collections, read only while one shares: no friend shares, no read. */
function collectionsOf(friendIds: readonly string[], sharingIds: ReadonlySet<string>) {
  if (!friendIds.some((id) => sharingIds.has(id))) return Promise.resolve({data: new Map<string, CollectionEntries>(), error: null});
  return getSharedCollections();
}

/** The reader's friends and the sharing ones' copies, or null for a read that failed. */
async function readFriends(readerId: string): Promise<Loaded | null> {
  const [friendships, sharingIds] = await Promise.all([listFriendships(), listSharingFriends()]);
  if (friendships.data === null || sharingIds.data === null) return null;
  const ids = friendships.data.filter((row) => row.status === 'accepted').map((row) => otherSide(row, readerId));
  const [names, collections] = await Promise.all([listFriendIdentities(ids), collectionsOf(ids, sharingIds.data)]);
  if (collections.data === null) return null;
  // Names are a nicety, as in the Friends list: without them a friend shows as "Inkweave player".
  const friends = ids.map((id) => friendOf(id, names.data ?? new Map()));
  const copies = collections.data;
  return {
    sharing: friends.flatMap((friend) => {
      const entries = copies.get(friend.id);
      return entries ? [{...friend, entries}] : [];
    }),
    notSharing: friends.filter((friend) => !copies.has(friend.id)),
  };
}

/** Reads `readerId`'s friends; a failed re-read keeps the copies on show. */
async function load(readerId: string): Promise<void> {
  const mine = ++newest;
  if (held?.readerId !== readerId || held.value === 'failed') publish({readerId, value: 'loading'});
  const loaded = await readFriends(readerId);
  if (mine !== newest) return;
  if (loaded) publish({readerId, value: loaded});
  else if (held?.value === 'loading') publish({readerId, value: 'failed'});
}

function loadIfShown(): void {
  if (watching && document.visibilityState === 'visible') void load(watching.readerId);
}

/** Counts one more thing using `readerId`'s copies; the first starts listening for the tab. */
function addWatcher(readerId: string): void {
  if (watching?.readerId !== readerId) watching = {readerId, count: 0};
  watching.count++;
  if (watching.count === 1) document.addEventListener('visibilitychange', loadIfShown);
}

/** Counts one fewer; the last stops listening. */
function dropWatcher(readerId: string): void {
  if (watching?.readerId !== readerId) return;
  watching.count--;
  if (watching.count > 0) return;
  watching = null;
  document.removeEventListener('visibilitychange', loadIfShown);
}

/** Starts `readerId`'s read unless it already has one, and reads again when the tab is shown; returns the stop. */
function watch(readerId: string): () => void {
  if (held?.readerId !== readerId) void load(readerId);
  addWatcher(readerId);
  return () => dropWatcher(readerId);
}

const IDLE: FriendsCopies = {status: 'idle'};
const LOADING: FriendsCopies = {status: 'loading'};

/** What the hook hands back, from what the module holds. */
function viewOf(now: Held | null, readerId: string | null, need: boolean): FriendsCopies {
  if (readerId === null) return IDLE;
  // Another reader's, or none yet: the hook's own read starts once it has rendered.
  if (now?.readerId !== readerId) return need ? LOADING : IDLE;
  if (now.value === 'loading') return LOADING;
  if (now.value === 'failed') return {status: 'failed', retry: () => void load(readerId)};
  return {status: 'ready', ...now.value};
}

/**
 * The reader's friends and their copies. `enabled`: both flags on, signed in with a collection,
 * and the account's copy has answered. `need` starts the read, which then stays for the visit.
 */
export function useFriendsCopies(enabled: boolean, need: boolean): FriendsCopies {
  const {user} = useSession();
  const now = useSyncExternalStore(subscribe, snapshot, snapshot);
  const readerId = enabled ? (user?.id ?? null) : null;
  const watched = need ? readerId : null;
  useEffect(() => (watched === null ? undefined : watch(watched)), [watched]);
  return viewOf(now, readerId, need);
}
