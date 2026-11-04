import {enqueueWrite} from '../collectionWriteQueue';
import {deleteBinderRow, listBinders, moveBinderRow} from './binderRepository';
import type {Binder} from './binderRules';

/**
 * The reader's binders, held for the visit.
 *
 * IN MEMORY ONLY, as Friends who have it holds its copies (`friendsCopies`): never written to the
 * browser's storage. Read once per visit for the reader who asked, the first time collection mode
 * wants them, once the account's copy has answered, and again whenever the tab is shown while
 * something wants them, so a binder made or deleted on another device shows. Another account
 * starts empty, and signing out forgets them.
 *
 * EACH READ WAITS IN THE COLLECTION'S WRITE QUEUE (`enqueueWrite`), as the sharing switch's does:
 * a binder's row hangs off the collection's, so a read must never see rows a queued Clear is
 * about to delete. A Clear empties the shelf with no read, since the rows went with the collection.
 */

/** The reader's binders as the page sees them: none until `ready`, and a Try again for a failed read. */
export interface BinderShelf {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  binders: readonly Binder[];
  retry: () => void;
}

/** What the module holds, for one reader: read by `snapshot`, turned into the page's view by `viewOf`. */
export interface Held {
  readerId: string;
  value: readonly Binder[] | 'loading' | 'failed';
}

let held: Held | null = null;
let newest = 0;
const listeners = new Set<() => void>();
/** The reader whose binders something on screen wants, and how many things do. */
let watching: {readerId: string; count: number} | null = null;

function publish(next: Held | null): void {
  held = next;
  for (const listener of listeners) listener();
}

/** `useSyncExternalStore`'s subscribe, for `useOwnBinders`. */
export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** `useSyncExternalStore`'s snapshot: what the module holds now. */
export const snapshot = (): Held | null => held;

/** Forgets every binder, and drops any answer still on its way: signing out. */
function forgetBinders(): void {
  newest++;
  if (held !== null) publish(null);
}

/** Reads `readerId`'s binders in the write queue; a failed re-read keeps the binders on show. */
async function load(readerId: string): Promise<void> {
  const mine = ++newest;
  startLoading({readerId, value: 'loading'});
  const {data, error} = await enqueueWrite(readerId, () => listBinders(readerId));
  if (mine !== newest) return;
  finishLoad({readerId, value: error === null && data !== null ? data : 'failed'});
}

/** A read shows loading, unless this reader's binders are already in view. */
function startLoading(loading: Held): void {
  if (held?.readerId === loading.readerId && held.value !== 'failed') return;
  publish(loading);
}

/** What the read came back with: its rows, or a failure in place of the loading it started. */
function finishLoad(done: Held): void {
  if (done.value !== 'failed') {
    publish(done);
    return;
  }
  if (held?.value === 'loading') publish(done);
}

/** A Clear took the reader's binders with their collection: none, with no read, and none still on its way. */
function emptyFor(readerId: string): void {
  newest++;
  if (held?.readerId !== readerId || held.value !== NONE) publish({readerId, value: NONE});
}

function loadIfShown(): void {
  if (watching && document.visibilityState === 'visible') void load(watching.readerId);
}

/** Counts one more thing wanting `readerId`'s binders; the first starts listening for the tab. */
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

/**
 * Starts `readerId`'s read unless the visit already has one or one under way, and reads again
 * when the tab is shown; returns the stop. A read that failed counts as none.
 */
function watch(readerId: string): () => void {
  if (held?.readerId !== readerId || held.value === 'failed') void load(readerId);
  addWatcher(readerId);
  return () => dropWatcher(readerId);
}

const NONE: readonly Binder[] = [];

/*
 * THE SHELF'S OWN CHANGES. Each goes through the write queue too, behind an import's upload or a
 * Clear's delete, and the shelf shows it once the server has answered, never before: a move or a
 * delete that fails leaves the shelf as it was.
 */

/** One of the reader's binders, by id: what a delete names. */
interface BinderRef {
  readerId: string;
  id: string;
}

/** A move of one of the reader's binders: a place earlier, or a place later. */
interface BinderMove extends BinderRef {
  earlier: boolean;
}

/** The reader's binders as the module holds them, or null when it holds none of theirs yet. */
function heldBinders({readerId}: {readerId: string}): readonly Binder[] | null {
  return held?.readerId === readerId && Array.isArray(held.value) ? held.value : null;
}

/** The shelf with the binder at `from` and its neighbour at `to` in each other's places. */
function swapped(binders: readonly Binder[], {from, to}: {from: number; to: number}): Binder[] {
  const next = [...binders];
  next[from] = {...binders[to], place: binders[from].place};
  next[to] = {...binders[from], place: binders[to].place};
  return next;
}

/**
 * Shows a move the server made, then reads the shelf again: `move_binder` swaps the binder with
 * its neighbour on the server, which another device's change may have made another binder than
 * this shelf's, and it answers only whether it moved. The swap shows at once; the read corrects it.
 */
function showMove(move: BinderMove): void {
  const binders = heldBinders(move) ?? [];
  const from = binders.findIndex((binder) => binder.id === move.id);
  const to = from + (move.earlier ? -1 : 1);
  if (from !== -1 && binders[to] !== undefined) publish({readerId: move.readerId, value: swapped(binders, {from, to})});
  void load(move.readerId);
}

/** What a move came to: it moved, the server found no neighbour that way, or it failed. */
export type MoveResult = 'moved' | 'unmoved' | 'failed';

/**
 * Moves one of the reader's binders a place earlier or later (`move_binder`). A move the server
 * finds no neighbour for, since another tab moved it first, reads the shelf again too.
 */
export async function moveBinder(move: BinderMove): Promise<MoveResult> {
  const {data, error} = await enqueueWrite(move.readerId, () => moveBinderRow(move.id, move.earlier));
  if (error !== null) return 'failed';
  if (data !== true) {
    void load(move.readerId);
    return 'unmoved';
  }
  showMove(move);
  return 'moved';
}

/** Deletes one of the reader's binders, and takes it off the shelf once the server has: whether it did. */
export async function deleteBinder({readerId, id}: BinderRef): Promise<boolean> {
  const {error} = await enqueueWrite(readerId, () => deleteBinderRow(id));
  if (error !== null) return false;
  const binders = heldBinders({readerId});
  if (binders !== null) publish({readerId, value: binders.filter((binder) => binder.id !== id)});
  return true;
}

/** Who asks for the binders, and whether the page wants them yet. */
export interface BinderReader {
  /** The signed-in reader's id, or null. */
  uid: string | null;
  hasCollection: boolean;
  /** The account's copy has not answered yet (`useCollection().syncing`). */
  syncing: boolean;
  /** Collection mode wants the binders: the first want starts the read. */
  wanted: boolean;
}

/** The page's view of the binders, from what the module holds. */
export function viewOf(now: Held | null, {uid, hasCollection, syncing, wanted}: BinderReader): BinderShelf {
  const retry = () => {
    if (uid !== null) void load(uid);
  };
  if (uid === null || syncing) return {status: 'idle', binders: NONE, retry};
  // No collection, no binders: a binder's row hangs off the collection's.
  if (!hasCollection) return {status: 'ready', binders: NONE, retry};
  // Another reader's, or none yet: the hook's own read starts once it has rendered.
  if (now?.readerId !== uid) return {status: wanted ? 'loading' : 'idle', binders: NONE, retry};
  return heldView(now.value, retry);
}

/** What the module's own answer says, once it is this reader's. */
function heldView(value: Held['value'], retry: () => void): BinderShelf {
  if (value === 'loading') return {status: 'loading', binders: NONE, retry};
  if (value === 'failed') return {status: 'failed', binders: NONE, retry};
  return {status: 'ready', binders: value, retry};
}

/**
 * What the page's reader asks of the module, run as an effect whenever it changes; returns its
 * stop. Signed out, it forgets every binder. Once the account's copy has answered, a reader with
 * no collection has none, with no read, and one whose collection mode `wanted` them has them read
 * once for the visit, and again whenever the tab is shown.
 */
export function follow({uid, hasCollection, syncing, wanted}: BinderReader): (() => void) | undefined {
  if (uid === null) {
    forgetBinders();
    return undefined;
  }
  if (syncing) return undefined;
  if (!hasCollection) {
    emptyFor(uid);
    return undefined;
  }
  return wanted ? watch(uid) : undefined;
}
