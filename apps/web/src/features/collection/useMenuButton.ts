import {useId, useState, type FocusEvent, type KeyboardEvent, type RefObject} from 'react';
import {useCloseOnPressOutside} from './useCloseOnPressOutside';

/**
 * A menu button's state and keys, for the gear's menu and a binder's ⋯ (#1074): opening focuses
 * the first action (`ActionsMenu`), the arrows move through the actions, Escape closes the menu
 * onto its button, and Tab, keyboard focus leaving or a press outside closes it. Spread
 * `buttonProps` on the button and `menuProps` on `ActionsMenu`, and put `wrapperRef` on the box
 * holding both. `onMenuOpen` is told each time the menu opens.
 */
export function useMenuButton(wrapperRef: RefObject<HTMLDivElement | null>, onMenuOpen?: () => void) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  useCloseOnPressOutside(open, wrapperRef, setOpen);

  const openMenu = () => {
    setOpen(true);
    onMenuOpen?.();
  };
  const close = () => {
    setOpen(false);
    wrapperRef.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus();
  };
  /** Keyboard focus leaving the button and its menu closes the menu. */
  const closeOnLeave = (e: FocusEvent) => {
    if (e.relatedTarget instanceof Node && !wrapperRef.current?.contains(e.relatedTarget)) setOpen(false);
  };

  function onButtonKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (open || !OPENING_KEYS.has(e.key)) return;
    e.preventDefault();
    openMenu();
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      // Ours alone: the page must not also act on it.
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      setOpen(false);
    } else if (moveFocus(e.currentTarget, e.key)) {
      e.preventDefault();
    }
  }

  return {
    open,
    close,
    buttonProps: {
      'aria-haspopup': 'menu' as const,
      'aria-expanded': open,
      'aria-controls': open ? menuId : undefined,
      onClick: open ? () => setOpen(false) : openMenu,
      onKeyDown: onButtonKeyDown,
      onBlur: closeOnLeave,
    },
    menuProps: {id: menuId, onKeyDown: onMenuKeyDown, onBlur: closeOnLeave},
  };
}

/** The keys that open the menu from its button, as the set picker's arrows open its list. */
const OPENING_KEYS = new Set(['ArrowDown', 'ArrowUp']);

/** Where each key takes focus among the actions, from the focused one and the last one's index. */
const MOVES: Record<string, (at: number, last: number) => number> = {
  ArrowDown: (at, last) => Math.min(at + 1, last),
  ArrowUp: (at) => Math.max(at - 1, 0),
  Home: () => 0,
  End: (_, last) => last,
};

/** Move focus through the menu's actions for a navigation key; false for any other key. */
function moveFocus(menu: HTMLElement, key: string): boolean {
  if (!(key in MOVES)) return false;
  const actions = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  const at = Math.max(
    actions.findIndex((action) => action === document.activeElement),
    0,
  );
  actions[MOVES[key](at, actions.length - 1)]?.focus();
  return true;
}
