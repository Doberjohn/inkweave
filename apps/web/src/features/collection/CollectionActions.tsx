import {useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactNode} from 'react';
import {CtaButton} from '../../shared/components';
import {ToolbarToggle} from '../../shared/components/ToolbarToggle';
import {useHover} from '../../shared/hooks/useHover';
import {useCloseOnPressOutside} from './useCloseOnPressOutside';
import {
  COLORS,
  DISABLED_STYLE,
  EASING,
  FONT_SIZES,
  GOLD_GLOW,
  RADIUS,
  SHADOWS,
  SPACING,
} from '../../shared/constants';

export interface CollectionActionsProps {
  /** Opens the import dialog: Browse's own, the Account page's flow (`openImport`). */
  onImport: () => void;
  /**
   * The account has not answered yet and this browser holds no collection: the import waits,
   * as the Account page's button does, so it never races the account's own copy.
   */
  checking: boolean;
  /**
   * Told each time the menu opens, before an action is chosen: Browse starts the import dialog's
   * chunk there (#913), so the dialog opens at once.
   */
  onMenuOpen?: () => void;
}

/**
 * The collection's actions, behind a gear after Collection (owner, 2026-10-20), for the
 * signed-in, on the grid and in the binder alike. For now one, Import collection: the Account
 * page's import, in Browse's own dialog.
 *
 * A menu button: opening focuses the first action, the arrows move through the actions,
 * Escape closes the menu onto the gear, and Tab or a press outside closes it.
 */
export function CollectionActions({onImport, checking, onMenuOpen}: CollectionActionsProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
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
  /** Import closes the menu onto the gear first, so the dialog it opens gives the focus back there. */
  const startImport = () => {
    close();
    onImport();
  };
  /** Keyboard focus leaving the gear and its menu closes the menu. */
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

  return (
    <div ref={wrapperRef} style={{position: 'relative'}}>
      <ToolbarToggle
        active={open}
        aria-label="Collection actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={open ? () => setOpen(false) : openMenu}
        onKeyDown={onButtonKeyDown}
        onBlur={closeOnLeave}
        style={{width: 34, padding: 0}}>
        <GearIcon />
      </ToolbarToggle>
      {open && (
        <ActionsMenu id={menuId} onKeyDown={onMenuKeyDown} onBlur={closeOnLeave}>
          <MenuAction
            label="Import collection"
            waitNote={checking ? 'Checking your account…' : undefined}
            onSelect={startImport}
          />
        </ActionsMenu>
      )}
    </div>
  );
}

/** The keys that open the menu from the gear, as the set picker's arrows open its list. */
const OPENING_KEYS = new Set(['ArrowDown', 'ArrowUp']);

/**
 * A gear in the button's text colour: gold on the ghost outline, dark on the fill. Six broad
 * teeth (owner, 2026-10-20: eight read noisy at 18px), each an arc on the outer circle over
 * one on the root circle.
 */
function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.5 5.2L9.8 2.6A9.6 9.6 0 0 1 14.2 2.6L14.5 5.2A7.2 7.2 0 0 1 16.6 6.5L19 5.5A9.6 9.6 0 0 1 21.2 9.2L19.1 10.7A7.2 7.2 0 0 1 19.1 13.3L21.2 14.8A9.6 9.6 0 0 1 19 18.5L16.6 17.5A7.2 7.2 0 0 1 14.5 18.8L14.2 21.4A9.6 9.6 0 0 1 9.8 21.4L9.5 18.8A7.2 7.2 0 0 1 7.4 17.5L5 18.5A9.6 9.6 0 0 1 2.8 14.8L4.9 13.3A7.2 7.2 0 0 1 4.9 10.7L2.8 9.2A9.6 9.6 0 0 1 5 5.5L7.4 6.5A7.2 7.2 0 0 1 9.5 5.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** The menu, under the gear and lined up with its right edge, as the set picker's list is drawn. */
const MENU_STYLE: CSSProperties = {
  position: 'absolute',
  // Over the binder's count pills (3), as the set picker's menu is.
  zIndex: 4,
  top: `calc(100% + ${SPACING.xs}px)`,
  right: 0,
  minWidth: 200,
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.xxs,
  padding: SPACING.xs,
  background: COLORS.surfaceFloating,
  border: `1px solid ${COLORS.surfaceBorder}`,
  borderRadius: `${RADIUS.lg}px`,
  boxShadow: SHADOWS.panel,
};

interface ActionsMenuProps {
  id: string;
  children: ReactNode;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onBlur: (e: FocusEvent) => void;
}

/** The open menu. Opening puts focus on its first action, as a menu does, so the arrows work at once. */
function ActionsMenu({id, children, onKeyDown, onBlur}: ActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, []);
  return (
    <div
      ref={menuRef}
      id={id}
      role="menu"
      aria-label="Collection actions"
      tabIndex={-1}
      style={MENU_STYLE}
      onKeyDown={onKeyDown}
      onBlur={onBlur}>
      {children}
    </div>
  );
}

/** A menu row: the kit's neutral button, washed on hover, its words stacked. */
function actionStyle({hovered, waits}: {hovered: boolean; waits: boolean}): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: SPACING.xxs,
    width: '100%',
    minHeight: 0,
    padding: `${SPACING.sm}px ${SPACING.md}px`,
    borderRadius: `${RADIUS.md}px`,
    border: '1px solid transparent',
    background: hovered && !waits ? GOLD_GLOW.hoverBg : 'transparent',
    color: COLORS.text,
    fontSize: `${FONT_SIZES.lg}px`,
    fontWeight: 500,
    textAlign: 'left',
    whiteSpace: 'nowrap',
    // Rows don't boop: a growing row would clip against the menu's edge.
    transform: undefined,
    transition: `background 0.15s ${EASING.snappy}`,
    ...(waits && DISABLED_STYLE),
  };
}

const NOTE_STYLE: CSSProperties = {fontSize: `${FONT_SIZES.base}px`, color: COLORS.textMuted};

interface MenuActionProps {
  label: string;
  /** Why the action waits, said under its name. Set, the action waits: it stays in reach but does nothing. */
  waitNote?: string;
  onSelect: () => void;
}

/** One action in the menu. */
function MenuAction({label, waitNote, onSelect}: MenuActionProps) {
  const {hovered, hoverProps} = useHover();
  const waits = waitNote !== undefined;
  return (
    <CtaButton
      variant="neutral"
      {...hoverProps}
      role="menuitem"
      tabIndex={-1}
      aria-disabled={waits || undefined}
      onClick={waits ? undefined : onSelect}
      style={actionStyle({hovered, waits})}>
      <span>{label}</span>
      {waits && <span style={NOTE_STYLE}>{waitNote}</span>}
    </CtaButton>
  );
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
