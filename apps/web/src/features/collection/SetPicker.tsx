import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {CtaButton} from '../../shared/components';
import {useHover} from '../../shared/hooks/useHover';
import {RaritySymbol} from '../reveals/RaritySymbol';
import {isFinished, percentOf} from './collectionStats';
import {WHOLE_COLLECTION, isPromoSet, setLabel, setName} from './binderCards';
import {
  CAP_LABEL,
  COLORS,
  EASING,
  FONT_SIZES,
  GOLD_GLOW,
  RADIUS,
  SET_LOGOS,
  SHADOWS,
  SPACING,
  TABULAR,
  TRUNCATE,
} from '../../shared/constants';

/** How far through one set you are, of the cards counted; a set's tally carries both. Filtered, a set may count none. */
interface Progress {
  complete: number;
  cards: number;
}

export interface SetPickerProps {
  /** The set the binder shows, or `WHOLE_COLLECTION`. */
  setCode: string;
  /** The sets the binder can show, newest first. */
  sets: string[];
  /** True while that list is still loading: the picker waits for it. */
  setsLoading: boolean;
  onSetChange: (set: string) => void;
  /**
   * Each set's progress by code, and the whole collection's under `WHOLE_COLLECTION`,
   * once the pool is in, so each row can show its percentage.
   */
  progress: ReadonlyMap<string, Progress> | null;
}

/** What the picker calls a choice: "Whole collection", "Set 11, Winterspell", or "Promo set P1, Promo Set 1". */
const choiceLabel = (choice: string) => (choice === WHOLE_COLLECTION ? 'Whole collection' : setLabel(choice));

/**
 * Room for a two-line name ("Attack of the Vine!") under the set's number, so switching
 * sets never moves what sits below the picker.
 */
const TRIGGER_HEIGHT = 72;

/** The logo's box. Logos run from 1.4:1 to 3.3:1, so the box is fixed and the art contained. */
const LOGO_BOX: CSSProperties = {width: 64, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center'};

/**
 * About eleven rows, past which the list scrolls. Half the window at most, so on a short
 * laptop (about 650px tall) the list still ends inside the panel it opens over.
 */
const LIST_MAX_HEIGHT = 'min(440px, 50vh)';

/**
 * The binder's set picker (owner, 2026-10-12, layout B of `public/mockups/collection-panel-tabs.html`):
 * a button with the open set's logo and name, opening a list of every set with how far
 * through it you are. The one place the binder's set is chosen.
 *
 * "WHOLE COLLECTION" IS PINNED FIRST (owner, 2026-10-12), held at the top while the sets
 * scroll under it: it puts every set in the binder and the panel's numbers, where tabs
 * used to switch the numbers alone.
 *
 * THE PROMO SETS FOLLOW THE SETS, UNDER A "PROMO SETS" HEADING (owner, 2026-10-17, option A
 * of `public/mockups/collection-promos.html`, #805), newest first as the sets go, each by
 * the code printed on its cards where a set has its number, Curator's Collection by CC, the
 * letters its editions' codes share (owner, 2026-10-19). The button shows the promo symbol
 * for a logo.
 *
 * A listbox in the select's manner: opening focuses the open set, the arrows, Home and End
 * move through the list, Escape closes it and gives focus back to the button, and Tab or a
 * press outside closes it.
 */
export function SetPicker({setCode, sets, setsLoading, onSetChange, progress}: SetPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  useCloseOnPressOutside(open, wrapperRef, setOpen);
  useFocusOpenSetOnOpen(open, wrapperRef);

  const close = () => {
    setOpen(false);
    wrapperRef.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus();
  };
  const pick = (set: string) => {
    onSetChange(set);
    close();
  };
  /** Escape closes the list back onto the button. Ours alone: the page must not also act on it. */
  const closeOnEscape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return false;
    e.preventDefault();
    e.stopPropagation();
    close();
    return true;
  };
  /** Keyboard focus leaving the picker closes the list. A press outside is the effect's: see there. */
  const closeOnLeave = (e: FocusEvent) => {
    if (e.relatedTarget instanceof Node && !wrapperRef.current?.contains(e.relatedTarget)) setOpen(false);
  };

  function onButtonKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (open) {
      closeOnEscape(e);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onListKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (closeOnEscape(e)) return;
    if (e.key === 'Tab') setOpen(false);
    else if (moveFocus(e.currentTarget, e.key)) e.preventDefault();
  }

  const option = (set: string) => (
    <SetOption key={set} setCode={set} progress={progress?.get(set)} selected={set === setCode} onPick={pick} />
  );
  const promoSets = sets.filter(isPromoSet);

  return (
    <div ref={wrapperRef} style={{position: 'relative'}}>
      <Trigger
        setCode={setCode}
        setCount={sets.length}
        open={open}
        listId={listId}
        disabled={setsLoading}
        onToggle={() => setOpen(!open)}
        onKeyDown={onButtonKeyDown}
        onBlur={closeOnLeave}
      />
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Binder set"
          tabIndex={-1}
          style={LIST_STYLE}
          onKeyDown={onListKeyDown}
          onBlur={closeOnLeave}>
          <div role="presentation" style={PINNED_STYLE}>
            <SetOption
              setCode={WHOLE_COLLECTION}
              progress={progress?.get(WHOLE_COLLECTION)}
              selected={setCode === WHOLE_COLLECTION}
              onPick={pick}
            />
          </div>
          {sets.filter((set) => !isPromoSet(set)).map(option)}
          {promoSets.length > 0 && <PromoSets>{promoSets.map(option)}</PromoSets>}
        </div>
      )}
    </div>
  );
}

/** The heading over the promo sets: the list's capitals, at the panel's 13px floor, ruled off from the sets. */
const GROUP_LABEL_STYLE: CSSProperties = {
  ...CAP_LABEL,
  fontSize: `${FONT_SIZES.base}px`,
  padding: `${SPACING.md}px ${SPACING.xs}px ${SPACING.xs}px`,
  marginTop: SPACING.xs,
  borderTop: `1px solid ${COLORS.surfaceBorder}`,
};

/** The promo sets' rows, a group under their heading. */
function PromoSets({children}: {children: ReactNode}) {
  return (
    <div role="group" aria-label="Promo sets" style={{display: 'flex', flexDirection: 'column', gap: SPACING.xxs}}>
      {/* The group's own name says it to assistive tech. */}
      <div aria-hidden="true" style={GROUP_LABEL_STYLE}>
        Promo sets
      </div>
      {children}
    </div>
  );
}

/**
 * The pinned choice's strip: held at the list's top edge (through its padding) on the
 * list's own ground, ruled off from the sets that scroll under it.
 */
const PINNED_STYLE: CSSProperties = {
  position: 'sticky',
  top: -SPACING.xs,
  zIndex: 1,
  margin: `-${SPACING.xs}px -${SPACING.xs}px ${SPACING.xxs}px`,
  padding: SPACING.xs,
  background: COLORS.surfaceFloating,
  borderBottom: `1px solid ${COLORS.surfaceBorder}`,
};

/**
 * Where the list puts a row that focus scrolls into view: clear of the pinned strip, where
 * the first set sits at rest. The strip is 45px (a 36px row, its 4px padding above and
 * below, the 1px rule), and 4px more part it from the sets. Without the inset, Arrow Up
 * parks a row under the strip, because the browser counts any row inside the scrollport
 * as in view. Measured in Storybook; the rows' padding and type set it.
 */
const PINNED_INSET = 49;

/**
 * Close the list on a press anywhere outside the picker. A press, not a blur: a click
 * doesn't focus a button in Safari, so a blur there can't tell a press outside from a pick.
 */
function useCloseOnPressOutside(open: boolean, ref: RefObject<HTMLElement | null>, setOpen: (open: boolean) => void) {
  useEffect(() => {
    if (!open) return;
    const onPress = (e: PointerEvent) => {
      if (!(e.target instanceof Node && ref.current?.contains(e.target))) setOpen(false);
    };
    document.addEventListener('pointerdown', onPress);
    return () => document.removeEventListener('pointerdown', onPress);
  }, [open, ref, setOpen]);
}

/** Opening puts focus on the open set, in view, as a select does, so the arrows work at once. */
function useFocusOpenSetOnOpen(open: boolean, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const selected = ref.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
    selected?.focus({preventScroll: true});
    selected?.scrollIntoView?.({block: 'nearest'});
  }, [open, ref]);
}

/** Where each key takes focus in the list, from the focused row and the last row's index. */
const MOVES: Record<string, (at: number, last: number) => number> = {
  ArrowDown: (at, last) => Math.min(at + 1, last),
  ArrowUp: (at) => Math.max(at - 1, 0),
  Home: () => 0,
  End: (_, last) => last,
};

/** Move focus through the list's rows for a navigation key; false for any other key. */
function moveFocus(list: HTMLElement, key: string): boolean {
  if (!(key in MOVES)) return false;
  const rows = [...list.querySelectorAll<HTMLElement>('[role="option"]')];
  const at = rows.findIndex((row) => row === document.activeElement);
  rows[MOVES[key](at, rows.length - 1)]?.focus();
  return true;
}

/** How a button is drawn: whether it is open (or the chosen row), and whether it is hovered. */
interface Look {
  on: boolean;
  hovered: boolean;
}

/** The select's own recipe (`SortSelect`): a grey rim, lighter on hover, gold while open. */
function triggerStyle({on: open, hovered}: Look, withArt: boolean): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: `${withArt ? `${LOGO_BOX.width}px ` : ''}minmax(0, 1fr) 14px`,
    alignItems: 'center',
    justifyContent: 'stretch',
    gap: SPACING.sm,
    width: '100%',
    minHeight: TRIGGER_HEIGHT,
    padding: `${SPACING.sm}px ${SPACING.md}px ${SPACING.sm}px ${SPACING.sm}px`,
    borderRadius: `${RADIUS.lg}px`,
    border: `1px solid ${open ? GOLD_GLOW.activeBorder : hovered ? COLORS.gray300 : COLORS.surfaceBorder}`,
    background: COLORS.surfaceRaised,
    boxShadow: open ? GOLD_GLOW.focusRing : 'none',
    color: COLORS.text,
    textAlign: 'left',
    // A select doesn't boop: the kit button's hover scale is dropped.
    transform: undefined,
    transition: `border-color 0.15s ${EASING.snappy}, box-shadow 0.15s ${EASING.snappy}`,
  };
}

const NAME_STYLE: CSSProperties = {
  fontSize: `${FONT_SIZES.lg}px`,
  fontWeight: 700,
  lineHeight: 1.25,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

interface TriggerProps {
  setCode: string;
  /** How many sets the binder can show: the whole collection's first line. */
  setCount: number;
  open: boolean;
  listId: string;
  disabled: boolean;
  onToggle: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onBlur: (e: FocusEvent) => void;
}

/** The whole collection's mark, in the logo's box: three cards fanned, in the brand gold. */
function CollectionMark() {
  return (
    <svg width="44" height="36" viewBox="0 0 44 36" fill="none" aria-hidden="true">
      <rect x="6" y="6" width="18" height="25" rx="2.5" transform="rotate(-14 15 18)" stroke={COLORS.primary} strokeOpacity={0.45} strokeWidth={1.5} />
      <rect x="13" y="4" width="18" height="25" rx="2.5" stroke={COLORS.primary} strokeOpacity={0.7} strokeWidth={1.5} />
      <rect x="20" y="6" width="18" height="25" rx="2.5" transform="rotate(14 29 18)" fill={COLORS.surfaceRaised} stroke={COLORS.primary} strokeWidth={1.5} />
    </svg>
  );
}

/**
 * The button's picture: the set's logo, the promo symbol for a promo set, or the whole
 * collection's mark. Undefined when a set has no logo.
 */
function choiceArt(choice: string) {
  if (choice === WHOLE_COLLECTION) return <CollectionMark />;
  if (isPromoSet(choice)) return <RaritySymbol rarity="special" size={32} />;
  const logo = SET_LOGOS[choice];
  return logo === undefined ? undefined : <img src={logo} alt="" style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'}} />;
}

/**
 * The button's first line: how many sets the whole collection holds, or what the set is
 * ("Set 11", "Promo set · P1").
 */
function triggerKicker(setCode: string, setCount: number): string {
  if (setCode === WHOLE_COLLECTION) return `${setCount} sets`;
  return isPromoSet(setCode) ? `Promo set · ${setCode}` : `Set ${setCode}`;
}

/** The button: the choice's picture, its two lines, and a chevron that turns over while open. */
function Trigger({setCode, setCount, open, listId, disabled, onToggle, onKeyDown, onBlur}: TriggerProps) {
  const {hovered, hoverProps} = useHover();
  const whole = setCode === WHOLE_COLLECTION;
  const art = choiceArt(setCode);
  return (
    <CtaButton
      variant="neutral"
      {...hoverProps}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-label={`Binder set: ${choiceLabel(setCode)}`}
      disabled={disabled}
      onClick={onToggle}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      style={triggerStyle({on: open, hovered: hovered && !disabled}, art !== undefined)}>
      {art !== undefined && <span style={LOGO_BOX}>{art}</span>}
      <span style={{minWidth: 0, display: 'flex', flexDirection: 'column', gap: SPACING.xxs}}>
        <span style={{fontSize: `${FONT_SIZES.base}px`, lineHeight: 1.25, color: COLORS.textMuted}}>
          {triggerKicker(setCode, setCount)}
        </span>
        <span style={NAME_STYLE}>{whole ? 'Whole collection' : setName(setCode)}</span>
      </span>
      <svg
        width="14"
        height="8"
        viewBox="0 0 10 6"
        fill="none"
        aria-hidden="true"
        style={{transform: open ? 'rotate(180deg)' : undefined, transition: `transform 0.15s ${EASING.snappy}`}}>
        <path d="M1 1l4 4 4-4" stroke={COLORS.text} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </CtaButton>
  );
}

const LIST_STYLE: CSSProperties = {
  position: 'absolute',
  // Over the controls below, whose kit buttons paint in their own layers.
  zIndex: 2,
  top: `calc(100% + ${SPACING.xs}px)`,
  left: 0,
  right: 0,
  maxHeight: LIST_MAX_HEIGHT,
  overflowY: 'auto',
  scrollPaddingTop: PINNED_INSET,
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.xxs,
  padding: SPACING.xs,
  background: COLORS.surfaceFloating,
  border: `1px solid ${COLORS.surfaceBorder}`,
  borderRadius: `${RADIUS.lg}px`,
  boxShadow: SHADOWS.panel,
};

/**
 * The kit's neutral button as a list row: gold-ringed for the open set, washed on hover. Its
 * first column fits a promo set's code ("RPH"), where a set has its number (#805).
 */
function optionStyle({on: selected, hovered}: Look): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '34px minmax(0, 1fr) auto',
    alignItems: 'center',
    justifyContent: 'stretch',
    columnGap: SPACING.sm,
    width: '100%',
    minHeight: 0,
    flexShrink: 0,
    padding: `${SPACING.sm}px ${SPACING.xs}px`,
    borderRadius: `${RADIUS.md}px`,
    border: `1px solid ${selected ? GOLD_GLOW.activeBorder : 'transparent'}`,
    background: selected ? GOLD_GLOW.activeBg : hovered ? GOLD_GLOW.hoverBg : 'transparent',
    color: COLORS.text,
    fontSize: `${FONT_SIZES.lg}px`,
    textAlign: 'left',
    // Rows don't boop: a growing row would clip against the list's edge.
    transform: undefined,
    transition: `background 0.15s ${EASING.snappy}`,
  };
}

const percentStyle = (done: boolean): CSSProperties => ({
  ...TABULAR,
  fontSize: `${FONT_SIZES.base}px`,
  color: done ? COLORS.primary : COLORS.textMuted,
  fontWeight: done ? 700 : 400,
});

interface SetOptionProps {
  setCode: string;
  /** Absent while the pool loads: the row then shows no percentage. */
  progress: Progress | undefined;
  selected: boolean;
  onPick: (set: string) => void;
}

/** What a row says of its progress: a percentage, or a dash for a set the filters leave no card in. */
function progressText(progress: Progress): {shown: string; spoken: string} {
  if (progress.cards === 0) return {shown: '–', spoken: 'no matching cards'};
  const percent = percentOf(progress.complete, progress.cards);
  return {shown: `${percent}%`, spoken: `${percent}% complete`};
}

/** One choice in the list: a set's number and name, or the whole collection, and how far through it you are. */
function SetOption({setCode, progress, selected, onPick}: SetOptionProps) {
  const {hovered, hoverProps} = useHover();
  const whole = setCode === WHOLE_COLLECTION;
  const text = progress ? progressText(progress) : null;
  return (
    <CtaButton
      variant="neutral"
      {...hoverProps}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      aria-label={`${choiceLabel(setCode)}${text === null ? '' : `: ${text.spoken}`}`}
      // A promo set's name can run past the row: whole on hover.
      title={isPromoSet(setCode) ? setName(setCode) : undefined}
      onClick={() => onPick(setCode)}
      style={{...optionStyle({on: selected, hovered}), fontWeight: whole ? 700 : 500}}>
      <span style={{...TABULAR, fontSize: `${FONT_SIZES.base}px`, color: COLORS.textMuted, textAlign: 'right'}}>
        {whole ? '' : setCode}
      </span>
      <span style={TRUNCATE}>{whole ? 'Whole collection' : setName(setCode)}</span>
      {progress && text && <span style={percentStyle(isFinished(progress.complete, progress.cards))}>{text.shown}</span>}
    </CtaButton>
  );
}
