import {useEffect, useEffectEvent, useState} from 'react';
import {trackEvent} from '../../shared/lib/analytics';
import type {BinderEntry} from '../friends/friendBinderPath';
import type {CollectionEntries} from './collectionParser';
import {getFriendCollection, getPlayerByHandle, type Player} from './sharingRepository';

/**
 * A friend's binder's data: who `?friend=<handle>` names, and their collection if
 * they share it with the reader.
 *
 * IN MEMORY ONLY. Friends' collections are never written to the browser's storage, so none
 * outlives the friendship on a shared device. The module's map keeps each answer for the
 * visit, keyed by the reader too, so a trip to a card page and back opens the binder at once,
 * while it reads again in the background: a friend who stopped sharing drops out at that read.
 *
 * READ AGAIN WHEN SHOWN, as `useFriends` reads the friendships: a binder left open in a tab
 * reads again when the tab comes back, and an answer with no row turns it into "doesn't share".
 */

/** What a read settled on; a failed read is never kept. */
type Settled =
  | {kind: 'shown'; friend: Player; entries: CollectionEntries}
  | {kind: 'not-sharing'; name: string | null}
  | {kind: 'own'};

export type FriendBinder =
  | {status: 'loading'}
  /** The friend's copies as saved: the reader places them (`useCollection().place`). */
  | {status: 'shown'; friend: Player; entries: CollectionEntries}
  /** Not a friend, a request still waiting, the switch off, or no such handle. */
  | {status: 'not-sharing'; handle: string; name: string | null}
  /** The handle is the reader's own: the page drops `friend`. */
  | {status: 'own'}
  | {status: 'failed'; retry: () => void};

const settledByKey = new Map<string, Settled>();

/** Forgets every friend's collection: for tests, which share the module between cases. */
export function forgetFriendCollections(): void {
  settledByKey.clear();
}

/** Whose binder, for whom. */
interface Wanted {
  readerId: string;
  handle: string;
}

async function readFriend({handle, readerId}: Wanted): Promise<Settled | null> {
  const player = await getPlayerByHandle(handle);
  if (player.error !== null) return null;
  if (player.data === null) return {kind: 'not-sharing', name: null};
  if (player.data.id === readerId) return {kind: 'own'};
  const collection = await getFriendCollection(player.data.id);
  if (collection.error !== null) return null;
  if (collection.data === null) return {kind: 'not-sharing', name: player.data.name};
  return {kind: 'shown', friend: player.data, entries: collection.data};
}

const RESULTS = {shown: 'shown', 'not-sharing': 'not_sharing'} as const;

/** Where a friend's binder was reached from: `friend_binder_opened`'s `from`. */
export type BinderFrom = BinderEntry['binderFrom'] | 'link';

/** A key's answer as the hook holds it: settled, still loading, or failed. */
type Held = Settled | 'loading' | 'failed';
type HeldFor = {key: string; value: Held};

/**
 * The binder of the friend `handle` names, for `readerId`, or null with no friend named or
 * no reader signed in. Reads once per handle, then again whenever the tab is shown. `from` is
 * where the binder was reached from, for `friend_binder_opened`.
 */
export function useFriendCollection(
  handle: string | null,
  readerId: string | null,
  from: BinderFrom = 'link',
): FriendBinder | null {
  const key = keyOf(handle, readerId);
  const [held, setHeld] = useState<HeldFor | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Where the binder was reached from, as its read starts: a new `from` is no reason to read
  // again, and a replace of the address later, which drops the router's state, changes nothing.
  const fromNow = useEffectEvent(() => from);

  useEffect(() => {
    if (key === null) return;
    // A failed re-read keeps the binder on show; only a first read shows the failure.
    return watchFriend(key, fromNow(), (settled) =>
      setHeld((now) => (settled ? {key, value: settled} : keepShown(now, key))),
    );
  }, [key, attempt]);

  if (key === null) return null;
  const value = held?.key === key ? held.value : (settledByKey.get(key) ?? 'loading');
  if (value !== 'failed') return toBinder(value, partsOf(key));
  return {
    status: 'failed',
    retry: () => {
      setHeld({key, value: 'loading'});
      setAttempt((n) => n + 1);
    },
  };
}

/** One key per reader and handle: handles hold no newline, so the key splits back. */
function keyOf(handle: string | null, readerId: string | null): string | null {
  if (handle === null || readerId === null) return null;
  return `${readerId}\n${handle}`;
}

function partsOf(key: string): Wanted {
  const cut = key.indexOf('\n');
  return {readerId: key.slice(0, cut), handle: key.slice(cut + 1)};
}

function toBinder(value: Settled | 'loading', {handle}: Wanted): FriendBinder {
  if (value === 'loading') return {status: 'loading'};
  if (value.kind === 'not-sharing') return {status: 'not-sharing', handle, name: value.name};
  return value.kind === 'own' ? {status: 'own'} : {status: 'shown', friend: value.friend, entries: value.entries};
}

/**
 * Reads `key`'s friend now and again whenever the tab is shown, handing on each answer (null
 * for a failed read) while it is the newest; returns the stop.
 */
function watchFriend(key: string, from: BinderFrom, onAnswer: (settled: Settled | null) => void): () => void {
  const wanted = partsOf(key);
  let newest = 0;
  let live = true;
  // The first answer sends the event; a re-read when shown doesn't.
  let tracked = false;
  const load = async () => {
    const mine = ++newest;
    const settled = await readFriend(wanted);
    if (!live || mine !== newest) return;
    if (!tracked) tracked = trackOpened(settled, from);
    if (settled) settledByKey.set(key, settled);
    onAnswer(settled);
  };
  void load();
  const loadIfShown = () => {
    if (document.visibilityState === 'visible') void load();
  };
  document.addEventListener('visibilitychange', loadIfShown);
  return () => {
    live = false;
    document.removeEventListener('visibilitychange', loadIfShown);
  };
}

/** Sends `friend_binder_opened`, unless the handle was the reader's own; whether it did. */
function trackOpened(settled: Settled | null, from: BinderFrom): boolean {
  if (settled?.kind === 'own') return false;
  trackEvent('friend_binder_opened', {result: settled ? RESULTS[settled.kind] : 'failed', from});
  return true;
}

/** After a failed read: what was settled for `key` stays, else the failure shows. */
function keepShown(now: HeldFor | null, key: string): HeldFor {
  if (now?.key === key && isSettled(now.value)) return now;
  const cached = settledByKey.get(key);
  return {key, value: cached ?? 'failed'};
}

function isSettled(value: Held): value is Settled {
  return typeof value === 'object';
}
