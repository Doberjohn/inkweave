import {useEffect, useRef, useState} from 'react';
import {trackEvent} from '../../shared/lib/analytics';
import type {PublicIdentity} from '../profile';
import {SHOW_COLLECTION} from '../collection/flag';
import {
  SEND_FAILED,
  UNNAMED,
  acceptFriendRequest,
  claimFriendCode,
  listFriendIdentities,
  listFriendships,
  listSharingFriends,
  removeFriendship,
  sendFriendRequest,
  type Friendship,
  type FriendshipPair,
  type SentRequest,
} from './friendRepository';

const ACTION_FAILED = "That didn't go through. Try again.";
const ACCEPT_GONE = 'That request is no longer there.';

/** One person in the section's lists. */
export interface FriendRow {
  /** The other player's account id. */
  id: string;
  name: string;
  handle: string | null;
  /** When you became friends, or null while a request waits. */
  since: string | null;
  /** The row's two ids, which name it for a decline, a cancel or a remove. */
  pair: FriendshipPair;
}

export type FriendsStatus = 'loading' | 'ready' | 'failed';

/** What a send turned into, in the words the section shows. */
export interface SendOutcome {
  ok: boolean;
  message: string;
}

interface Snapshot {
  code: string | null;
  received: FriendRow[];
  sent: FriendRow[];
  friends: FriendRow[];
  /**
   * The friends who share their collection with the player, by id. Undefined
   * with collections off, or when that read failed: the list then says nothing either way.
   */
  sharing?: ReadonlySet<string>;
}

interface View {
  status: FriendsStatus;
  snapshot: Snapshot;
}

const EMPTY: Snapshot = {code: null, received: [], sent: [], friends: []};

const otherSide = (row: Friendship, userId: string) =>
  row.requesterId === userId ? row.addresseeId : row.requesterId;

function toRow(row: Friendship, userId: string, names: Map<string, PublicIdentity>): FriendRow {
  const id = otherSide(row, userId);
  const identity = names.get(id);
  return {
    id,
    name: identity?.displayName ?? UNNAMED,
    handle: identity?.handle ?? null,
    since: row.acceptedAt,
    pair: {requesterId: row.requesterId, addresseeId: row.addresseeId},
  };
}

const newestFirst = (key: 'createdAt' | 'acceptedAt') => (a: Friendship, b: Friendship) =>
  (b[key] ?? '').localeCompare(a[key] ?? '');

/** Received and sent are the waiting rows on each side; friends are the accepted ones. */
function splitFriendships(rows: Friendship[], userId: string, names: Map<string, PublicIdentity>) {
  const named = (row: Friendship) => toRow(row, userId, names);
  const pending = rows.filter((row) => row.status === 'pending').sort(newestFirst('createdAt'));
  return {
    received: pending.filter((row) => row.addresseeId === userId).map(named),
    sent: pending.filter((row) => row.requesterId === userId).map(named),
    friends: rows.filter((row) => row.status === 'accepted').sort(newestFirst('acceptedAt')).map(named),
  };
}

/** Who shares with the player, read only with collections on; a failed read is no answer. */
async function fetchSharing(): Promise<ReadonlySet<string> | undefined> {
  if (!SHOW_COLLECTION) return undefined;
  return (await listSharingFriends()).data ?? undefined;
}

/**
 * The code, the rows and who shares together, then the names of everyone on the other side
 * of the rows. Who shares rides in the same snapshot, so the reload when the tab is shown
 * refreshes it too.
 */
async function fetchSnapshot(userId: string): Promise<Snapshot | null> {
  const [code, rows, sharing] = await Promise.all([claimFriendCode(), listFriendships(), fetchSharing()]);
  if (!code.data || !rows.data) return null;
  // Names are a nicety: without them every row still shows, as "Inkweave player".
  const names = await listFriendIdentities(rows.data.map((row) => otherSide(row, userId)));
  return {code: code.data, ...splitFriendships(rows.data, userId, names.data ?? new Map()), sharing};
}

/** A load's result applied to the view: a failed reload keeps the lists already shown. */
function settle(view: View, next: Snapshot | null): View {
  if (next) return {status: 'ready', snapshot: next};
  return view.status === 'ready' ? view : {status: 'failed', snapshot: EMPTY};
}

/** Loads, and applies the result only if no newer load started meanwhile. */
async function loadLatest(
  load: () => Promise<Snapshot | null>,
  ticket: {current: number},
  apply: (next: Snapshot | null) => void,
): Promise<Snapshot | null> {
  const mine = ++ticket.current;
  const next = await load();
  if (mine === ticket.current) apply(next);
  return next;
}

/** The name of the player a send reached, from the lists reloaded after it. */
function nameIn(snapshot: Snapshot | null, sent: SentRequest): string {
  const rows = snapshot ? [...snapshot.received, ...snapshot.sent, ...snapshot.friends] : [];
  return rows.find((row) => row.id === sent.friendId)?.name ?? UNNAMED;
}

/**
 * The Friends section's data and actions for the signed-in player (#852).
 *
 * Every action calls the database and then reloads, with no optimistic rows: the database
 * decides the outcome (a send can turn into an accept). One action runs at a time, and
 * `busy` is true while it does, so the section can switch its buttons off.
 */
export function useFriends(userId: string) {
  const [view, setView] = useState<View>({status: 'loading', snapshot: EMPTY});
  const [busy, setBusy] = useState(false);
  const ticket = useRef(0);

  const reload = () =>
    loadLatest(() => fetchSnapshot(userId), ticket, (next) => setView((current) => settle(current, next)));

  useEffect(() => {
    const load = () =>
      loadLatest(() => fetchSnapshot(userId), ticket, (next) => setView((current) => settle(current, next)));
    void load();
    // A request sent while this page sat in a background tab shows when the player comes
    // back to it, as CollectionContext's readIfShown does for the collection. Even mid-action:
    // the newest load wins (`loadLatest`), and skipping one left a failed action's lists stale.
    const loadIfShown = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', loadIfShown);
    return () => document.removeEventListener('visibilitychange', loadIfShown);
  }, [userId]);

  async function runAction<T>(work: () => Promise<T>): Promise<T> {
    setBusy(true);
    try {
      return await work();
    } finally {
      setBusy(false);
    }
  }

  const retry = () => {
    setView({status: 'loading', snapshot: EMPTY});
    void reload();
  };

  const send = (code: string) =>
    runAction(async (): Promise<SendOutcome> => {
      const result = await sendFriendRequest(code);
      // The database's answer, never the code: pending, accepted, a refusal, or failed.
      trackEvent('friend_request_sent', {result: result.answer});
      if (!result.data) return {ok: false, message: result.error ?? SEND_FAILED};
      const name = nameIn(await reload(), result.data);
      return {
        ok: true,
        message: result.data.status === 'accepted' ? `You and ${name} are now friends.` : `Request sent to ${name}.`,
      };
    });

  const accept = (row: FriendRow) =>
    runAction(async () => {
      const result = await acceptFriendRequest(row.id);
      if (result.error) return ACTION_FAILED;
      await reload();
      return result.data ? null : ACCEPT_GONE;
    });

  const remove = (row: FriendRow) =>
    runAction(async () => {
      const result = await removeFriendship(row.pair);
      if (result.error) return ACTION_FAILED;
      await reload();
      return null;
    });

  return {status: view.status, ...view.snapshot, busy, retry, send, accept, remove};
}
