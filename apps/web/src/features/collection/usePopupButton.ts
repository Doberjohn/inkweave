import {useState, type FocusEvent, type KeyboardEvent, type RefObject} from 'react';
import {useCloseOnPressOutside} from './useCloseOnPressOutside';

/** The keys that open the popup from its button, as a menu button's do. */
const OPENING_KEYS = new Set(['ArrowDown', 'ArrowUp']);

/**
 * A button that opens a popup beside it, as the gear's menu, a binder's ⋯ and the rule dropdowns
 * do: the button or the arrows on it open the popup, Escape closes it onto its button, and Tab,
 * keyboard focus leaving or a press outside closes it. Put `wrapperRef` on the box holding the
 * button and its popup; the button is the one in it with `aria-haspopup`. `onOpen` is told each
 * time the popup opens, with the key that opened it, if one did.
 */
export function usePopupButton(wrapperRef: RefObject<HTMLDivElement | null>, onOpen?: (key?: string) => void) {
  const [open, setOpen] = useState(false);
  useCloseOnPressOutside(open, wrapperRef, setOpen);

  const openPopup = (key?: string) => {
    onOpen?.(key);
    setOpen(true);
  };
  const focusButton = () => wrapperRef.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus();
  // Closing onto the button: Safari focuses no button a click presses, so focus would go with the popup.
  const close = () => {
    setOpen(false);
    focusButton();
  };

  return {
    open,
    close,
    focusButton,
    press: open ? close : () => openPopup(),
    onButtonKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (open || !OPENING_KEYS.has(e.key)) return;
      e.preventDefault();
      openPopup(e.key);
    },
    /**
     * Escape inside the open popup closes it onto its button, and is the popup's alone: the page
     * or the window around it must not close too.
     */
    onEscape: (e: KeyboardEvent) => {
      if (!open || e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      close();
    },
    /**
     * Tab out of the open popup closes it onto its button first, so focus never drops with a
     * control the close takes away. Shift+Tab stops there, the control before the popup; Tab
     * goes on from the button's place to whatever follows it.
     */
    leave: (e: KeyboardEvent) => {
      close();
      if (e.shiftKey) e.preventDefault();
    },
    /** Keyboard focus leaving the button and its popup closes the popup; a click on nothing doesn't. */
    closeOnLeave: (e: FocusEvent) => {
      if (e.relatedTarget instanceof Node && !wrapperRef.current?.contains(e.relatedTarget)) setOpen(false);
    },
  };
}
