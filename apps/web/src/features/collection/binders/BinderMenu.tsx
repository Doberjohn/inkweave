import {useRef, type CSSProperties, type Ref} from 'react';
import {IconButton} from '../../../shared/components';
import {COLORS, RADIUS, blackRgba, whiteRgba} from '../../../shared/constants';
import {ActionsMenu, MenuAction} from '../CollectionActions';
import {useMenuButton} from '../useMenuButton';

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

/** The ⋯ on the board: a dark disc, so it reads over a cover card's art. */
const BUTTON: CSSProperties = {
  borderRadius: `${RADIUS.pill}px`,
  background: blackRgba(0.65),
  border: `1px solid ${whiteRgba(0.16)}`,
  color: COLORS.text,
};

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
      <IconButton ref={buttonRef} aria-label="Actions" size={34} {...menu.buttonProps} style={BUTTON}>
        <DotsIcon />
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
