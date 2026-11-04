import {useRef, type CSSProperties, type Ref} from 'react';
import {IconButton} from '../../../shared/components';
import {COLORS, RADIUS, blackRgba, whiteRgba} from '../../../shared/constants';
import {ActionsMenu, MenuAction} from '../CollectionActions';
import {useMenuButton} from '../useMenuButton';
import './binderShelf.css';

export interface BinderMenuProps {
  /** The binder heads your shelf: no Move earlier. */
  first: boolean;
  /** The binder ends your shelf: no Move later. */
  last: boolean;
  /** A phone shows the ⋯ always; a computer on hover and focus (`binderShelf.css`). */
  alwaysShown: boolean;
  onOpen: () => void;
  /** Move earlier (true) or later (false). */
  onMove: (earlier: boolean) => void;
  /** Asks first: Delete binder opens the confirm, which deletes. */
  onDelete: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
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

/** The ⋯ on the board: a dark disc, so it reads over a cover card's art, the house surface on hover. */
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
 * A binder of your own's ⋯ on the shelf (#1074), named "Actions" after the cover's own name,
 * and its menu: Open, Move earlier (not on the first binder), Move later (not on the last) and
 * Delete binder. The keys are the gear's (`useMenuButton`): opening focuses Open, the arrows
 * move, Escape returns focus to ⋯, and Tab or a press outside closes the menu. A choice closes
 * the menu onto ⋯ first, so a move keeps focus there and the delete confirm returns it there.
 *
 * Its words are ours alone: the binder's name never reaches its labels.
 */
export function BinderMenu({first, last, alwaysShown, onOpen, onMove, onDelete, buttonRef}: BinderMenuProps) {
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
          <MenuAction label="Open" onSelect={choose(onOpen)} />
          {!first && <MenuAction label="Move earlier" onSelect={choose(() => onMove(true))} />}
          {!last && <MenuAction label="Move later" onSelect={choose(() => onMove(false))} />}
          <MenuAction label="Delete binder" danger onSelect={choose(onDelete)} />
        </ActionsMenu>
      )}
    </div>
  );
}
