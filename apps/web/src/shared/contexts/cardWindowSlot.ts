import {createContext, useContext, useSyncExternalStore} from 'react';

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
 * The open card window's slot under its card, and the printing it shows (#826): what a page needs
 * to fill the slot through a portal (`useCardWindowSlot`). `CardModalProvider` holds one of each
 * and hands their setters to the window.
 *
 * STORES, NOT THE PROVIDER'S STATE. Every page reads `useCardModal()`, so a value in its state
 * re-renders the page behind the window on each change, and the printing on show changes with
 * every pill and with each printing a swipe crosses. Kept here, they re-render only the one
 * component that fills the slot.
 */
export interface CardWindowStores {
  slot: WindowStore<HTMLElement | null>;
  shownPrintingId: WindowStore<string | null>;
}

export const createCardWindowStores = (): CardWindowStores => ({
  slot: createWindowStore<HTMLElement | null>(null),
  shownPrintingId: createWindowStore<string | null>(null),
});

export const CardWindowSlotContext = createContext<CardWindowStores | null>(null);

/**
 * The open card window's slot under its card, and the printing it shows (#826): an element a
 * page may fill through a portal (Browse puts "Your copies" there, keeping the collection's
 * context and code out of the window's chunk), null while no window is open; and a variant's
 * id, or null for the card's own printing. The printing starts as the one each card arrives
 * on, then follows the window's pills and swipes.
 *
 * Only the caller re-renders when these change (see `CardWindowStores`), so call it from the
 * small component that fills the slot, never from a page.
 */
export function useCardWindowSlot(): {slot: HTMLElement | null; shownPrintingId: string | null} {
  const stores = useContext(CardWindowSlotContext);
  if (!stores) throw new Error('useCardWindowSlot must be used inside CardModalProvider');
  const slot = useSyncExternalStore(stores.slot.subscribe, stores.slot.get, () => null);
  const shownPrintingId = useSyncExternalStore(
    stores.shownPrintingId.subscribe,
    stores.shownPrintingId.get,
    () => null,
  );
  return {slot, shownPrintingId};
}
