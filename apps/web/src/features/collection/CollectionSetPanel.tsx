import {createContext, useContext, useState, type CSSProperties, type ReactNode} from 'react';
import Skeleton from 'react-loading-skeleton';
import type {Ink} from 'inkweave-synergy-engine';
import {CtaButton, IconButton, InkIcon} from '../../shared/components';
import {useHover} from '../../shared/hooks/useHover';
import {usePrefersReducedMotion} from '../../shared/utils/prefersReducedMotion';
import {RaritySymbol} from '../reveals/RaritySymbol';
import {rarityLabel} from '../cards/filterOptions';
import {isFinished, percentOf, type tallyCollection, type tallySet} from './collectionStats';
import {WHOLE_COLLECTION, isPromoSet, setName, type BinderShow} from './binderCards';
import {SetPicker, type SetPickerProps} from './SetPicker';
import {SIDE_PANEL_STYLE} from '../cards/components/BrowseSidePanel';
import {
  ALL_INKS,
  COLORS,
  DURATION,
  EASING,
  FONT_SIZES,
  GOLD_GLOW,
  RADIUS,
  SPACING,
  TABULAR,
  TRUNCATE,
  hexRgba,
  whiteRgba,
} from '../../shared/constants';

/**
 * The collection panel beside the binder (#553 Phase C). Layout B of the second
 * 2026-10-12 mockup (`public/mockups/collection-panel-tabs.html`), owner's pick:
 *
 *   - THE BINDER'S CONTROLS ON TOP, ITS NUMBERS UNDER THEM. The set picker and All /
 *     Owned / Missing drive the binder and stay put; the numbers under them scroll on
 *     their own.
 *   - THE NUMBERS DESCRIBE WHAT THE PICKER SHOWS (owner, 2026-10-12): a set, or the whole
 *     collection, pinned first in the picker, in the same blocks. It replaced "This set"
 *     and "Collection" tabs, which switched the numbers alone. See
 *     `public/mockups/collection-whole.html`. The collection's copies, foils and playsets
 *     row went (owner, 2026-10-15).
 *   - THE NUMBERS FOLLOW THE FILTERS (owner, 2026-10-15): with a search or a filter on,
 *     every number counts only the cards it lets through, the picker's percentages too.
 *     The headlines drop their noun; a count line above them was tried and dropped the
 *     same day. See `CollectionSetPanelProps.filtered`.
 *   - TYPE YOU CAN READ: 13px at the smallest, 14px for names and headings, 28px for the
 *     headline. The day's first layout (every set in one list, the open one unfolded, 10px
 *     counts under rings and gems) was rejected as cluttered and unreadable.
 *   - THE SET IS CHOSEN HERE AND ONLY HERE. The filters panel drops its Set section in
 *     collection mode, so the two sides can no longer disagree.
 *   - OWNED / MISSING IS A VIEW OF THE BINDER, not one of the page's filters.
 *   - 100% ONLY WHEN FINISHED: percentages round down (`percentOf`).
 *   - THE HEADLINES CHOOSE WHAT THE BREAKDOWNS COUNT (owner, 2026-10-12): "Complete set"
 *     or "Master set", the chosen one ringed in gold, opening on Complete. It replaced an
 *     automatic switch to master on a finished set (2026-10-07), which only a small grey
 *     "master" announced: a complete Set 13 then read Common 10/72, and was taken for a bug.
 *     The ring is the one cue: the breakdowns' own grey label went (owner, 2026-10-15).
 *   - THE HEADLINES' COUNTS SHOW ON HOVER (owner, 2026-10-15): while a headline is hovered
 *     or focused from the keyboard, its name gives way to its count, "113 of 242 cards", in
 *     the same spot; the percentage stays and nothing moves. A count line opening under the
 *     bar was built first and dropped the same day, since it pushed the panel down; so were
 *     the longer counts' "to go" and "sets" parts. Picked from four in
 *     `public/mockups/collection-bars.html`.
 *   - THE BARS GROW GOLDEN (owner, 2026-10-15; green, gold once full, before): each shows
 *     as much of one gold gradient as it reaches, and turns solid gold, with a glow, when
 *     full. They glide to new lengths and fill from empty on arrival, and a full bar gets
 *     one pass of light once it arrives. None of it moves under reduced motion. See `Bar`.
 *
 * And the earlier rulings it keeps:
 *
 *   - THE HEADLINE IS TWO PROGRESS BARS, complete and master (owner, 2026-10-07).
 *   - EVERY CARD THE BINDER HOLDS COUNTS (owner, 2026-10-15), the chase printings (Epic,
 *     Enchanted, Iconic) in the headline and the inks too, and in rows of their own in the
 *     rarity breakdown (owner, 2026-10-12). The headline counted only the five rarities a
 *     Dreamborn export can contain before (2026-08-14 and 2026-10-07). See `tallySet`.
 *   - A PROMO SET SHOWS COMPLETE SET AND BY INK ONLY (owner, 2026-10-17, #805): its pockets
 *     each hold one printing in one finish, so its master would repeat Complete, and its
 *     cards are all promos, so its rarity rows would be one. The whole collection's numbers
 *     count the promos with the rest, one figure (owner, the same day).
 */

type Tally = ReturnType<typeof tallySet>;
type CollectionStats = ReturnType<typeof tallyCollection>;
type Axis = 'complete' | 'master';

/** What the breakdowns count, chosen with the headlines. */
interface AxisChoice {
  axis: Axis;
  onAxisChange: (axis: Axis) => void;
}

/** Width of the collapsed rail. The open panel's is the side panel's. */
export const RAIL_WIDTH = 44;

/** Export rarity names to `RaritySymbol`'s keys. */
const rarityKey = (rarity: string) => rarity.toLowerCase();

const count = (n: number) => n.toLocaleString('en-US');

/** Which set the binder shows, and the sets it can show. */
export interface SetSwitching {
  /** The set the binder shows, or `WHOLE_COLLECTION` for every set at once. */
  setCode: string;
  /** The sets the binder can show; just the current one while the list loads. */
  sets: string[];
  /** True while the real list is still loading. */
  setsLoading: boolean;
  onSetChange: (set: string) => void;
}

/** What the binder shows, and how to change it. */
export interface BinderView {
  show: BinderShow;
  onShowChange: (show: BinderShow) => void;
}

export interface CollectionSetPanelProps extends SetSwitching, BinderView {
  /**
   * Every set's tally and the whole collection's, or null while the pool loads. While
   * the page's filters or search are on, they count only the cards those let through.
   */
  stats: CollectionStats | null;
  /**
   * The page's filters or search are on: the headlines drop their noun, since the cards
   * counted are no whole set or collection.
   */
  filtered?: boolean;
}

/** Bar heights, by how much the number above them matters. */
const BAR = {headline: 8, second: 6, row: 4} as const;

/** How long a bar takes to glide to a new length, or to fill from empty when it first appears. */
const GLIDE_MS = 700;
/** The one pass of light over a full bar, after its glide. */
const SHEEN_MS = 900;
/** Each bar sets off this long after the one above it, so a change runs down the panel. */
const STAGGER_MS = 20;

/**
 * What the bars describe: the open set (or the whole collection) and what the breakdowns
 * count. A full bar's pass of light plays again when this changes or its own count does,
 * never on a render that changed neither.
 */
const BarPass = createContext('');

/**
 * ONE gold gradient across the whole track, faint at the start and gold at the end, of
 * which a bar shows as much as it reaches: a short bar is faint, and only a nearly full
 * one ends in gold. Sized to the track (`100cqw`; the track is the container), not to the
 * fill, so it holds still while the fill glides.
 */
const GRADIENT: CSSProperties = {
  backgroundImage: `linear-gradient(90deg, ${hexRgba(COLORS.primary, 0.2)}, ${COLORS.primary})`,
  backgroundSize: '100cqw 100%',
  backgroundRepeat: 'no-repeat',
};

/** One pass of light over a full bar (`collection-bar-sheen` in index.css); its delay is the bar's. */
const SHEEN: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: `linear-gradient(100deg, ${whiteRgba(0)} 25%, ${whiteRgba(0.55)} 50%, ${whiteRgba(0)} 75%)`,
  // Parked off the left edge, out of the track's sight, before and after its pass.
  transform: 'translateX(-100%)',
  animationDuration: `${SHEEN_MS}ms`,
  animationTimingFunction: EASING.smooth,
  pointerEvents: 'none',
};

/** What a bar's styles need. */
interface BarLook {
  height: number;
  /** Its length, in whole percent. */
  percent: number;
  full: boolean;
  /** When its glide sets off (ms), or null where motion is off. */
  delay: number | null;
}

/** The track. A full bar's glows, the glow arriving with the bar. */
function trackStyle({height, full, delay}: BarLook): CSSProperties {
  return {
    position: 'relative',
    display: 'block',
    height,
    borderRadius: `${RADIUS.pill}px`,
    background: whiteRgba(0.07),
    overflow: 'hidden',
    // The container the fill's gradient is sized to.
    containerType: 'inline-size',
    boxShadow: full ? `0 0 ${height === BAR.row ? 6 : 8}px ${hexRgba(COLORS.primary, 0.45)}` : 'none',
    transition: delay === null ? undefined : `box-shadow ${DURATION.slow}ms ${EASING.smooth} ${GLIDE_MS + delay}ms`,
  };
}

/**
 * The bar: the gradient, with solid gold laid under it once full, which reads as plain
 * gold and fades in as the bar arrives. It glides to each new length, and fills from
 * empty on arrival (`collection-bar-fill` in index.css), unless motion is off.
 */
function fillStyle({percent, full, delay}: BarLook): CSSProperties {
  const glide = delay === null ? {} : {
    transition: `width ${GLIDE_MS}ms ${EASING.smooth} ${delay}ms, background-color ${GLIDE_MS}ms ${EASING.smooth} ${delay}ms`,
    animationDuration: `${GLIDE_MS}ms`,
    animationTimingFunction: EASING.smooth,
    animationDelay: `${delay}ms`,
  };
  return {
    display: 'block',
    height: '100%',
    width: `${percent}%`,
    borderRadius: `${RADIUS.pill}px`,
    ...GRADIENT,
    backgroundColor: hexRgba(COLORS.primary, full ? 1 : 0),
    ...glide,
  };
}

interface BarProps {
  value: number;
  total: number;
  height: number;
  /** When this bar's glide starts, after the bars above it (ms). */
  delay?: number;
}

/**
 * A progress track (owner, 2026-10-15; green, gold once complete, before): the gradient
 * above, gliding to each new length, and once full, gold with a glow and a pass of light.
 * Spans, not divs, so it can sit inside a headline's button.
 */
function Bar({value, total, height, delay = 0}: BarProps) {
  const motion = !usePrefersReducedMotion();
  const pass = useContext(BarPass);
  const look: BarLook = {height, percent: percentOf(value, total), full: isFinished(value, total), delay: motion ? delay : null};
  const sheen = look.full && motion;
  return (
    <span style={trackStyle(look)}>
      <span className={motion ? 'collection-bar-fill' : undefined} style={fillStyle(look)} />
      {sheen && (
        <span key={`${pass}|${value}/${total}`} className="collection-bar-sheen" style={{...SHEEN, animationDelay: `${GLIDE_MS + delay}ms`}} />
      )}
    </span>
  );
}

const COLUMN: CSSProperties = {display: 'flex', flexDirection: 'column', gap: SPACING.sm};
const SPLIT_ROW: CSSProperties = {display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: SPACING.sm};
const HEADING_STYLE: CSSProperties = {fontSize: `${FONT_SIZES.lg}px`, fontWeight: 600, color: COLORS.text};
const DETAIL_STYLE: CSSProperties = {...TABULAR, fontSize: `${FONT_SIZES.base}px`, color: COLORS.textMuted};

const countStyle = (done: boolean): CSSProperties => ({
  ...DETAIL_STYLE,
  color: done ? COLORS.primary : COLORS.textMuted,
  fontWeight: done ? 700 : 400,
});

interface HeadlineProps {
  label: string;
  value: number;
  total: number;
  /** What its count counts: cards, or a promo set's promos. */
  unit?: 'cards' | 'promos';
  /** The tab's lead number, at display size. */
  lead?: boolean;
  /** When the bar's glide starts (ms): the second headline's sets off a beat after the first's. */
  delay?: number;
}

/**
 * One of the name slot's two layers, the name or the count: stacked in one grid cell and
 * crossfading, so swapping them moves nothing.
 */
function layerStyle({shown, motion}: {shown: boolean; motion: boolean}): CSSProperties {
  return {
    ...TRUNCATE,
    gridArea: '1 / 1',
    alignSelf: 'center',
    opacity: shown ? 1 : 0,
    transition: motion ? `opacity ${DURATION.fast}ms ${EASING.smooth}` : undefined,
  };
}

/**
 * A headline's insides: its name and percentage, then the bar. While the headline is
 * attended (hovered, or focused from the keyboard) the name gives way to its count,
 * "113 of 242 cards", in the same spot. Spans, so a button can hold them.
 */
function HeadlineBody({
  label,
  value,
  total,
  unit = 'cards',
  lead = false,
  delay = 0,
  attended,
}: HeadlineProps & {attended: boolean}) {
  const motion = !usePrefersReducedMotion();
  return (
    <>
      <span style={SPLIT_ROW}>
        <span style={{display: 'grid', minWidth: 0}}>
          <span style={{...HEADING_STYLE, ...layerStyle({shown: !attended, motion})}}>{label}</span>
          <span style={{...DETAIL_STYLE, ...layerStyle({shown: attended, motion})}}>
            {`${count(value)} of ${count(total)} ${unit}`}
          </span>
        </span>
        <span
          style={{
            ...TABULAR,
            fontSize: `${lead ? FONT_SIZES.displaySm : FONT_SIZES.xl}px`,
            fontWeight: 700,
            lineHeight: 1,
            color: isFinished(value, total) ? COLORS.primary : COLORS.text,
          }}>
          {percentOf(value, total)}%
        </span>
      </span>
      <Bar value={value} total={total} height={lead ? BAR.headline : BAR.second} delay={delay} />
    </>
  );
}

/**
 * How far a choosable headline reaches past the column on each side: its padding and
 * border, so its text stays level with everything else and only the ring stands out.
 */
const HEADLINE_BLEED = SPACING.sm + 1;

/** The kit's neutral button as a headline: ringed in gold while chosen, washed on hover. */
function choosableStyle(chosen: boolean, hovered: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: SPACING.sm,
    width: `calc(100% + ${2 * HEADLINE_BLEED}px)`,
    minHeight: 0,
    margin: `0 -${HEADLINE_BLEED}px`,
    padding: SPACING.sm,
    borderRadius: `${RADIUS.lg}px`,
    border: `1px solid ${chosen ? GOLD_GLOW.activeBorder : 'transparent'}`,
    background: chosen ? GOLD_GLOW.activeBg : hovered ? GOLD_GLOW.hoverBg : 'transparent',
    color: COLORS.text,
    textAlign: 'left',
    // No boop: a growing headline would overhang the panel.
    transform: undefined,
    transition: `background 0.15s ${EASING.snappy}, border-color 0.15s ${EASING.snappy}`,
  };
}

/** Whether focus came from the keyboard (`:focus-visible`); where a browser cannot say, any focus counts. */
function focusedByKeyboard(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

/**
 * A headline that, chosen, sets what the breakdowns under it count. While it is hovered or
 * focused from the keyboard, its name gives way to its count; a click's focus leaves that
 * to the hover. Where nothing hovers, the names stay: a count standing in for a name would
 * leave a headline unnamed.
 */
function ChoosableHeadline({chosen, onChoose, ...props}: HeadlineProps & {chosen: boolean; onChoose: () => void}) {
  const {hovered, hoverProps} = useHover();
  const [keyboard, setKeyboard] = useState(false);
  return (
    <CtaButton
      variant="neutral"
      {...hoverProps}
      aria-pressed={chosen}
      onClick={onChoose}
      onFocus={(e) => setKeyboard(focusedByKeyboard(e.currentTarget))}
      onBlur={() => setKeyboard(false)}
      style={choosableStyle(chosen, hovered)}>
      <HeadlineBody {...props} attended={hovered || keyboard} />
    </CtaButton>
  );
}

/**
 * A breakdown under its heading. What it counts is the chosen headline's, ringed in gold,
 * so only its accessible name says so: the grey "complete" / "master" beside the heading
 * went (owner, 2026-10-15).
 */
function Breakdown({title, axis, children}: {title: string; axis: Axis; children: ReactNode}) {
  return (
    <section aria-label={`${title}, ${axis}`} style={{...COLUMN, gap: SPACING.md}}>
      <span style={HEADING_STYLE}>{title}</span>
      {children}
    </section>
  );
}

/** One ink: its symbol and count over a bar. */
function InkCell({ink, value, total, delay}: {ink: Ink; value: number; total: number; delay: number}) {
  return (
    <div title={`${ink}: ${value} of ${total}`} style={{display: 'flex', flexDirection: 'column', gap: SPACING.xs}}>
      <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm}}>
        <InkIcon ink={ink} size={20} decorative={false} />
        <span style={countStyle(isFinished(value, total))}>
          {count(value)}/{count(total)}
        </span>
      </div>
      <Bar value={value} total={total} height={BAR.row} delay={delay} />
    </div>
  );
}

/** A breakdown's slots, what they count, and when the first one's bar sets off (ms). */
interface BreakdownSlots<T> {
  slots: T;
  axis: Axis;
  delay: number;
}

/**
 * By ink: six cells named by their symbols, which every player knows, two to a row for a
 * set and the whole collection alike (owner, 2026-10-15; three for a set before). One
 * layout leaves every ink in its place when the picker switches, for its bar to glide, and
 * gives the bars room to show their gold.
 */
function InkGrid({slots, axis, delay}: BreakdownSlots<Tally['byInk']>) {
  return (
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: SPACING.md}}>
      {/* Canonical ink order, not the data's: the tally lists inks in the order the set's
          cards happen to arrive, which put Sapphire first. */}
      {[...slots]
        .sort((a, b) => ALL_INKS.indexOf(a.ink) - ALL_INKS.indexOf(b.ink))
        .map((slot, i) => (
          <InkCell key={slot.ink} ink={slot.ink} value={slot[axis]} total={slot.total} delay={delay + i * STAGGER_MS} />
        ))}
    </div>
  );
}

/**
 * Symbol, name, bar, count: "Super Rare", "Enchanted" and "72/72" fit the panel's 234px at
 * 14px and 13px. The whole collection's counts ("968/1,012") take room from the bar, and
 * a FIXED width, so every row's bar starts at the same place.
 */
const rarityRow = (wide: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: wide ? '20px minmax(0, 1fr) 34px 66px' : '20px minmax(0, 1fr) 58px 44px',
  columnGap: SPACING.sm,
  alignItems: 'center',
  fontSize: `${FONT_SIZES.lg}px`,
});

/** Between the rarity rows (owner, 2026-10-15): a pixel past the panel's 8, off the 4px scale at the owner's ask. */
const RARITY_GAP = 9;

/** By rarity: a named row each, since rarity symbols are harder to tell apart than ink symbols. */
function RarityRows({slots, axis, wide, delay}: BreakdownSlots<Tally['byRarity']> & {wide: boolean}) {
  return (
    <div style={{...COLUMN, gap: RARITY_GAP}}>
      {slots.map((slot, i) => (
        <div key={slot.rarity} style={rarityRow(wide)}>
          <RaritySymbol rarity={rarityKey(slot.rarity)} size={20} />
          <span style={TRUNCATE}>{rarityLabel(slot.rarity)}</span>
          <Bar value={slot[axis]} total={slot.total} height={BAR.row} delay={delay + i * STAGGER_MS} />
          <span style={{...countStyle(isFinished(slot[axis], slot.total)), textAlign: 'right'}}>
            {count(slot[axis])}/{count(slot.total)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** What a scope's numbers need: a set's tally or the whole collection's totals, one shape, and the headlines' noun. */
type ScopeFigures = Tally & {
  /** "set" or "collection"; none while filtered, since the cards counted are neither. */
  noun: string | undefined;
};

/** The headlines' noun for what the picker shows, or none while the page filters. */
function headlineNoun({whole, filtered}: {whole: boolean; filtered: boolean}): string | undefined {
  if (filtered) return undefined;
  return whole ? 'collection' : 'set';
}

interface ScopeNumbersProps extends AxisChoice {
  figures: ScopeFigures;
  /** The whole collection's five-figure counts, which take room from the rarity rows' bars. */
  wide: boolean;
  /** A promo set's: Complete set and By ink alone (see the header). */
  promo: boolean;
}

/**
 * A scope's numbers, a set's or the whole collection's in the same blocks: the two
 * headlines, which also choose what the breakdowns count, then the breakdowns. A promo set
 * has the first headline and the inks only, which then count it whatever was chosen.
 */
function ScopeNumbers({figures, wide, promo, axis: chosen, onAxisChange}: ScopeNumbersProps) {
  const axis = promo ? 'complete' : chosen;
  return (
    <>
      {/* The group's own gap is small, since each headline brings its padding. */}
      <div role="group" aria-label="What the breakdowns count" style={{...COLUMN, gap: SPACING.xs}}>
        <ChoosableHeadline
          lead
          label={figures.noun ? `Complete ${figures.noun}` : 'Complete'}
          value={figures.complete}
          total={figures.cards}
          unit={promo ? 'promos' : 'cards'}
          chosen={axis === 'complete'}
          onChoose={() => onAxisChange('complete')}
        />
        {!promo && (
          <ChoosableHeadline
            label={figures.noun ? `Master ${figures.noun}` : 'Master'}
            value={figures.master}
            total={figures.cards}
            chosen={axis === 'master'}
            onChoose={() => onAxisChange('master')}
            delay={STAGGER_MS}
          />
        )}
      </div>
      {/* The bars set off in reading order: the two headlines', then the inks', then the rarities'. */}
      <Breakdown title="By ink" axis={axis}>
        <InkGrid slots={figures.byInk} axis={axis} delay={2 * STAGGER_MS} />
      </Breakdown>
      {!promo && (
        <Breakdown title="By rarity" axis={axis}>
          <RarityRows
            slots={figures.byRarity}
            axis={axis}
            wide={wide}
            delay={(2 + figures.byInk.length) * STAGGER_MS}
          />
        </Breakdown>
      )}
    </>
  );
}

/** While the pool loads: the two headlines' shape, so the numbers land without the panel jumping. */
function NumbersLoading() {
  return (
    <>
      {[FONT_SIZES.displaySm, FONT_SIZES.xl].map((size) => (
        <div key={size} style={COLUMN}>
          <Skeleton height={size} width="70%" />
          <Skeleton height={size === FONT_SIZES.displaySm ? BAR.headline : BAR.second} borderRadius={RADIUS.pill} />
        </div>
      ))}
    </>
  );
}

interface NumbersProps extends AxisChoice {
  stats: CollectionStats | null;
  setCode: string;
  filtered: boolean;
}

/** The numbers for what the picker shows: the whole collection, or the open set. */
function Numbers({stats, setCode, filtered, axis, onAxisChange}: NumbersProps) {
  if (stats === null) return <NumbersLoading />;
  const whole = setCode === WHOLE_COLLECTION;
  const tally = whole ? stats.totals : stats.sets.find((set) => set.code === setCode)?.tally;
  if (!tally) return <NumbersLoading />;
  const figures = {...tally, noun: headlineNoun({whole, filtered})};
  if (figures.cards > 0) {
    const promo = isPromoSet(setCode);
    return <ScopeNumbers figures={figures} wide={whole} promo={promo} axis={axis} onAxisChange={onAxisChange} />;
  }
  // Filters that leave no card: said in words, since 0% of nothing would read as owning none.
  // The count line above the numbers otherwise went (owner, 2026-10-15).
  return filtered ? <p style={{...DETAIL_STYLE, margin: 0}}>No cards match your filters</p> : null;
}

/** `SIDE_PANEL_STYLE`'s padding, which the numbers reach through: see below. */
const PANEL_PADDING = SPACING.md;

/**
 * The numbers scroll on their own, edge to edge, so their scrollbar sits on the panel's rim
 * as the filters panel's does, and the controls above never scroll away.
 */
const NUMBERS_STYLE: CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  margin: `0 -${PANEL_PADDING}px -${PANEL_PADDING}px`,
  padding: `${SPACING.xs}px ${PANEL_PADDING}px ${PANEL_PADDING}px`,
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.xl,
};

/**
 * The numbers, under the binder's controls. What the breakdowns count is kept here, so
 * it survives a switch from set to set or to the whole collection.
 */
function NumbersRegion({stats, setCode, filtered}: Pick<NumbersProps, 'stats' | 'setCode' | 'filtered'>) {
  const [axis, setAxis] = useState<Axis>('complete');
  return (
    <div role="region" aria-label="Collection numbers" aria-busy={stats === null} style={NUMBERS_STYLE}>
      <BarPass.Provider value={`${setCode}:${axis}`}>
        <Numbers stats={stats} setCode={setCode} filtered={filtered} axis={axis} onAxisChange={setAxis} />
      </BarPass.Provider>
    </div>
  );
}

const SHOW_OPTIONS: {value: BinderShow; label: string}[] = [
  {value: 'all', label: 'All'},
  {value: 'owned', label: 'Owned'},
  {value: 'missing', label: 'Missing'},
];

const SEGMENTS_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: SPACING.xs,
  padding: SPACING.xs,
  borderRadius: `${RADIUS.lg}px`,
  background: COLORS.surfaceAlt,
  border: `1px solid ${COLORS.surfaceBorder}`,
};

/** The kit's neutral button as one segment: gold while chosen, washed on hover. */
function segmentStyle(active: boolean, hovered: boolean): CSSProperties {
  return {
    height: 32,
    minHeight: 32,
    padding: 0,
    borderRadius: `${RADIUS.md}px`,
    border: `1px solid ${active ? GOLD_GLOW.activeBorder : 'transparent'}`,
    background: active ? GOLD_GLOW.activeBg : hovered ? GOLD_GLOW.hoverBg : 'transparent',
    boxShadow: active ? GOLD_GLOW.shadow : 'none',
    color: active ? COLORS.primary : hovered ? COLORS.text : COLORS.textMuted,
    fontSize: `${FONT_SIZES.lg}px`,
    fontWeight: 600,
    // Segments don't boop, as chips don't.
    transform: undefined,
    transition: `background 0.15s ${EASING.snappy}, color 0.15s ${EASING.snappy}`,
  };
}

function Segment({label, active, onSelect}: {label: string; active: boolean; onSelect: () => void}) {
  const {hovered, hoverProps} = useHover();
  return (
    <CtaButton variant="neutral" {...hoverProps} aria-pressed={active} onClick={onSelect} style={segmentStyle(active, hovered)}>
      {label}
    </CtaButton>
  );
}

/** What the binder shows: every card, the ones you hold, or the ones you are missing. */
function BinderShows({show, onShowChange}: BinderView) {
  return (
    <div role="group" aria-label="Binder shows" style={SEGMENTS_STYLE}>
      {SHOW_OPTIONS.map(({value, label}) => (
        <Segment key={value} label={label} active={show === value} onSelect={() => onShowChange(value)} />
      ))}
    </div>
  );
}

/**
 * The picker's view of the panel's props: each set's progress and the whole collection's,
 * once the pool is in. Filtered, they are the filtered cards' too (owner, 2026-10-15), so
 * the list says which sets the cards still missing are in.
 */
function pickerProps({setCode, sets, setsLoading, onSetChange, stats}: CollectionSetPanelProps): SetPickerProps {
  const progress = stats
    ? new Map<string, {complete: number; cards: number}>([
        [WHOLE_COLLECTION, stats.totals],
        ...stats.sets.map((set) => [set.code, set.tally] as const),
      ])
    : null;
  return {setCode, sets, setsLoading, onSetChange, progress};
}

/**
 * The panel body: the set picker and what the binder shows, then the numbers. The same
 * docked beside the binder (desktop) and over it from the tablet rail. Its container is a
 * column with `SIDE_PANEL_STYLE`'s padding; the numbers fill what is left of it.
 */
export function CollectionSetBody(props: CollectionSetPanelProps) {
  return (
    <>
      <SetPicker {...pickerProps(props)} />
      <BinderShows show={props.show} onShowChange={props.onShowChange} />
      <NumbersRegion stats={props.stats} setCode={props.setCode} filtered={props.filtered ?? false} />
    </>
  );
}

/** The headline figures of what the picker shows, the open set's or the whole collection's, once the pool is in. */
function shownTally(props: CollectionSetPanelProps) {
  if (props.setCode === WHOLE_COLLECTION) return props.stats?.totals ?? null;
  return props.stats?.sets.find((set) => set.code === props.setCode)?.tally ?? null;
}

/** What the rail and the strip read of a tally: its two headlines. */
type Headlines = Pick<Tally, 'complete' | 'master' | 'cards'>;

/**
 * The rail's sideways figures, complete alone for a promo set, which shows no master. With no
 * card to count, said in words: 0% of nothing reads as owning none.
 */
function railFigures({complete, master, cards}: Headlines, promo: boolean): string {
  if (cards === 0) return 'no matching cards';
  const done = `${percentOf(complete, cards)}% complete`;
  return promo ? done : `${done} · ${percentOf(master, cards)}% master`;
}

/** The strip's toggle: the percentages the panel shows, or the set picker's dash when there is no card to count. */
function stripFigures({complete, master, cards}: Headlines, promo: boolean): string {
  if (cards === 0) return '–';
  const done = `${percentOf(complete, cards)}%`;
  return promo ? done : `${done} · ${percentOf(master, cards)}%`;
}

const panelStyle = SIDE_PANEL_STYLE;

const railStyle: CSSProperties = {
  width: RAIL_WIDTH,
  flexShrink: 0,
  position: 'relative',
  height: '100%',
  background: COLORS.surface,
  border: `1px solid ${COLORS.surfaceBorder}`,
  borderRadius: `${RADIUS.card}px`,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: SPACING.sm,
  padding: `${SPACING.sm}px 0`,
};

/**
 * The collapsed form, on tablets, where the docked panel has no room: the
 * two headline percentages readable sideways, opening the full panel OVER the
 * binder rather than beside it, so opening it never resizes the cards. Set
 * switching is one tap away, inside. Open, the panel runs the rail's full height,
 * as the docked one does, so the set picker's list has the room to open in.
 */
export function CollectionSetRail(props: CollectionSetPanelProps) {
  const [open, setOpen] = useState(false);
  const t = shownTally(props);
  return (
    <aside aria-label="Set" style={railStyle}>
      <IconButton
        aria-label={open ? 'Hide set panel' : 'Show set panel'}
        aria-expanded={open}
        size={32}
        onClick={() => setOpen(!open)}
        style={{color: COLORS.primary, fontSize: `${FONT_SIZES.lg}px`}}>
        {open ? '‹' : '›'}
      </IconButton>
      <span
        style={{
          ...TABULAR,
          writingMode: 'vertical-rl',
          fontSize: `${FONT_SIZES.base}px`,
          color: COLORS.textMuted,
          letterSpacing: '0.08em',
        }}>
        {props.setCode === WHOLE_COLLECTION ? 'Whole collection' : setName(props.setCode)}
        {props.filtered && ' · filtered'}
        {t !== null && ` · ${railFigures(t, isPromoSet(props.setCode))}`}
      </span>
      {open && (
        <div style={{...panelStyle, position: 'absolute', left: RAIL_WIDTH + SPACING.xs, top: 0, height: '100%', zIndex: 5}}>
          <CollectionSetBody {...props} />
        </div>
      )}
    </aside>
  );
}

/**
 * Phones: the picker, the two headline numbers and what the binder shows in a strip above
 * the page, the rest of the numbers one tap away and opening inline (the section scrolls),
 * so the binder page keeps the whole width.
 */
export function CollectionSetStrip(props: CollectionSetPanelProps) {
  const [open, setOpen] = useState(false);
  const t = shownTally(props);
  return (
    <section aria-label="Set" style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm, padding: `${SPACING.sm}px 0`}}>
      <div style={{display: 'flex', gap: SPACING.sm, alignItems: 'center'}}>
        <div style={{flex: 1, minWidth: 0}}>
          <SetPicker {...pickerProps(props)} />
        </div>
        {t !== null && (
          <ToggleNumbers
            open={open}
            onToggle={() => setOpen(!open)}
            figures={stripFigures(t, isPromoSet(props.setCode))}
          />
        )}
      </div>
      <BinderShows show={props.show} onShowChange={props.onShowChange} />
      {open && props.stats && (
        <div style={{...panelStyle, width: '100%'}}>
          <NumbersRegion stats={props.stats} setCode={props.setCode} filtered={props.filtered ?? false} />
        </div>
      )}
    </section>
  );
}

/** The strip's figures, named with what they show first, so a voice command can say what it sees. */
function ToggleNumbers({open, onToggle, figures}: {open: boolean; onToggle: () => void; figures: string}) {
  return (
    <IconButton
      aria-label={`${figures}, ${open ? 'hide' : 'show'} the numbers`}
      aria-expanded={open}
      size={34}
      onClick={onToggle}
      style={{...TABULAR, width: 'auto', padding: `0 ${SPACING.sm}px`, color: COLORS.primary, fontSize: `${FONT_SIZES.base}px`, whiteSpace: 'nowrap'}}>
      {figures}
    </IconButton>
  );
}
