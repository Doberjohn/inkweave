import {useEffect} from 'react';
import type {BinderShelf} from './binderShelf';

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

/**
 * Whether the shelf would hold nothing to choose between (4B): the account's copy has answered,
 * the collection holds no copy, and the reader has no binder, a failed read counting as none.
 */
function holdsNothing({syncing, holdsCopies, shelf}: ShelfAsk): boolean {
  if (syncing || holdsCopies) return false;
  if (!answered(shelf)) return false;
  // A failed read holds no binders (`viewOf`), so it counts as none.
  return shelf.binders.length === 0;
}

/**
 * The shelf's slot while `?binder=shelf` shows, else null (#1074, 4B). It waits for the account's
 * copy and the binders, showing as it loads; then a player with no copy and no binder gets
 * today's empty start in its place (`toBinder`, a replace to My collection), whatever the press
 * that opened it knew. A binder and no copy keeps the shelf.
 */
export function useShelf(ask: ShelfAsk, toBinder: () => void): ShelfSlot | null {
  const empty = ask.on && holdsNothing(ask);
  useEffect(() => {
    if (empty) toBinder();
  }, [empty, toBinder]);
  if (!ask.on) return null;
  const {shelf} = ask;
  return {count: !ask.syncing && shelf?.status === 'ready' ? shelf.binders.length + 1 : null};
}
