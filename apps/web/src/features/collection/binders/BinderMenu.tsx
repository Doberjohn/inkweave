import {useRef, type CSSProperties, type Ref} from 'react';
import {IconButton} from '../../../shared/components';
import {COLORS, RADIUS, blackRgba, whiteRgba} from '../../../shared/constants';
import {ActionsMenu, MenuAction} from '../CollectionActions';
import {useMenuButton} from '../useMenuButton';
import './binderShelf.css';

export interface BinderMenuProps {
  /** A phone shows the ⋯ always; a computer on hover and focus (`binderShelf.css`). */
  alwaysShown: boolean;
  onOpen: () => void;
  /** Opens the binder in the New binder window, to change its Sets, rules and name. */
  onEditRules?: () => void;
  /** Opens Rename. */
  onRename?: () => void;
  /** Opens Change cover, which My collection's ⋯ offers too. */
  onChangeCover?: () => void;
  /**
   * Its place on the shelf, and the moves it allows: no Move earlier for the first binder, no Move
   * later for the last. None for My collection, which never moves.
   */
  moves?: {first: boolean; last: boolean; onMove: (earlier: boolean) => void};
  /** Asks first: Delete binder opens the confirm, which deletes. None for My collection. */
  onDelete?: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}

/** One of the menu's choices. */
interface MenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
}

/** Edit rules, Rename and Change cover, each one the shelf offers. */
function changeItems({onEditRules, onRename, onChangeCover}: BinderMenuProps): MenuItem[] {
  const items = [
    {label: 'Edit rules', action: onEditRules},
    {label: 'Rename', action: onRename},
    {label: 'Change cover', action: onChangeCover},
  ];
  return items.filter((item): item is MenuItem => item.action !== undefined);
}

/** Move earlier and Move later, where the binder has a neighbour that way. */
function moveItems(moves: BinderMenuProps['moves']): MenuItem[] {
  if (moves === undefined) return [];
  const {first, last, onMove} = moves;
  return [
    ...(first ? [] : [{label: 'Move earlier', action: () => onMove(true)}]),
    ...(last ? [] : [{label: 'Move later', action: () => onMove(false)}]),
  ];
}

/** Every choice in the menu's order: Open, the changes, the moves, then Delete binder. */
function itemsOf(props: BinderMenuProps): MenuItem[] {
  const {onOpen, onDelete} = props;
  return [
    {label: 'Open', action: onOpen},
    ...changeItems(props),
    ...moveItems(props.moves),
    ...(onDelete ? [{label: 'Delete binder', action: onDelete, danger: true}] : []),
  ];
}

/** The ⋯'s disc, and the touch target round it: the house 44 px floor (`IconButton`). */
const DISC_SIZE = 34;
const TARGET_SIZE = 44;

/**
 * The target is see-through, its overhang taken back by its margin, so the disc sits where a
 * 34 px button would and the menu opens from the same box. The disc draws the hover
 * (`binderShelf.css`), since the button's own would be a square round it.
 */
const BUTTON: CSSProperties = {margin: -(TARGET_SIZE - DISC_SIZE) / 2, background: 'transparent'};

/** The ⋯ on the board: a dark disc, so it reads over a cover's pattern, the house surface on hover. */
const DISC = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: DISC_SIZE,
  height: DISC_SIZE,
  borderRadius: `${RADIUS.pill}px`,
  border: `1px solid ${whiteRgba(0.16)}`,
  color: COLORS.text,
  '--shelf-dots': blackRgba(0.65),
  '--shelf-dots-hover': COLORS.surfaceHover,
} as CSSProperties;

/** Narrower than the gear's, under a cover a phone draws two across. */
const MENU: CSSProperties = {minWidth: 168};

/** Three dots across, in the button's text colour. */
function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

/**
 * A cover's ⋯ on the shelf, named "Actions" after the cover's own name, and its menu. A binder of
 * your own's: Open, Edit rules, Rename, Change cover, Move earlier (not on the first binder),
 * Move later (not on the last) and Delete binder. My collection's: Open and Change cover. The keys
 * are the gear's (`useMenuButton`): opening focuses Open, the arrows move, Escape returns focus to
 * ⋯, and Tab or a press outside closes the menu. A choice closes the menu onto ⋯ first, so a move
 * keeps focus there, and the dialogs and the window return it there.
 *
 * Its words are ours alone: the binder's name never reaches its labels.
 */
export function BinderMenu(props: BinderMenuProps) {
  const {alwaysShown, buttonRef} = props;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menu = useMenuButton(wrapperRef);
  const choose = (action: () => void) => () => {
    menu.close();
    action();
  };
  return (
    <div
      ref={wrapperRef}
      className={alwaysShown ? undefined : 'binder-shelf-actions'}
      data-open={menu.open || undefined}
      style={{position: 'relative'}}>
      <IconButton ref={buttonRef} aria-label="Actions" size={TARGET_SIZE} {...menu.buttonProps} style={BUTTON}>
        <span className="binder-shelf-dots" style={DISC}>
          <DotsIcon />
        </span>
      </IconButton>
      {menu.open && (
        <ActionsMenu label="Actions" {...menu.menuProps} style={MENU}>
          {itemsOf(props).map((item) => (
            <MenuAction key={item.label} label={item.label} danger={item.danger} onSelect={choose(item.action)} />
          ))}
        </ActionsMenu>
      )}
    </div>
  );
}
