import {useEffect, useRef, type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactNode} from 'react';
import {CtaButton} from '../../shared/components';
import {ToolbarToggle} from 'inkweave-ui/components/ToolbarToggle';
import {useHover} from 'inkweave-ui/hooks/useHover';
import {useMenuButton} from './useMenuButton';
import {
  COLORS,
  DISABLED_STYLE,
  DURATION,
  EASING,
  FONT_SIZES,
  GOLD_GLOW,
  RADIUS,
  SHADOWS,
  SPACING,
  FONT_WEIGHT,
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menu = useMenuButton(wrapperRef, onMenuOpen);
  /** Import closes the menu onto the gear first, so the dialog it opens gives the focus back there. */
  const startImport = () => {
    menu.close();
    onImport();
  };

  return (
    <div ref={wrapperRef} style={{position: 'relative'}}>
      <ToolbarToggle
        active={menu.open}
        aria-label="Collection actions"
        {...menu.buttonProps}
        style={{width: 34, padding: 0}}>
        <GearIcon />
      </ToolbarToggle>
      {menu.open && (
        <ActionsMenu label="Collection actions" {...menu.menuProps}>
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
  /** What the menu is called: its button's name. */
  label: string;
  children: ReactNode;
  /** Changes to the menu's box, such as a narrower one under a binder's ⋯. */
  style?: CSSProperties;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onBlur: (e: FocusEvent) => void;
}

/** The open menu. Opening puts focus on its first action, as a menu does, so the arrows work at once. */
export function ActionsMenu({id, label, children, style, onKeyDown, onBlur}: ActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, []);
  return (
    <div
      ref={menuRef}
      id={id}
      role="menu"
      aria-label={label}
      tabIndex={-1}
      style={{...MENU_STYLE, ...style}}
      onKeyDown={onKeyDown}
      onBlur={onBlur}>
      {children}
    </div>
  );
}

/** A menu row: the kit's neutral button, washed on hover, its words stacked. */
function actionStyle({hovered, waits, danger}: {hovered: boolean; waits: boolean; danger: boolean}): CSSProperties {
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
    color: danger ? COLORS.error : COLORS.text,
    fontSize: `${FONT_SIZES.lg}px`,
    fontWeight: FONT_WEIGHT.medium,
    textAlign: 'left',
    whiteSpace: 'nowrap',
    // Rows don't boop: a growing row would clip against the menu's edge.
    transform: undefined,
    transition: `background ${DURATION.fast}ms ${EASING.snappy}`,
    ...(waits && DISABLED_STYLE),
  };
}

const NOTE_STYLE: CSSProperties = {fontSize: `${FONT_SIZES.base}px`, color: COLORS.textMuted};

interface MenuActionProps {
  label: string;
  /** Why the action waits, said under its name. Set, the action waits: it stays in reach but does nothing. */
  waitNote?: string;
  /** An action that destroys something, such as Delete binder, in red. */
  danger?: boolean;
  onSelect: () => void;
}

/** One action in the menu. */
export function MenuAction({label, waitNote, danger = false, onSelect}: MenuActionProps) {
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
      style={actionStyle({hovered, waits, danger})}>
      <span>{label}</span>
      {waits && <span style={NOTE_STYLE}>{waitNote}</span>}
    </CtaButton>
  );
}
