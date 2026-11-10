import {useId, type KeyboardEvent, type RefObject} from 'react';
import {usePopupButton} from './usePopupButton';

/**
 * A menu button's state and keys, for the gear's menu and a binder's ⋯ (#1074): opening focuses
 * the first action (`ActionsMenu`), the arrows move through the actions, Escape closes the menu
 * onto its button, and Tab, keyboard focus leaving or a press outside closes it (`usePopupButton`).
 * Spread `buttonProps` on the button and `menuProps` on `ActionsMenu`, and put `wrapperRef` on the
 * box holding both. `onMenuOpen` is told each time the menu opens.
 */
export function useMenuButton(wrapperRef: RefObject<HTMLDivElement | null>, onMenuOpen?: () => void) {
  const popup = usePopupButton(wrapperRef, onMenuOpen);
  const menuId = useId();

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') popup.onEscape(e);
    else if (e.key === 'Tab') popup.leave(e);
    else if (moveFocus(e.currentTarget, e.key)) e.preventDefault();
  }

  return {
    open: popup.open,
    close: popup.close,
    buttonProps: {
      'aria-haspopup': 'menu' as const,
      'aria-expanded': popup.open,
      'aria-controls': popup.open ? menuId : undefined,
      onClick: popup.press,
      onKeyDown: popup.onButtonKeyDown,
      onBlur: popup.closeOnLeave,
    },
    menuProps: {id: menuId, onKeyDown: onMenuKeyDown, onBlur: popup.closeOnLeave},
  };
}

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
