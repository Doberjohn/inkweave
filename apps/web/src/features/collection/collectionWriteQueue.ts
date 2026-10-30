import {reportFailure} from '../../shared/lib/reportFailure';
import type {Uid} from './collectionStorage';

/**
 * EVERY server write goes through this one chain, so each is issued only after the
 * previous one settled (#739 defect 5). Without it a clear's delete could land
 * before an upsert started earlier, and that upsert would then RECREATE the row the
 * user just cleared. The `localEpoch` latch cannot catch that: it discards a stale
 * READ that is still in memory, while a stale write has already committed.
 *
 * Module scope rather than a provider ref, so the order also holds across a
 * remount: a provider that unmounts with an upsert in flight would otherwise leave
 * it free to land after the next provider's delete. Nothing is persisted here; a
 * reload starts an empty chain, and the markers carry anything left undone.
 *
 * One chain PER UID: two accounts write two different rows, so they never need
 * ordering against each other, and a write hung for one must not hold up another.
 * Deliberately no timeout: a timed-out write is not cancelled, so it could still
 * land after the writes released behind it, which is this defect again. A write
 * that hangs for good is healed by a reload, through the markers.
 *
 * ACROSS TABS TOO, through the Web Locks API: an in-memory chain is per tab, so a
 * clear in one tab could land before an upsert still in flight in another and be
 * undone by it. A named lock is granted in request order to every tab of this
 * origin, and released when the write settles, rejected or not. Where the API is
 * missing (jsdom, Safari before 15.4) the in-memory chain still orders this tab.
 * Two DEVICES racing the same way is out of reach of any client-side queue; that
 * needs the server to refuse a superseded write.
 *
 * The sharing switch queues here too (`useCollectionSharing`), reads included: its row
 * hangs off the collection's and goes with it, so a switch flipped just after an import
 * must wait for the upload that creates the collection's row, and a read must not see a
 * row that a queued clear is about to delete.
 */
const WRITE_LOCK_PREFIX = 'inkweave:collection:write';
const writeChains = new Map<Uid, Promise<unknown>>();

function logQueuedFailure(e: unknown): void {
  console.error('[collection] queued write threw:', e);
  reportFailure({area: 'collection', operation: 'queued write'}, e);
}

export function enqueueWrite<T>(uid: Uid, op: () => Promise<T>): Promise<T> {
  const locks: LockManager | undefined = globalThis.navigator?.locks;
  if (locks) {
    const locked = locks.request(`${WRITE_LOCK_PREFIX}:${uid}`, () => op());
    // Handled here so a `void` caller never leaks an unhandled rejection.
    locked.catch(logQueuedFailure);
    return locked;
  }
  const run = (writeChains.get(uid) ?? Promise.resolve()).then(op);
  // The chain itself must never reject, or one failed write stalls every later one.
  writeChains.set(uid, run.catch(logQueuedFailure));
  return run;
}
