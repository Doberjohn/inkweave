import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from 'react';
import Skeleton from 'react-loading-skeleton';
import {CtaButton} from '../../shared/components';
import {useHover} from '../../shared/hooks/useHover';
import {useResponsive} from '../../shared/hooks/useResponsive';
import {RaritySymbol} from '../reveals/RaritySymbol';
import loreSymbol from '../../assets/lore.webp?no-inline';
import {isFinished, percentOf} from './collectionStats';
import {
  ALL_PROMO_SETS,
  WHOLE_COLLECTION,
  isPromoScope,
  isPromoSet,
  scopeName,
  setLabel,
  setName,
  spansSets,
} from './binderCards';
import {Segment, Segments} from './Segments';
import {useCloseOnPressOutside} from './useCloseOnPressOutside';
import {SIDE_PANEL_WIDTH} from '../cards/components/BrowseSidePanel';
import {
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
  /** The set the binder shows, `WHOLE_COLLECTION` or `ALL_PROMO_SETS`. */
  setCode: string;
  /** The sets the binder can show, newest first. */
  sets: string[];
  /** True while that list is still loading: the picker waits for it. */
  setsLoading: boolean;
  onSetChange: (set: string) => void;
  /**
   * Each set's progress by code, the whole collection's under `WHOLE_COLLECTION` and every
   * promo set's under `ALL_PROMO_SETS`, once the pool is in, so each row can show its percentage.
   */
  progress: ReadonlyMap<string, Progress> | null;
  /**
   * Where the button is drawn: the panel's two lines (the default); the desktop toolbar's,
   * beside Collection (owner, 2026-10-20), as tall as the toolbar's controls, a short label
   * and no picture; or the phone binder's row (owner, 2026-10-25, #969), a small logo and the
   * scope's name over its `figures`.
   */
  size?: TriggerSize;
  /** The row's figures, or none while the numbers load: a shimmer then holds their line. */
  figures?: RowFigures;
  /** The page's Rarity filter picks the promos: the whole collection's menu opens on Promo. */
  picksPromos?: boolean;
}

/** Where the button is drawn (see `SetPickerProps.size`). */
type TriggerSize = 'panel' | 'toolbar' | 'row';

/**
 * The row button's figures, the headlines' percentages: as drawn, "73% · 19%", and in words
 * for its name, "73% complete, 19% master" (#969).
 */
export interface RowFigures {
  shown: string;
  words: string;
}

/**
 * What the picker calls a choice: "Whole collection", "All promo sets", "Set 11, Winterspell",
 * or "Promo set P1, Promo Set 1".
 */
const choiceLabel = (choice: string) => (spansSets(choice) ? scopeName(choice) : setLabel(choice));

/** The menu's first row in either tab (owner, 2026-10-20): the whole collection, or every promo set. */
const ALL_SETS = 'All sets';

/**
 * The picker's own words for a scope spanning sets: the toolbar button's, in its 71px, and
 * the name that holds them, and the menu's first row's name, which holds its "All sets".
 */
const SPAN_WORDS: Record<string, {compact: string; compactName: string; rowName: string}> = {
  [WHOLE_COLLECTION]: {compact: ALL_SETS, compactName: 'All sets, the whole collection', rowName: 'All sets, the whole collection'},
  [ALL_PROMO_SETS]: {compact: 'Promos', compactName: 'Promos, every promo set', rowName: 'All sets, every promo set'},
};

/** The logo's box. Logos run from 1.4:1 to 3.3:1, so the box is fixed and the art contained. */
const LOGO_BOX: CSSProperties = {width: 64, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center'};

/** The button's geometry where it is drawn. */
interface TriggerGeometry {
  height: number;
  /** The picture's box. Without one, the button holds its words alone. */
  logoBox?: CSSProperties;
  /** The chevron's drawn size; its column is its width. */
  chevron: {width: number; height: number};
  gap: number;
  padding: string;
}

/**
 * The panel's two-line button: room for a two-line name ("Attack of the Vine!") under the
 * set's number, so switching sets never moves what sits below the picker.
 */
const PANEL_TRIGGER: TriggerGeometry = {
  height: 72,
  logoBox: LOGO_BOX,
  chevron: {width: 14, height: 8},
  gap: SPACING.sm,
  padding: `${SPACING.sm}px ${SPACING.md}px ${SPACING.sm}px ${SPACING.sm}px`,
};

/**
 * The toolbar's button: as tall as Collection beside it (`ToolbarToggle`), in the 111px the
 * set panel's width leaves it beside Collection and the gear (owner, 2026-10-20). Its words
 * alone, with no picture (owner, 2026-10-20), and the select's small chevron: 71px for the
 * label.
 */
const TOOLBAR_TRIGGER: TriggerGeometry = {
  height: 34,
  chevron: {width: 10, height: 6},
  gap: SPACING.xs,
  padding: `0 ${SPACING.md}px`,
};

/**
 * The phone binder row's button (owner, 2026-10-25, #969): as tall as Binder options beside
 * it, a small logo, the scope's name over its figures. Its list is the panel's.
 */
const ROW_TRIGGER: TriggerGeometry = {
  height: 40,
  logoBox: {...LOGO_BOX, width: 44, height: 26},
  chevron: {width: 10, height: 6},
  gap: SPACING.sm,
  padding: `0 ${SPACING.md}px 0 ${SPACING.xs}px`,
};

/** The row's button on the narrowest phones: its words alone, inset as the toolbar's are. */
const NARROW_ROW_TRIGGER: TriggerGeometry = {...ROW_TRIGGER, logoBox: undefined, padding: TOOLBAR_TRIGGER.padding};

const TRIGGERS: Record<TriggerSize, TriggerGeometry> = {panel: PANEL_TRIGGER, toolbar: TOOLBAR_TRIGGER, row: ROW_TRIGGER};

/** Below this window width the row's button leaves its logo out, so at 320px its words keep 93px (#969). */
const ROW_LOGO_MIN_WIDTH = 360;

/** The button's geometry where it is drawn: the row's, on the narrowest phones, without its logo. */
function triggerGeometry(size: TriggerSize, windowWidth: number): TriggerGeometry {
  return size === 'row' && windowWidth < ROW_LOGO_MIN_WIDTH ? NARROW_ROW_TRIGGER : TRIGGERS[size];
}

/**
 * The tabs and about ten rows, past which the list scrolls. Half the window at most, so on
 * a short laptop (about 650px tall) the menu still ends inside the panel it opens over.
 */
const MENU_MAX_HEIGHT = 'min(440px, 50vh)';

/**
 * The binder's set picker (owner, 2026-10-12, layout B of `public/mockups/collection-panel-tabs.html`):
 * a button with the open set's logo and name, opening a list of the sets with how far
 * through each you are. The one place the binder's set is chosen.
 *
 * THE MENU OPENS ON TABS, STANDARD / PROMO (owner, 2026-10-20), drawn as All / Owned /
 * Missing are, Promo with the promo symbol; their lists are named in full, Standard sets
 * and Promo sets. Each list starts with All sets: under Standard the whole collection,
 * every set in the binder and the panel's numbers (owner, 2026-10-12; it was a row pinned
 * over the sets, then a tab of its own), and under Promo every promo set (owner,
 * 2026-10-20, `ALL_PROMO_SETS`). The menu opens on the open choice's tab, Standard for
 * the whole collection, or Promo while the page's Rarity filter picks the promos.
 *
 * A PROMO SET IS LISTED BY THE CODE PRINTED ON ITS CARDS (owner, 2026-10-17, #805), where a
 * set has its number, newest first as the sets go, and Curator's Collection by CC, the
 * letters its editions' codes share (owner, 2026-10-19). The two-line button shows the promo
 * symbol for a logo.
 *
 * ON DESKTOP IT SITS IN THE TOOLBAR, BESIDE COLLECTION (owner, 2026-10-20): it, Collection and
 * the collection's actions span the set panel as Filters and the sort span the filters panel,
 * so it is 111px wide and as tall as Collection, a short label with no picture (`size`
 * "toolbar"): "All sets", "Set 13" or "P1". Its menu stays the panel's width. The set panel
 * starts at what the binder shows. The tablet rail's panel keeps the two-line button.
 *
 * ON A PHONE IT LEADS THE BINDER'S ROW (owner, 2026-10-25, #969): 40px tall beside Binder
 * options and Collection, a small logo, and the scope's name over its two percentages, "73% ·
 * 19%", at 13px, the panel's smallest type. Its name says them in words after its visible
 * text: "Binder set: Winterspell, 73% · 19%: 73% complete, 19% master".
 *
 * A popup in the select's manner: opening focuses the open choice. Up, down, Home and End
 * move down a column, the chosen tab over the sets, and left and right move along the
 * tabs, round from either end, each showing its sets. Escape closes it and gives focus
 * back to the button, and Tab or a press outside closes it.
 */
export function SetPicker({
  setCode,
  sets,
  setsLoading,
  onSetChange,
  progress,
  size = 'panel',
  figures,
  picksPromos = false,
}: SetPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useCloseOnPressOutside(open, wrapperRef, setOpen);

  const close = () => {
    setOpen(false);
    wrapperRef.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus();
  };
  const pick = (set: string) => {
    onSetChange(set);
    close();
  };
  /** Escape closes the menu back onto the button. Ours alone: the page must not also act on it. */
  const closeOnEscape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return false;
    e.preventDefault();
    e.stopPropagation();
    close();
    return true;
  };
  /** Keyboard focus leaving the picker closes the menu. A press outside is the effect's: see there. */
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

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (closeOnEscape(e)) return;
    if (e.key === 'Tab') setOpen(false);
    else if (moveFocus(e.currentTarget, e.key)) e.preventDefault();
  }

  return (
    <div ref={wrapperRef} style={{position: 'relative'}}>
      <Trigger
        setCode={setCode}
        sets={sets}
        size={size}
        figures={figures}
        open={open}
        menuId={menuId}
        disabled={setsLoading}
        onToggle={() => setOpen(!open)}
        onKeyDown={onButtonKeyDown}
        onBlur={closeOnLeave}
      />
      {open && (
        <SetMenu
          id={menuId}
          setCode={setCode}
          sets={sets}
          progress={progress}
          picksPromos={picksPromos}
          onPick={pick}
          onKeyDown={onMenuKeyDown}
          onBlur={closeOnLeave}
        />
      )}
    </div>
  );
}

/** Which sets the menu lists. */
type MenuTab = 'standard' | 'promo';

/**
 * The tab the menu opens on: the open choice's own, Promo for a promo set or every one and
 * Standard for a set, and for the whole collection Standard, or Promo while the page's
 * Rarity filter picks the promos (owner, 2026-10-20).
 */
function openingTab({setCode, picksPromos}: Pick<SetMenuProps, 'setCode' | 'picksPromos'>): MenuTab {
  if (isPromoScope(setCode)) return 'promo';
  return picksPromos && setCode === WHOLE_COLLECTION ? 'promo' : 'standard';
}

interface SetMenuProps {
  id: string;
  setCode: string;
  sets: string[];
  progress: SetPickerProps['progress'];
  picksPromos: boolean;
  onPick: (set: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onBlur: (e: FocusEvent) => void;
}

/**
 * The open menu: the tabs, then the sets the chosen tab lists, All sets first in both
 * (owner, 2026-10-20). A binder with no promo set has nothing to choose between, so no tabs.
 */
function SetMenu({id, setCode, sets, progress, picksPromos, onPick, onKeyDown, onBlur}: SetMenuProps) {
  const [tab, setTab] = useState<MenuTab>(() => openingTab({setCode, picksPromos}));
  const menuRef = useRef<HTMLDivElement>(null);
  useFocusOpenChoiceOnMount(menuRef);
  const promoSets = sets.filter(isPromoSet);
  const listed = tab === 'promo' ? promoSets : sets.filter((set) => !isPromoSet(set));
  // All sets: the whole collection under Standard sets, every promo set under Promo sets.
  const allSets = tab === 'promo' ? ALL_PROMO_SETS : WHOLE_COLLECTION;
  /** A list's tab shows its sets and keeps the focus, which Safari doesn't give a pressed button. */
  const show = (next: MenuTab) => (e: MouseEvent<HTMLButtonElement>) => {
    setTab(next);
    e.currentTarget.focus();
  };
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the menu's keys: the arrows move through it, Escape and Tab close it
    <div
      ref={menuRef}
      id={id}
      role="dialog"
      aria-label="Binder set"
      tabIndex={-1}
      style={MENU_STYLE}
      onKeyDown={onKeyDown}
      onBlur={onBlur}>
      {promoSets.length > 0 && (
        <Segments label="Sets" columns="repeat(2, 1fr)">
          <Segment
            label="Standard"
            icon={<LoreSymbol size={16} />}
            active={tab === 'standard'}
            tabIndex={-1}
            onSelect={show('standard')}
          />
          <Segment
            label="Promo"
            icon={<RaritySymbol rarity="special" size={16} />}
            active={tab === 'promo'}
            tabIndex={-1}
            onSelect={show('promo')}
          />
        </Segments>
      )}
      <div role="listbox" aria-label={tab === 'promo' ? 'Promo sets' : 'Standard sets'} tabIndex={-1} style={LIST_STYLE}>
        <div role="presentation" style={ALL_SETS_STYLE}>
          <SetOption setCode={allSets} progress={progress?.get(allSets)} selected={setCode === allSets} onPick={onPick} />
        </div>
        {listed.map((set) => (
          <SetOption key={set} setCode={set} progress={progress?.get(set)} selected={set === setCode} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

/** All sets' place at the top of each list, ruled off from the sets under it. */
const ALL_SETS_STYLE: CSSProperties = {
  flexShrink: 0,
  paddingBottom: SPACING.xxs,
  marginBottom: SPACING.xxs,
  borderBottom: `1px solid ${COLORS.surfaceBorder}`,
};

/**
 * Opening puts focus on the open choice's row, in view, as a select does, so the arrows
 * work at once. Failing that, the chosen tab.
 */
function useFocusOpenChoiceOnMount(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const menu = ref.current;
    const choice =
      menu?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]') ??
      menu?.querySelector<HTMLElement>('[aria-pressed="true"]');
    choice?.focus({preventScroll: true});
    choice?.scrollIntoView?.({block: 'nearest'});
  }, [ref]);
}

type Move = (at: number, last: number) => number;

/** Where each key takes focus down the menu's column, from the focused place and the last one's index. */
const MOVES: Record<string, Move> = {
  ArrowDown: (at, last) => Math.min(at + 1, last),
  ArrowUp: (at) => Math.max(at - 1, 0),
  Home: () => 0,
  End: (_, last) => last,
};

/** Where the arrows take focus along the tabs, round from either end. */
const ALONG: Record<string, Move> = {
  ArrowRight: (at, last) => (at === last ? 0 : at + 1),
  ArrowLeft: (at, last) => (at === 0 ? last : at - 1),
};

/**
 * Move focus through the menu for a navigation key; false for any other key. Left and
 * right move along the tabs, pressing the one they reach, so the sets under the focus are
 * always its own. The rest move down a column: the focused tab, or else the chosen one,
 * over the list, so up from All sets reaches the tabs.
 */
function moveFocus(menu: HTMLElement, key: string): boolean {
  const tabs = [...menu.querySelectorAll<HTMLElement>('[aria-pressed]')];
  const onTab = tabs.findIndex((tab) => tab === document.activeElement);
  if (onTab >= 0 && key in ALONG) {
    // Its press shows its sets and focuses it (`SetMenu`'s `show`).
    tabs[ALONG[key](onTab, tabs.length - 1)].click();
    return true;
  }
  if (!(key in MOVES)) return false;
  // With no tabs (no promo set to list), the column is the sets alone.
  const top = tabs[onTab] ?? tabs.find((tab) => tab.getAttribute('aria-pressed') === 'true');
  const column = [...(top ? [top] : []), ...menu.querySelectorAll<HTMLElement>('[role="option"]')];
  // From nowhere in the column (the list's own padding, say), the arrows start at the top.
  const at = Math.max(
    column.findIndex((place) => place === document.activeElement),
    0,
  );
  column[MOVES[key](at, column.length - 1)]?.focus();
  return true;
}

/** How a button is drawn: whether it is open (or the chosen row), and whether it is hovered. */
interface Look {
  on: boolean;
  hovered: boolean;
}

/** What the button holds: a picture or none, and where it is drawn. */
interface Shape {
  withArt: boolean;
  geometry: TriggerGeometry;
}

/** The select's own recipe (`SortSelect`): a grey rim, lighter on hover, gold while open. */
function triggerStyle({on: open, hovered}: Look, {withArt, geometry}: Shape): CSSProperties {
  const artColumn = withArt && geometry.logoBox ? `${geometry.logoBox.width}px ` : '';
  return {
    display: 'grid',
    gridTemplateColumns: `${artColumn}minmax(0, 1fr) ${geometry.chevron.width}px`,
    alignItems: 'center',
    justifyContent: 'stretch',
    gap: geometry.gap,
    width: '100%',
    minHeight: geometry.height,
    padding: geometry.padding,
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
  /** The sets the binder can show, which a scope spanning them counts on its first line. */
  sets: readonly string[];
  size: TriggerSize;
  figures: RowFigures | undefined;
  open: boolean;
  menuId: string;
  disabled: boolean;
  onToggle: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onBlur: (e: FocusEvent) => void;
}

/**
 * The lore symbol (owner, 2026-10-20): before Standard, as the promo symbol is before Promo,
 * and the whole collection's picture on the two-line button, where three fanned cards were. Drawn the
 * way `RaritySymbol` draws it. A gold glyph keyed off its white ground, 48px for sharp
 * screens: the Lorcana hexagon tried first read barely at 16px.
 */
function LoreSymbol({size}: {size: number}) {
  return (
    <img
      src={loreSymbol}
      alt=""
      aria-hidden
      width={size}
      height={size}
      style={{display: 'block', flexShrink: 0, objectFit: 'contain'}}
    />
  );
}

/**
 * The button's picture: the set's logo, the promo symbol for one promo set or every one, or
 * the lore symbol for the whole collection, sized as the promo symbol is to the box it fills.
 * Undefined when a set has no logo.
 */
function choiceArt(choice: string, box: CSSProperties) {
  const height = Number(box.height);
  if (choice === WHOLE_COLLECTION) return <LoreSymbol size={height - 8} />;
  if (isPromoScope(choice)) return <RaritySymbol rarity="special" size={height - 8} />;
  const logo = SET_LOGOS[choice];
  return logo === undefined ? undefined : <img src={logo} alt="" style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'}} />;
}

/**
 * The button's first line: how many sets a scope spanning them holds ("26 sets", "12 promo
 * sets"), or what the set is ("Set 11", "Promo set · P1").
 */
function triggerKicker(setCode: string, sets: readonly string[]): string {
  if (setCode === WHOLE_COLLECTION) return `${sets.length} sets`;
  if (setCode === ALL_PROMO_SETS) return `${sets.filter(isPromoSet).length} promo sets`;
  return isPromoSet(setCode) ? `Promo set · ${setCode}` : `Set ${setCode}`;
}

/**
 * The toolbar button's label, in the 71px its 111px leave beside the chevron (owner,
 * 2026-10-20): "All sets" for the whole collection, "Promos" for every promo set, a set's
 * number ("Set 13"), or a promo set's code ("P1"), each named in full on hover. A name
 * runs past the room: "Whole collection" would need 115px, and the sets' names up to 137px.
 */
function compactLabel(setCode: string): string {
  return SPAN_WORDS[setCode]?.compact ?? (isPromoSet(setCode) ? setCode : `Set ${setCode}`);
}

/**
 * The button's name: the choice, with the toolbar's words in it for a scope spanning sets; the
 * row's, its visible text and then its figures in words (#969).
 */
function triggerName({setCode, size, figures}: Pick<TriggerProps, 'setCode' | 'size' | 'figures'>): string {
  if (size === 'row') return `Binder set: ${scopeName(setCode)}${figures ? `, ${figures.shown}: ${figures.words}` : ''}`;
  return `Binder set: ${(size === 'toolbar' ? SPAN_WORDS[setCode]?.compactName : undefined) ?? choiceLabel(setCode)}`;
}

/** Each of the row's two lines: 13px, the set panel's smallest type. */
const ROW_LINE: CSSProperties = {fontSize: `${FONT_SIZES.base}px`, lineHeight: 1.25};

/** The figures' line: gold, as the strip's figures were, in tabular digits. */
const ROW_FIGURES: CSSProperties = {...ROW_LINE, ...TABULAR, color: COLORS.primary, whiteSpace: 'nowrap'};

/** What the figures' shimmer leaves of their line, above and below, so the line keeps its height. */
const SHIMMER_INSET = SPACING.xxs;

/**
 * The row's words: the scope's name, cut short, over its figures, or a 60px shimmer holding
 * their line while the numbers load.
 */
function RowLabel({setCode, figures}: Pick<TriggerProps, 'setCode' | 'figures'>) {
  return (
    <span style={{minWidth: 0, display: 'flex', flexDirection: 'column'}}>
      <span style={{...ROW_LINE, ...TRUNCATE, fontWeight: 700}}>{scopeName(setCode)}</span>
      {figures ? (
        <span style={ROW_FIGURES}>{figures.shown}</span>
      ) : (
        <span style={{...ROW_FIGURES, display: 'flex', padding: `${SHIMMER_INSET}px 0`, height: '1.25em'}}>
          <Skeleton inline width={60} style={{display: 'block', height: '100%'}} />
        </span>
      )}
    </span>
  );
}

/** The button's words: the kicker over the name in the panel, the toolbar's short label, or the row's two lines. */
function TriggerLabel({setCode, sets, size, figures}: Pick<TriggerProps, 'setCode' | 'sets' | 'size' | 'figures'>) {
  if (size === 'row') return <RowLabel setCode={setCode} figures={figures} />;
  if (size === 'toolbar') {
    return <span style={{...TRUNCATE, fontSize: `${FONT_SIZES.lg}px`, fontWeight: 700}}>{compactLabel(setCode)}</span>;
  }
  return (
    <span style={{minWidth: 0, display: 'flex', flexDirection: 'column', gap: SPACING.xxs}}>
      <span style={KICKER_STYLE}>{triggerKicker(setCode, sets)}</span>
      <span style={NAME_STYLE}>{scopeName(setCode)}</span>
    </span>
  );
}

const KICKER_STYLE: CSSProperties = {fontSize: `${FONT_SIZES.base}px`, lineHeight: 1.25, color: COLORS.textMuted};

/**
 * The button: the choice's picture (the two-line button's and the row's), its words, and a
 * chevron that turns over while open.
 */
function Trigger({setCode, sets, size, figures, open, menuId, disabled, onToggle, onKeyDown, onBlur}: TriggerProps) {
  const {hovered, hoverProps} = useHover();
  const {windowWidth} = useResponsive();
  const geometry = triggerGeometry(size, windowWidth);
  const art = geometry.logoBox && choiceArt(setCode, geometry.logoBox);
  return (
    <CtaButton
      variant="neutral"
      {...hoverProps}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      aria-label={triggerName({setCode, size, figures})}
      // The toolbar's short label names a set by its number or code alone: whole on hover.
      title={size === 'toolbar' ? choiceLabel(setCode) : undefined}
      disabled={disabled}
      onClick={onToggle}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      style={triggerStyle({on: open, hovered: hovered && !disabled}, {withArt: art !== undefined, geometry})}>
      {art !== undefined && <span style={geometry.logoBox}>{art}</span>}
      <TriggerLabel setCode={setCode} sets={sets} size={size} figures={figures} />
      <svg
        width={geometry.chevron.width}
        height={geometry.chevron.height}
        viewBox="0 0 10 6"
        fill="none"
        aria-hidden="true"
        style={{transform: open ? 'rotate(180deg)' : undefined, transition: `transform 0.15s ${EASING.snappy}`}}>
        <path d="M1 1l4 4 4-4" stroke={COLORS.text} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </CtaButton>
  );
}

/**
 * The menu: its tabs held at the top, and the list under them, which scrolls on its own.
 * At least a side panel wide, the room its tabs' words take, however narrow the button.
 */
const MENU_STYLE: CSSProperties = {
  position: 'absolute',
  // Over the controls below, whose kit buttons paint in their own layers, and over the
  // binder's count pills (`CollectionSlotCounts`, 3), which a phone's menu opens over.
  zIndex: 4,
  top: `calc(100% + ${SPACING.xs}px)`,
  left: 0,
  right: 0,
  minWidth: SIDE_PANEL_WIDTH,
  maxHeight: MENU_MAX_HEIGHT,
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.xs,
  padding: SPACING.xs,
  background: COLORS.surfaceFloating,
  border: `1px solid ${COLORS.surfaceBorder}`,
  borderRadius: `${RADIUS.lg}px`,
  boxShadow: SHADOWS.panel,
};

const LIST_STYLE: CSSProperties = {
  minHeight: 0,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.xxs,
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

/** One choice in the list: a set's number and name, or All sets, and how far through it you are. */
function SetOption({setCode, progress, selected, onPick}: SetOptionProps) {
  const {hovered, hoverProps} = useHover();
  const spans = spansSets(setCode);
  const text = progress ? progressText(progress) : null;
  return (
    <CtaButton
      variant="neutral"
      {...hoverProps}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      aria-label={`${SPAN_WORDS[setCode]?.rowName ?? setLabel(setCode)}${text === null ? '' : `: ${text.spoken}`}`}
      // A promo set's name can run past the row: whole on hover.
      title={isPromoSet(setCode) ? setName(setCode) : undefined}
      onClick={() => onPick(setCode)}
      style={{...optionStyle({on: selected, hovered}), fontWeight: spans ? 700 : 500}}>
      {/* Centered in its column (owner, 2026-10-20), a number and a promo code alike. */}
      <span style={{...TABULAR, fontSize: `${FONT_SIZES.base}px`, color: COLORS.textMuted, textAlign: 'center'}}>
        {spans ? '' : setCode}
      </span>
      <span style={TRUNCATE}>{spans ? ALL_SETS : setName(setCode)}</span>
      {progress && text && <span style={percentStyle(isFinished(progress.complete, progress.cards))}>{text.shown}</span>}
    </CtaButton>
  );
}
