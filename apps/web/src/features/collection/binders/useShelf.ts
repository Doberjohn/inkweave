import {useEffect, useState} from 'react';
import type {BinderShelf} from './binderShelf';
import {shelfCount} from './shelfWords';

/** What the shelf needs of the page: whether it shows, and what decides whether it stays. */
export interface ShelfAsk {
  /** Collection mode honours `?binder=shelf`, in the reader's own binders. */
  on: boolean;
  /** The account's copy has not answered yet (`useCollection().syncing`). */
  syncing: boolean;
  /** The reader's collection holds a copy of a card (`useCollection().holdsCopies`). */
  holdsCopies: boolean;
  /** The reader's binders (`useOwnBinders`), null with binders off. */
  shelf: BinderShelf | null;
}

/** The shelf on show: how many binders it holds, My collection included, or null while they load. */
export interface ShelfSlot {
  count: number | null;
}

/** Whether the binders have answered: read, or failed, which counts as none. */
const answered = (shelf: BinderShelf | null): shelf is BinderShelf =>
  shelf?.status === 'ready' || shelf?.status === 'failed';

type Verdict = 'waiting' | 'kept' | 'empty';

/**
 * What 4B makes of the shelf so far: still waiting on the account's copy or the binders, kept,
 * or holding nothing to choose between (no copy and no binder, a failed read counting as none).
 */
function verdictOf({on, syncing, holdsCopies, shelf}: ShelfAsk): Verdict {
  if (!on || syncing) return 'waiting';
  if (holdsCopies) return 'kept';
  if (!answered(shelf)) return 'waiting';
  // A failed read holds no binders (`viewOf`), so it counts as none.
  return shelf.binders.length === 0 ? 'empty' : 'kept';
}

/**
 * The shelf's slot while `?binder=shelf` shows, else null (#1074, 4B). It waits for the account's
 * copy and the binders, showing as it loads; then a player with no copy and no binder gets
 * today's empty start in its place (`toBinder`, a replace to My collection), whatever the press
 * that opened it knew. A binder and no copy keeps the shelf.
 *
 * 4B is the shelf's arrival rule: once a visit to the shelf has kept it, it stays, so deleting
 * the last binder leaves the player where they were. Set while rendering, as the React Compiler
 * expects; leaving the shelf forgets it, and the next visit decides again.
 */
export function useShelf(ask: ShelfAsk, toBinder: () => void): ShelfSlot | null {
  const verdict = verdictOf(ask);
  const kept = useKept(ask.on, verdict);
  const empty = !kept && verdict === 'empty';
  useEffect(() => {
    if (empty) toBinder();
  }, [empty, toBinder]);
  return slotOf(ask);
}

/** Whether this visit has kept the shelf: once kept, it stays until the shelf is left. */
function useKept(on: boolean, verdict: Verdict): boolean {
  const [kept, setKept] = useState(false);
  const keep = on && (kept || verdict === 'kept');
  if (keep !== kept) setKept(keep);
  return keep;
}

/** The slot while the shelf shows: its count once the account's copy and the binders are in. */
function slotOf({on, syncing, shelf}: ShelfAsk): ShelfSlot | null {
  if (!on) return null;
  return {count: syncing || shelf === null ? null : shelfCount(shelf)};
}
