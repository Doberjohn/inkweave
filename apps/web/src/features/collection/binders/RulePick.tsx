import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {Chip} from '../../../shared/components';
import {
  COLORS,
  DURATION,
  EASING,
  FONT_SIZES,
  GOLD_GLOW,
  RADIUS,
  SHADOWS,
  SPACING,
  TRUNCATE,
} from '../../../shared/constants';
import {useCloseOnPressOutside} from '../useCloseOnPressOutside';
import {FIELD} from './binderFields';
import './rulePick.css';

export interface RulePickProps {
  /** The line's name, "Classification" or "Keyword", which the button and the list say too. */
  label: string;
  /** What it offers, in the order the list shows them. */
  options: readonly string[];
  /** What is picked: a card must have every one. */
  picked: readonly string[];
  onChange: (next: string[]) => void;
  isMobile: boolean;
}

/** How tall the list grows before it scrolls. */
const LIST_MAX = 240;

/** The room the open list takes: the list, its find field and its padding. */
const POPOVER_ROOM = LIST_MAX + 64;

/** The keys that open the list from its button, as a menu button's do. */
const OPENING_KEYS = new Set(['ArrowDown', 'ArrowUp']);

/** The list with `value` added, or removed if it was there. */
const toggledIn = (values: readonly string[], value: string) =>
  values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

/** The nearest box that scrolls, whose edges the open list must stay inside. */
function scrollBoxOf(el: HTMLElement): HTMLElement | null {
  for (let at = el.parentElement; at; at = at.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(at).overflowY)) return at;
  }
  return null;
}

/**
 * Whether the list opens above its field: only when there isn't room for it below, inside the
 * box that scrolls, and there is more above. The last lines sit near the window's foot.
 */
function opensUpward(field: HTMLElement | null): boolean {
  if (!field) return false;
  const box = scrollBoxOf(field)?.getBoundingClientRect() ?? {top: 0, bottom: window.innerHeight};
  const at = field.getBoundingClientRect();
  const below = box.bottom - at.bottom;
  return below < POPOVER_ROOM && at.top - box.top > below;
}

/** Whether focus went somewhere outside `box`: the keyboard leaving, not a click on nothing. */
const focusLeft = (e: FocusEvent, box: HTMLElement | null) =>
  e.relatedTarget instanceof Node && !box?.contains(e.relatedTarget);

/**
 * The list's open state, and what opens and closes it: the button, the arrows on it, Escape (onto
 * the button), Tab, keyboard focus leaving the field and its list, and a press outside them.
 */
function usePickPopup(wrapperRef: RefObject<HTMLDivElement | null>, buttonRef: RefObject<HTMLButtonElement | null>) {
  const [open, setOpen] = useState(false);
  const [upward, setUpward] = useState(false);
  useCloseOnPressOutside(open, wrapperRef, setOpen);
  const openList = () => {
    setUpward(opensUpward(wrapperRef.current));
    setOpen(true);
  };
  // Closing onto the button: Safari focuses no button a click presses, so focus would go with the list.
  const closeOntoButton = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  return {
    open,
    upward,
    closeOntoButton,
    close: () => setOpen(false),
    press: open ? closeOntoButton : openList,
    onButtonKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (open || !OPENING_KEYS.has(e.key)) return;
      e.preventDefault();
      openList();
    },
    closeOnLeave: (e: FocusEvent) => {
      if (focusLeft(e, wrapperRef.current)) setOpen(false);
    },
  };
}

type PickPopup = ReturnType<typeof usePickPopup>;

/**
 * Classification or Keyword: a field holding the picks as chips, each with its ×, then a button,
 * "Any classification" or "Add a classification", that opens the list of what the binder's pool
 * offers, with a find field on top. A pick stays in the list, ticked, so a second press takes it
 * off. Escape, a press outside or focus leaving closes the list.
 *
 * A popover, not a dialog: no scrim and no focus trap. The find field is the list's combobox,
 * so the arrows move through it while the field keeps the focus, and Enter picks.
 */
export function RulePick({label, options, picked, onChange, isMobile}: RulePickProps) {
  const noun = label.toLowerCase();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popup = usePickPopup(wrapperRef, buttonRef);
  const listId = useId();
  /** An × takes its pick off; focus goes to the button, since the chip it was on is gone. */
  const drop = (value: string) => {
    onChange(picked.filter((v) => v !== value));
    buttonRef.current?.focus();
  };
  return (
    <div ref={wrapperRef} style={isMobile ? WRAPPER_PHONE : WRAPPER} onBlur={popup.closeOnLeave}>
      <PickField
        words={{noun, listId}}
        picked={picked}
        popup={popup}
        buttonRef={buttonRef}
        onDrop={drop}
        isMobile={isMobile}
      />
      {popup.open && (
        <PickList
          id={listId}
          noun={noun}
          options={options}
          picked={picked}
          upward={popup.upward}
          onToggle={(value) => onChange(toggledIn(picked, value))}
          onClose={popup.closeOntoButton}
          onTab={popup.close}
        />
      )}
    </div>
  );
}

interface PickFieldProps {
  /** The line's noun, and the id of the list the button opens. */
  words: {noun: string; listId: string};
  picked: readonly string[];
  popup: PickPopup;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onDrop: (value: string) => void;
  isMobile: boolean;
}

/** The closed field: the picks' chips, then the button that opens the list. */
function PickField({words, picked, popup, buttonRef, onDrop, isMobile}: PickFieldProps) {
  return (
    <div style={BOX}>
      {picked.map((value) => (
        <Chip
          key={value}
          variant="dismiss"
          label={value}
          isMobile={isMobile}
          onDismiss={() => onDrop(value)}
          style={isMobile ? undefined : SMALL_CHIP}
        />
      ))}
      <button
        ref={buttonRef}
        type="button"
        className="rule-pick-trigger"
        aria-haspopup="listbox"
        aria-expanded={popup.open}
        aria-controls={popup.open ? words.listId : undefined}
        onClick={popup.press}
        onKeyDown={popup.onButtonKeyDown}>
        <span style={TRUNCATE}>{picked.length === 0 ? `Any ${words.noun}` : `Add a ${words.noun}`}</span>
        <Caret />
      </button>
    </div>
  );
}

/** The button's ▾, drawn so it sits on the text's middle in every font. */
function Caret() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true" style={{flexShrink: 0}}>
      <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

interface PickListProps {
  id: string;
  noun: string;
  options: readonly string[];
  picked: readonly string[];
  upward: boolean;
  onToggle: (value: string) => void;
  onClose: () => void;
  onTab: () => void;
}

/** What a key in the find field does; any other key types. */
type KeyAct = 'close' | 'leave' | 'pick' | 'down' | 'up';

const KEY_ACTS: Partial<Record<string, KeyAct>> = {
  Escape: 'close',
  Tab: 'leave',
  Enter: 'pick',
  ArrowDown: 'down',
  ArrowUp: 'up',
};

/** Takes the key from the page, except Tab, which moves on as ever and closes the list behind it. */
function claimKey(e: KeyboardEvent, act: KeyAct) {
  if (act === 'leave') return;
  e.preventDefault();
  // Escape is the list's alone: the window must not close too.
  if (act === 'close') e.stopPropagation();
}

/** The options whose names hold what was typed, any case; all of them before anything is. */
function optionsMatching(options: readonly string[], find: string): readonly string[] {
  const needle = find.trim().toLowerCase();
  return options.filter((value) => value.toLowerCase().includes(needle));
}

/** The open list: its find field, which takes the focus, and the options it leaves. */
function PickList({id, noun, options, picked, upward, onToggle, onClose, onTab}: PickListProps) {
  const [find, setFind] = useState('');
  const [active, setActive] = useState(0);
  const findRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const optionId = useId();
  const shown = optionsMatching(options, find);
  const last = shown.length - 1;
  // -1 while nothing matches, which leaves Enter nothing to pick.
  const at = Math.min(active, last);
  const activeId = at < 0 ? undefined : `${optionId}-${at}`;
  useEffect(() => {
    findRef.current?.focus();
  }, []);

  /**
   * The arrows bring the option they reach into view; the pointer never scrolls the list, which
   * would slide the next option under it. jsdom has no scrollIntoView.
   */
  const moveTo = (index: number) => {
    setActive(index);
    document.getElementById(`${optionId}-${index}`)?.scrollIntoView?.({block: 'nearest'});
  };
  const acts: Record<KeyAct, () => void> = {
    close: onClose,
    leave: onTab,
    pick: () => shown.slice(at, at + 1).forEach(onToggle),
    down: () => moveTo(Math.min(at + 1, last)),
    up: () => moveTo(Math.max(at - 1, 0)),
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const act = KEY_ACTS[e.key];
    if (!act) return;
    claimKey(e, act);
    acts[act]();
  };

  return (
    <div style={{...POPOVER, ...(upward ? ABOVE : BELOW)}}>
      <input
        ref={findRef}
        role="combobox"
        aria-label={`Find a ${noun}`}
        aria-expanded="true"
        aria-controls={id}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        placeholder={`Find a ${noun}`}
        autoComplete="off"
        value={find}
        onChange={(e) => {
          setFind(e.target.value);
          setActive(0);
          // The highlight goes back to the first match, so the list goes back to its top.
          if (listRef.current) listRef.current.scrollTop = 0;
        }}
        onKeyDown={onKeyDown}
        style={FIND}
      />
      <ul ref={listRef} id={id} role="listbox" aria-label={`${noun[0].toUpperCase()}${noun.slice(1)}s`} aria-multiselectable="true" style={LIST}>
        {shown.map((value, index) => (
          <PickOption
            key={value}
            id={`${optionId}-${index}`}
            value={value}
            selected={picked.includes(value)}
            active={index === at}
            onPick={() => onToggle(value)}
            onPoint={() => setActive(index)}
          />
        ))}
      </ul>
      {shown.length === 0 && <p style={NONE}>{`No ${noun} matches`}</p>}
    </div>
  );
}

interface PickOptionProps {
  id: string;
  value: string;
  selected: boolean;
  active: boolean;
  onPick: () => void;
  onPoint: () => void;
}

/** One option: its tick while picked, and the house highlight while the arrows or the pointer are on it. */
function PickOption({id, value, selected, active, onPick, onPoint}: PickOptionProps) {
  return (
    // The keyboard is the find field's (aria-activedescendant), so the option takes only the pointer.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <li
      id={id}
      role="option"
      aria-selected={selected}
      // Kept off the option, so the find field keeps the focus and the list stays open.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      onMouseMove={onPoint}
      style={{
        ...OPTION,
        background: active ? COLORS.surfaceHover : 'transparent',
        color: selected ? COLORS.primary : COLORS.text,
      }}>
      <Tick on={selected} />
      <span style={TRUNCATE}>{value}</span>
    </li>
  );
}

/** A picked option's tick; an unpicked one keeps the room, so the names line up. */
function Tick({on}: {on: boolean}) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{flexShrink: 0, visibility: on ? 'visible' : 'hidden'}}>
      <path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The field and the open list's anchor; the button's look comes in from here (`rulePick.css`).
 * On a computer the field stands as tall as Name has; a phone's takes a touch's height.
 */
const WRAPPER = {
  position: 'relative',
  '--rule-pick-gap': `${SPACING.sm}px`,
  '--rule-pick-pad': `${SPACING.xxs}px ${SPACING.sm}px`,
  '--rule-pick-radius': `${RADIUS.sm}px`,
  '--rule-pick-muted': COLORS.textMuted,
  '--rule-pick-text': COLORS.text,
  '--rule-pick-focus': GOLD_GLOW.focusRing,
  '--rule-pick-fade': `${DURATION.fast}ms ${EASING.snappy}`,
} as CSSProperties;

const WRAPPER_PHONE = {...WRAPPER, '--rule-pick-pad': `${SPACING.sm}px`} as CSSProperties;

/** The text field's look, holding the picks and the button in a row that wraps. */
const BOX: CSSProperties = {...FIELD, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.xs, padding: SPACING.xxs};

/** A pick's chip on a computer, no taller than the field's text. */
const SMALL_CHIP: CSSProperties = {padding: `${SPACING.xxs}px ${SPACING.sm}px`};

const POPOVER: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  // Over the lines after it, inside the window's own layer.
  zIndex: 4,
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.xs,
  padding: SPACING.xs,
  background: COLORS.surfaceFloating,
  border: `1px solid ${COLORS.surfaceBorder}`,
  borderRadius: `${RADIUS.lg}px`,
  boxShadow: SHADOWS.panel,
};

const BELOW: CSSProperties = {top: `calc(100% + ${SPACING.xs}px)`};
const ABOVE: CSSProperties = {bottom: `calc(100% + ${SPACING.xs}px)`};

const FIND: CSSProperties = {...FIELD, padding: `${SPACING.xs}px ${SPACING.sm}px`};

const LIST: CSSProperties = {maxHeight: LIST_MAX, overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none'};

const OPTION: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.sm,
  padding: `${SPACING.xs}px ${SPACING.sm}px`,
  borderRadius: `${RADIUS.sm}px`,
  fontSize: `${FONT_SIZES.base}px`,
  cursor: 'pointer',
};

const NONE: CSSProperties = {margin: 0, padding: `${SPACING.xs}px ${SPACING.sm}px`, fontSize: `${FONT_SIZES.base}px`, color: COLORS.textMuted};
