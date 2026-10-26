import {useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject} from 'react';
import type {Ink} from 'inkweave-synergy-engine';
import {CtaButton} from 'inkweave-ui/components/CtaButton';
import {COLORS, GOLD_GLOW, INK_COLORS, RADIUS, SPACING, hexRgba} from '../../../shared/constants';
import {useHover} from 'inkweave-ui/hooks/useHover';
import {
  LONE_MINI_WIDTH,
  MAP_CELL,
  MAP_CELL_GAP,
  MAP_GAP_ABOVE,
  MINI_BORDER,
  MINI_PADDING,
  PER_PAGE,
  SPREAD_PAGING,
  lonePage,
  pagingOf,
  perLonePage,
  type BinderPaging,
  type LoneRows,
} from './binderGeometry';

/**
 * The binder's pager where Browse docks its panels (owner, 2026-10-12): the spreads in
 * miniature, one cell per pocket. Click a spread to turn to it; the discs on the spread's
 * outer edges step one at a time (owner, 2026-10-22: a worded Previous and Next sat at
 * either end of this row before). It answers the binder's own question, "what am I
 * missing?", so the band under the spread shows what the spread cannot.
 *
 * EACH CELL IS ITS CARD'S INK (owner, 2026-10-15), the vivid `INK_COLORS` shade: filled
 * for a card you hold, a ring for one you are missing, so the gaps still read as gaps and
 * each one says its ink. A dual-ink card splits on the diagonal, ring and fill alike. The
 * pages behind them are neutral, so Amber is not drawn on gold. Collector order runs by
 * ink within a set, so the map shows where each ink begins.
 *
 * A LONG BINDER SHOWS A WINDOW OF SPREADS (owner, 2026-10-12), the whole collection's
 * 135 among them, where one mini each would shrink to slivers. The window moves only at
 * its edges: reach its last spread and that spread becomes its first, so what lies ahead
 * comes into view; going back mirrors it. Where the row holds `WINDOW`, a set's binder
 * (nine to eleven spreads) fits whole and never moves.
 *
 * THE WINDOW HOLDS ELEVEN AT MOST, 4px APART RATHER THAN 8 (owner, 2026-10-12): at 1920
 * the binder is 1,272px wide, and thirteen spreads left the row's worded Previous and Next
 * no room. Those have since moved to the spread's edges (owner, 2026-10-22), so the row is
 * the spreads' alone.
 *
 * WHERE THE BINDER GOES SET BY SET, A SPREAD NAMES ITS SETS ON HOVER (owner, 2026-10-12):
 * "Set 11, Winterspell, spread 3 of 11". The logos that named them under the spreads were
 * dropped the same day.
 *
 * THE LAST SPREAD'S EMPTY RIGHT PAGE IS THE BACK COVER HERE TOO (owner, 2026-10-12):
 * tinted the cover's blue, as `BinderSpread` draws it.
 *
 * AND THE FIRST SPREAD'S LEFT PAGE IS THE FRONT COVER (owner, 2026-10-18), so the spreads
 * here page as the binder's do, a page in (`SPREAD_PAGING`), and each names the cards it shows.
 *
 * THE WINDOW HOLDS AS MANY SPREADS AS FIT ITS ROW (owner, 2026-10-16, option B of
 * `public/mockups/binder-map-narrow.html`), each at least `MIN_MINI` wide, up to
 * `WINDOW`. Eleven squeezed into a narrow row drew cells too small to show a gap: at 1440
 * (a 792px binder) a missing card's ring filled in and read as held, and at 1280 the held
 * cells rounded to nothing. Now 1920 keeps all eleven at full size; with the buttons gone
 * from the row (2026-10-22), 1440 keeps all eleven too, 1280 shows nine, and 1024 with
 * both panels docked five, their cells never under 4 by 5. The row is measured before
 * the first paint and again whenever it resizes, so docking a panel or narrowing the
 * browser refits the window around the spread on show.
 *
 * CELLS ARE WHOLE PIXELS (owner, 2026-10-12: "some seem taller some shorter"). A cell 6.5
 * by 8.67px reaches the screen as 6 or 7 by 8 or 9, depending on where its edges fall, so
 * neighbours differed by a pixel. At its widest a spread now holds 7 by 9 cells exactly;
 * where the row shrinks it, each page rounds its cells down to whole pixels against its
 * own width (`CELL_BOX`).
 *
 * UNDER A PHONE'S LONE PAGE IT DRAWS PAGES (owner, 2026-10-25, #969), where the page's arrows
 * were: one mini per page, its 3 by 3 or 3 by 4 cells always at full size, the window holding as
 * many as fit and moving as the spreads' does, and nothing after them: the row is all minis
 * (owner, 2026-10-26). Pages have no covers.
 */

/** A pocket in the map: whether you hold its card, and the card's ink, or two for a dual-ink card. */
export interface Pocket {
  owned: boolean;
  inks: readonly Ink[];
  /**
   * An open pocket, with no card in it (#805): a promo-set number nobody has listed yet, or a
   * promo whose card is not out. Drawn empty, as on the spread, and never counted as missing.
   */
  open?: boolean;
  /**
   * An open pocket that shows a waiting promo's scan (owner, 2026-10-19): drawn as the spread
   * shows it, a greyed card, though still never counted as missing, since no one can hold it yet.
   */
  scan?: boolean;
}

/** Where a set starts, in a binder that goes set by set. */
export interface MapSet {
  /** The pocket its first card takes. */
  start: number;
  /** Its name in the hover text, as "Set 11, Winterspell". */
  label: string;
}

/** A spread's place in the binder, which one out of how many; under a lone page, a page's. */
interface SpreadPlace {
  spread: number;
  total: number;
}

/** How a mini is drawn: whether it is the one on show, and whether it is hovered. */
interface Look {
  on: boolean;
  hovered: boolean;
}

interface BinderSpreadMapProps {
  /** Every pocket in the binder, in its order. */
  pockets: readonly Pocket[];
  /** The spread on show, or under a lone page the page. */
  current: number;
  /** Turn to a spread, or a page. */
  onGo: (spread: number) => void;
  /** Where each set starts, in pocket order, when the binder goes set by set; its spreads then name them. */
  sets?: readonly MapSet[];
  /** A phone's lone pages: a mini per page, in place of the spreads. */
  single?: boolean;
  /** A lone page's rows, 3 or 4, which its mini draws. */
  rows?: LoneRows;
}

/** What draws a map: all but the choice of spreads or pages. */
type MapProps = Omit<BinderSpreadMapProps, 'single' | 'rows'>;

/**
 * The most spreads in view at once: eleven, the biggest set's count, so where the row has
 * room for them a set's binder shows whole (owner, 2026-10-12; thirteen until the buttons
 * took their words). Narrower rows hold fewer (`useViewsThatFit`).
 */
const WINDOW = 11;

/**
 * A mini spread's widest: two pages of four 7px cells with their gaps and padding, the
 * gap between the pages, its own padding and its border (owner, 2026-10-12: a bit bigger
 * than 6px). Exactly that, so the cells come out whole pixels: 86 once made them 6.5px.
 */
const MINI_WIDTH = 90;

/** A cell in a spread at its widest (`MINI_WIDTH`): 7px across, so 9 tall. */
const FULL_CELL = MAP_CELL.width;

/**
 * Whether the browser can round a length to whole pixels against its container: CSS
 * `round()` with container units (Chrome 125, Firefox 118, Safari 16). Where it cannot,
 * a shrunken spread's cells keep their fractional sizes.
 */
const SNAPS = typeof CSS !== 'undefined' && CSS.supports('width', 'round(down, 1cqw, 1px)');

/**
 * A cell's width: a quarter of its page's width less the gaps, rounded down to a whole pixel,
 * and never wider than a full cell.
 *
 * NEVER WIDER THAN A FULL CELL, FOR FIREFOX (#922). Until a page has been laid out, Firefox
 * reads its `100cqw` as the window's width, so on that first pass each cell came out hundreds
 * of pixels wide and tall, and the map took all the height the binder's pages had above it.
 * Firefox fits the pages' pockets to the height their box has on that pass (`SPREAD_COLUMN` in
 * `BinderSpread`), and fits them again only when the box next changes size, which it never did
 * where the window's height runs out first: at 1920x900 every pocket had no width, and the cards
 * piled up. Capped, that pass draws the map at its full size, as it is drawn wherever the height
 * runs out first (1920x900, 2560x1080), so the pages get their real height.
 */
const CELL_WIDTH = `min(${FULL_CELL}px, round(down, (100cqw - ${3 * SPACING.xxs}px) / 4, 1px))`;

/** A cell's size: whole pixels, its height the nearest to a card's shape (7 by 9 at the widest). */
const CELL_BOX: CSSProperties = SNAPS
  ? {width: CELL_WIDTH, height: `round(${CELL_WIDTH} / 0.75, 1px)`}
  : {aspectRatio: '0.75'};

/** A lone page's cell, always at full size: 7 by 9 (#969). */
const LONE_CELL: CSSProperties = MAP_CELL;

/** Behind a mini's cells: neutral, so the ink cells read true; gold would warm every one of them. */
const PAGE_TINT = hexRgba(COLORS.text, 0.06);

const PAGE_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'grid',
  // Whole-pixel cells size their own columns, centred in what rounding leaves over.
  gridTemplateColumns: SNAPS ? 'repeat(4, auto)' : 'repeat(4, minmax(0, 1fr))',
  justifyContent: 'center',
  gap: SPACING.xxs,
  padding: SPACING.xxs,
  // The page is what its cells measure their width against.
  containerType: SNAPS ? 'inline-size' : undefined,
  background: PAGE_TINT,
  borderRadius: RADIUS.xs,
};

/**
 * A cover in miniature, front or back. No token is the cover board's blue; Sapphire's at this
 * strength lands on the texture's average over the page (sampled 2026-10-12: rgb 42 53 110).
 */
const COVER_STYLE: CSSProperties = {...PAGE_STYLE, background: hexRgba(INK_COLORS.Sapphire.border, 0.35)};

/** A card's ink, or its two inks split on the diagonal, at `alpha`. */
function inkPaint(inks: readonly Ink[], alpha: number): string {
  const [first, second] = inks.map((ink) => hexRgba(INK_COLORS[ink].border, alpha));
  return second ? `linear-gradient(135deg, ${first} 50%, ${second} 50%)` : first;
}

/** Any opaque fill: a mask keeps what it covers, so only its shape counts. */
const MASK_FILL = `linear-gradient(${COLORS.background} 0 0)`;

/** A missing card's ring: a 1px hairline, under the spacing scale's smallest step. */
const RING_WIDTH = 1;

/**
 * A missing card's ring: its ink, masked down to the cell's 1px edge, which is how a
 * dual-ink card's ring keeps both colours where an inset shadow could draw only one.
 */
const RING_STYLE: CSSProperties = {
  padding: RING_WIDTH,
  WebkitMask: `${MASK_FILL} content-box, ${MASK_FILL}`,
  WebkitMaskComposite: 'xor',
  mask: `${MASK_FILL} content-box exclude, ${MASK_FILL}`,
};

/** A waiting promo's scan in miniature: grey, as the spread greys it, with no ink to show. */
const SCAN_FILL = hexRgba(COLORS.text, 0.3);

/**
 * A card-shaped cell in its card's ink: filled for a card you hold, a ring for one you are
 * missing; grey for a waiting promo's scan.
 */
function cellStyle(pocket: Pocket | undefined, box = CELL_BOX): CSSProperties {
  const cell: CSSProperties = {...box, borderRadius: RADIUS.xs};
  // Past the binder's last card, or an open pocket: empty, as on the spread itself.
  if (!pocket) return cell;
  if (pocket.open) return pocket.scan ? {...cell, background: SCAN_FILL} : cell;
  if (pocket.owned) return {...cell, background: inkPaint(pocket.inks, 1)};
  return {...cell, ...RING_STYLE, background: inkPaint(pocket.inks, 0.85)};
}

/** One page of a mini spread: twelve cells, which a cover keeps empty for its size. */
function MiniPage({pockets, cover = false}: {pockets: readonly Pocket[]; cover?: boolean}) {
  return (
    <span aria-hidden style={cover ? COVER_STYLE : PAGE_STYLE}>
      {Array.from({length: PER_PAGE}, (_, i) => (
        <span key={i} style={cellStyle(pockets[i])} />
      ))}
    </span>
  );
}

/** A mini spread's two pages of pockets, and which of them is a cover. */
interface SpreadPages {
  left: readonly Pocket[];
  right: readonly Pocket[];
  frontCover: boolean;
  backCover: boolean;
}

/**
 * A spread's pages: the first spread's left one is the front cover, and a right one past the
 * binder's last card the back cover. The loading map's one spread holds no pockets, so its
 * right page stays a page, like the spread it stands for.
 */
function spreadPages(pockets: readonly Pocket[], {spread}: Pick<SpreadPlace, 'spread'>): SpreadPages {
  // As on the binder, the front cover takes a page before the first card (`SPREAD_PAGING`).
  const from = spread * SPREAD_PAGING.perView - SPREAD_PAGING.lead;
  const right = from + PER_PAGE;
  return {
    left: from < 0 ? [] : pockets.slice(from, right),
    right: pockets.slice(right, right + PER_PAGE),
    frontCover: from < 0,
    backCover: pockets.length > 0 && right >= pockets.length,
  };
}

/** A set's stretch of the binder: its name, and its first and last spreads. */
interface SetSpan {
  label: string;
  first: number;
  last: number;
}

/**
 * How the map pages its pockets: spreads after the front cover's page, or a phone's lone pages of
 * nine, with no covers (#969).
 */
interface MapViews extends BinderPaging {
  /** What a mini's name calls its view: "Spread 3 of 9", "Page 5 of 27". */
  noun: 'spread' | 'page';
  /** How many minis a row this many pixels wide holds. */
  fits: (room: number) => number;
}

/** Each set's views, from where each starts and where the binder's `count` pockets end. */
function setSpans(sets: readonly MapSet[], count: number, {perView, lead}: MapViews): SetSpan[] {
  return sets.map((set, i) => ({
    label: set.label,
    first: Math.floor((set.start + lead) / perView),
    last: Math.floor(((sets[i + 1]?.start ?? count) - 1 + lead) / perView),
  }));
}

/**
 * What a mini says to a screen reader and on hover: "Spread 3 of 9: 6 missing", or, going set
 * by set, each set on it and the spread's place in that set: "Set 11, Winterspell, spread 3 of
 * 11: nothing missing". Sets run on from one another, so a spread where one ends and the next
 * begins names both. A phone's mini pages name pages: "Page 5 of 27: 4 missing" (#969).
 */
function viewLabel({spread, total}: SpreadPlace, pockets: readonly Pocket[], spans: readonly SetSpan[], {noun}: MapViews): string {
  const missing = pockets.filter((p) => !p.owned && !p.open).length;
  const state = missing === 0 ? 'nothing missing' : `${missing} missing`;
  const named = spans.filter((span) => span.first <= spread && spread <= span.last);
  if (named.length === 0) return `${noun[0].toUpperCase()}${noun.slice(1)} ${spread + 1} of ${total}: ${state}`;
  const places = named.map((span) => `${span.label}, ${noun} ${spread - span.first + 1} of ${span.last - span.first + 1}`);
  return `${places.join(', then ')}: ${state}`;
}

/** The kit's neutral button, restyled as a mini spread: gold-ringed while on show. */
function miniStyle({on, hovered}: Look): CSSProperties {
  return {
    // A WIDTH, not a flex-basis: the row shrink-wraps the spreads, and their cells have
    // no width of their own, so a basis alone measured 34px. Shrinkable, for narrow rows.
    width: MINI_WIDTH,
    flexShrink: 1,
    minWidth: 0,
    minHeight: 0,
    padding: MINI_PADDING,
    gap: SPACING.xs,
    borderRadius: RADIUS.md,
    border: `${MINI_BORDER}px solid ${on ? GOLD_GLOW.activeBorder : 'transparent'}`,
    background: on ? GOLD_GLOW.activeBg : hovered ? GOLD_GLOW.hoverBg : 'transparent',
    boxShadow: on ? GOLD_GLOW.shadow : 'none',
  };
}

/** A page of nine or twelve in miniature: the page itself is the button, never squeezed. */
function lonePageStyle(look: Look): CSSProperties {
  const style = miniStyle(look);
  return {...style, width: 'auto', flexShrink: 0, background: look.on || look.hovered ? style.background : PAGE_TINT};
}

interface MiniProps {
  /** The spread or page it turns to. */
  view: number;
  label: string;
  current: boolean;
  onGo: (view: number) => void;
  /** Its look, on show or hovered. */
  look: (look: Look) => CSSProperties;
  children: ReactNode;
}

/** A mini spread or page: named for screen readers and on hover, and turned to on a click. */
function Mini({view, label, current, onGo, look, children}: MiniProps) {
  const {hovered, hoverProps} = useHover();
  return (
    <CtaButton
      variant="neutral"
      {...hoverProps}
      aria-label={label}
      title={label}
      aria-current={current ? 'true' : undefined}
      onClick={() => onGo(view)}
      style={look({on: current, hovered})}>
      {children}
    </CtaButton>
  );
}

/** A lone page's cells: three across, 2px apart, as a spread's pages space theirs. */
const LONE_GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: `repeat(${lonePage(3).columns}, ${MAP_CELL.width}px)`,
  gap: MAP_CELL_GAP,
};

/** A lone page's cells, nine or twelve, each at full size. */
function LonePageCells({pockets, rows}: {pockets: readonly Pocket[]; rows: LoneRows}) {
  return (
    <span aria-hidden style={LONE_GRID}>
      {Array.from({length: perLonePage(rows)}, (_, i) => (
        <span key={i} style={cellStyle(pockets[i], LONE_CELL)} />
      ))}
    </span>
  );
}

/**
 * The narrowest a mini spread may draw: its cells 4px wide, the least that leaves a
 * missing card's 1px ring a hole, so a gap never reads as a card you hold.
 */
const MIN_MINI = 66;

/** How many mini spreads `room` pixels hold at `MIN_MINI` or wider, 4px apart: at least the one on show, at most `WINDOW`. */
function spreadsThatFit(room: number): number {
  const fit = Math.floor((room + SPACING.xs) / (MIN_MINI + SPACING.xs));
  return Math.max(1, Math.min(WINDOW, fit));
}

/** How many mini pages `room` pixels hold, 4px apart, each at full size (`LONE_MINI_WIDTH`): at least the one on show. */
function pagesThatFit(room: number): number {
  return Math.max(1, Math.floor((room + SPACING.xs) / (LONE_MINI_WIDTH + SPACING.xs)));
}

/** The map of spreads, beside the front cover, and a phone's map of pages, with none, by their rows. */
const SPREAD_VIEWS: MapViews = {...SPREAD_PAGING, noun: 'spread', fits: spreadsThatFit};
const PAGE_VIEWS: Record<LoneRows, MapViews> = {
  3: {...pagingOf(true, 3), noun: 'page', fits: pagesThatFit},
  4: {...pagingOf(true, 4), noun: 'page', fits: pagesThatFit},
};

/**
 * How many minis the window holds: as many as fit the row (`fits`). Measured before the
 * first paint, so the row never shows a window it cannot fit, and again whenever the row
 * resizes (a panel docking, the browser narrowing). Null until measured, which a test
 * renderer, laying nothing out, never is; the window then holds the full `WINDOW`.
 */
function useViewsThatFit(rowRef: RefObject<HTMLElement | null>, fits: MapViews['fits']): number | null {
  const [fit, setFit] = useState<number | null>(null);
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      if (row.clientWidth > 0) setFit(fits(row.clientWidth));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [rowRef, fits]);
  return fit;
}

/** Where the window sits: its first spread and how many it holds, in a binder of `total`. */
interface WindowView {
  start: number;
  size: number;
  total: number;
}

/** The window's first spread when the view moves to `to`: it moves only once `to` reaches an edge. */
function nextWindowStart({start, size, total}: WindowView, to: number): number {
  const latest = Math.max(0, total - size);
  if (to >= start + size - 1) return Math.min(to, latest);
  if (to <= start) return Math.max(0, to - size + 1);
  return start;
}

/** A window of `size` opening on the spread, or as near as the binder's end allows. */
const windowAt = ({spread, total}: SpreadPlace, size: number) => Math.max(0, Math.min(spread, total - size));

/**
 * The window's first spread once it holds `size`: where it was, if the spread on show
 * still fits in it, else the nearest start that keeps that spread in view.
 */
function refitWindowStart({start, size, total}: WindowView, spread: number): number {
  return Math.max(0, Math.min(Math.max(start, spread - size + 1), spread, total - size));
}

/** What the window last followed: its first spread, the spread on show, the binder's length and the row's fit. */
interface WindowState {
  start: number;
  at: number;
  total: number;
  fit: number | null;
}

/** Where the window goes when the spread on show, the binder's length or the room changes. */
function followWindow(state: WindowState, place: SpreadPlace, fit: number | null): number {
  const size = fit ?? WINDOW;
  if (state.total !== place.total) return windowAt(place, size);
  if (state.fit === fit) return nextWindowStart({start: state.start, size, total: state.total}, place.spread);
  // The room changed. Its first measure opens on the spread, as if it had been known all
  // along: the unmeasured window before it was never painted.
  if (state.fit === null) return windowAt(place, size);
  return refitWindowStart({start: state.start, size, total: state.total}, place.spread);
}

/**
 * The window's first spread, following the spread on show. Kept from render to render,
 * since where it sits depends on the way the view has moved, and moved when the spread
 * on show changes (the "previous render" pattern, so the window and the spread never
 * disagree for a frame).
 */
function useWindowStart(place: SpreadPlace, fit: number | null): number {
  const [state, setState] = useState<WindowState>({
    start: windowAt(place, fit ?? WINDOW),
    at: place.spread,
    total: place.total,
    fit,
  });
  const moved = state.at !== place.spread || state.total !== place.total;
  if (!moved && state.fit === fit) return state.start;
  const start = followWindow(state, place, fit);
  setState({start, at: place.spread, total: place.total, fit});
  return start;
}

/**
 * The map's window: the row it fits, how many spreads or pages the binder has, and those on
 * show, following the one on show.
 */
function useMapWindow(pockets: readonly Pocket[], current: number, views: MapViews) {
  const rowRef = useRef<HTMLElement>(null);
  const fit = useViewsThatFit(rowRef, views.fits);
  const size = fit ?? WINDOW;
  const total = Math.max(1, Math.ceil((pockets.length + views.lead) / views.perView));
  const start = useWindowStart({spread: current, total}, fit);
  const shown = Array.from({length: Math.min(size, total - start)}, (_, i) => start + i);
  return {rowRef, total, shown};
}

function SpreadMap({pockets, current, onGo, sets = []}: MapProps) {
  const {rowRef, total, shown} = useMapWindow(pockets, current, SPREAD_VIEWS);
  const spans = setSpans(sets, pockets.length, SPREAD_VIEWS);
  return (
    // 8px under the spread, so at 1920x900 map and binder fit the band without the
    // binder giving up height, and its left edge stays on the search bar's.
    <nav
      ref={rowRef}
      aria-label="Binder pages"
      style={{display: 'flex', justifyContent: 'center', gap: SPACING.xs, paddingTop: SPACING.sm}}>
      {shown.map((spread) => {
        const pages = spreadPages(pockets, {spread});
        return (
          <Mini
            key={spread}
            view={spread}
            label={viewLabel({spread, total}, [...pages.left, ...pages.right], spans, SPREAD_VIEWS)}
            current={spread === current}
            onGo={onGo}
            look={miniStyle}>
            <MiniPage pockets={pages.left} cover={pages.frontCover} />
            <MiniPage pockets={pages.right} cover={pages.backCover} />
          </Mini>
        );
      })}
    </nav>
  );
}

/**
 * A phone's map: a mini per page, 4px under the page, as many as fit the row, and
 * nothing after them: the open mini's name and `aria-current` say where the page is,
 * and "5 / 27" took the room of two minis. Each mini draws its page's rows, 3 or 4.
 */
function PageMap({pockets, current, onGo, sets = [], rows}: MapProps & {rows: LoneRows}) {
  const views = PAGE_VIEWS[rows];
  const {rowRef, total, shown} = useMapWindow(pockets, current, views);
  const spans = setSpans(sets, pockets.length, views);
  return (
    // The nav measures the minis' row (`useViewsThatFit`), so the band's padding sits outside it.
    <div style={{padding: `${MAP_GAP_ABOVE}px ${SPACING.xs}px 0`}}>
      <nav ref={rowRef} aria-label="Binder pages" style={{display: 'flex', justifyContent: 'center', gap: SPACING.xs}}>
        {shown.map((page) => {
          const held = pockets.slice(page * views.perView, (page + 1) * views.perView);
          return (
            <Mini
              key={page}
              view={page}
              label={viewLabel({spread: page, total}, held, spans, views)}
              current={page === current}
              onGo={onGo}
              look={lonePageStyle}>
              <LonePageCells pockets={held} rows={rows} />
            </Mini>
          );
        })}
      </nav>
    </div>
  );
}

export function BinderSpreadMap({single = false, rows = 3, ...props}: BinderSpreadMapProps) {
  return single ? <PageMap {...props} rows={rows} /> : <SpreadMap {...props} />;
}
