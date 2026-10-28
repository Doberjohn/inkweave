import {createContext, useContext, useLayoutEffect, useSyncExternalStore} from 'react';

/** One value the card window writes and a page reads, outside React state (#826). */
interface WindowStore<T> {
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
}

function createWindowStore<T>(initial: T): WindowStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * The open card window's slot, in a row under its card, and the printing it shows (#826): what a
 * page needs to fill the slot through a portal (`useCardWindowSlot`). `CardModalProvider` holds
 * one of each and hands their setters to the window. The row is there only while a page asks for
 * it (`useHoldCopiesRow`), which the provider reads (`useCopiesRowHeld`).
 *
 * `open` is whether a window is open at all (#941), which the provider sets as it opens and
 * closes one, for a page that holds back what changed in the window until it closes. The slot
 * can't say: an expanded group and a desktop comparison take it away, the window still open.
 *
 * STORES, NOT THE PROVIDER'S STATE. Every page reads `useCardModal()`, so a value in its state
 * re-renders the page behind the window on each change, and the printing on show changes with
 * each printing a swipe crosses. Kept here, they re-render only the one component that fills
 * the slot, and the window's own root.
 */
export interface CardWindowStores {
  slot: WindowStore<HTMLElement | null>;
  /** The friends slot: beside the set's logo on a computer, under the copies on a phone. */
  friendsSlot: WindowStore<HTMLElement | null>;
  shownPrintingId: WindowStore<string | null>;
  copiesRow: WindowStore<boolean>;
  open: WindowStore<boolean>;
}

export const createCardWindowStores = (): CardWindowStores => ({
  slot: createWindowStore<HTMLElement | null>(null),
  friendsSlot: createWindowStore<HTMLElement | null>(null),
  shownPrintingId: createWindowStore<string | null>(null),
  copiesRow: createWindowStore(false),
  open: createWindowStore(false),
});

export const CardWindowSlotContext = createContext<CardWindowStores | null>(null);

function useCardWindowStores(hook: string): CardWindowStores {
  const stores = useContext(CardWindowSlotContext);
  if (!stores) throw new Error(`${hook} must be used inside CardModalProvider`);
  return stores;
}

/**
 * The open card window's slot under its card, and the printing it shows (#826): an element a
 * page may fill through a portal (Browse puts the card's copies stripe there, keeping the
 * collection's context and code out of the window's chunk), null while no window is open or no
 * page holds the row (`useHoldCopiesRow`); and a variant's id, or null for the card's own
 * printing. The printing starts as the one each card arrives on, then follows the window's
 * swipes.
 *
 * The friends slot is a second element, held with the row: Browse puts there the count of the
 * friends who have the card.
 *
 * Only the caller re-renders when these change (see `CardWindowStores`), so call it from the
 * small component that fills the slot, never from a page.
 */
export function useCardWindowSlot(): {
  slot: HTMLElement | null;
  friendsSlot: HTMLElement | null;
  shownPrintingId: string | null;
} {
  const stores = useCardWindowStores('useCardWindowSlot');
  const slot = useSyncExternalStore(stores.slot.subscribe, stores.slot.get, () => null);
  const friendsSlot = useSyncExternalStore(stores.friendsSlot.subscribe, stores.friendsSlot.get, () => null);
  const shownPrintingId = useSyncExternalStore(
    stores.shownPrintingId.subscribe,
    stores.shownPrintingId.get,
    () => null,
  );
  return {slot, friendsSlot, shownPrintingId};
}

/**
 * Holds a row under the card window's card, for what the page puts in its slot, while `hold` is
 * true (owner, 2026-10-22: the copies stripe sat over the card's foot, and the full card should
 * show). Browse holds it while signed in with a collection, before the account's copy has
 * answered too, so the row is already there when the stripe arrives and nothing in the window
 * moves. Let go on unmount, as the page leaves.
 */
export function useHoldCopiesRow(hold: boolean) {
  const {copiesRow} = useCardWindowStores('useHoldCopiesRow');
  useLayoutEffect(() => {
    copiesRow.set(hold);
    return () => copiesRow.set(false);
  }, [copiesRow, hold]);
}

/** Whether a page holds the row under the card window's card (`useHoldCopiesRow`): for the window's root alone. */
export function useCopiesRowHeld(): boolean {
  const {copiesRow} = useCardWindowStores('useCopiesRowHeld');
  return useSyncExternalStore(copiesRow.subscribe, copiesRow.get, () => false);
}
