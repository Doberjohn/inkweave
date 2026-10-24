import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import {EDGE_DISC_SIZE, InkCardPlaceholder, NavArrowButton} from '../../../shared/components';
import {useContainerWidth} from '../../../shared/hooks/useContainerWidth';
import {blackRgba, COLORS, RADIUS, SPACING} from '../../../shared/constants';
import {BINDER_LOOK} from './binderLook';
import {viewSheets, type ViewSheets} from './binderSheets';
import './binder.css';

/**
 * The binder itself: two facing pages in the binder's board, the ringed spine
 * between them, and a page arrow on each side. Presentational only — it owns how a
 * binder LOOKS and how big a card may be, and knows nothing about which cards are in it.
 *
 * PRO PAGES IN A ZIP BINDER (owner, 2026-10-24, #941), in place of parchment pages: black
 * textured pages whose pockets are a frosted sleeve under a clear front sheet, in a black
 * board with a zip round its outer edge, and the edges of the sheets under each page along
 * its foot, more under the right page near the start and under the left near the end. The
 * look is `binder.css`, its colours `binderLook.ts`; this file draws its structure.
 *
 * NO CAPTION, NO LABEL, NO LEGEND (owner, 2026-08-14). The legend under the
 * spread went the same way as the pager row above it: the binder is height-driven,
 * so every band of chrome comes straight out of the card size, and a spread of
 * real cards explains itself better than a sentence about it does.
 *
 * THE ARROWS FLANK THE SPREAD (owner, 2026-08-14), replacing a Previous/Next row
 * with a "Spread 3 of 9" label beneath it. Turning a page is a gesture at the
 * edge of the page, not a button in a control strip; the row also spent vertical
 * space, and the binder is height-driven, so every pixel it took came off the
 * cards. The count it carried is coming back as part of the stats design.
 *
 * WITHOUT ARROWS BESIDE IT WHERE BROWSE DOCKS ITS PANELS (owner, 2026-10-08): the
 * spread takes their width and fills its box from the top, so its left edge meets the
 * search bar's start, its right edge the search bar's end (owner, 2026-10-23), and its
 * top meets the panels' tops (see `arrows`).
 *
 * THERE THE ARROWS SIT ON THE SPREAD'S OUTER EDGES (owner, 2026-10-22): a small disc
 * halfway down each, growing under the pointer, where a worded Previous and Next at
 * either end of the spread map's row turned the pages before. The spread keeps its
 * size: at rest a disc covers its page's margin, and the rest of it lies in the gutter
 * beside the spread.
 *
 * THE LAST SPREAD'S EMPTY RIGHT PAGE IS THE INSIDE BACK COVER (owner, 2026-10-12): a
 * page of empty pockets read as missing cards; the cover's blue board says the binder
 * ends there (see `cardCount`).
 *
 * THE FIRST SPREAD OPENS ON THE INSIDE FRONT COVER (owner, 2026-10-18), as a real binder
 * does: the same plain board on its left page, the first twelve cards on its right. The
 * caller pages a page in, so the first spread's `start` is -12 (see `start`). A phone shows
 * lone pages and no cover, and the whole collection has the one, at its start.
 *
 * THE SEAM IS CHROME VS FILL, because the app has two binders that want opposite
 * fills from identical chrome. Browse COMPACTS (results flow into spreads, so 36
 * matches is 2 full spreads and gaps never appear), while the collection binder
 * holds FIXED SLOTS and dims in place, because "what am I missing?" is only
 * answerable if a card never moves. Folding those together behind a flag would
 * put two contradictory rules in one component; folding the chrome out shares
 * everything they genuinely have in common.
 */

/** Four columns x three rows, per page. A spread is two of these. */
const PAGE_COLUMNS = 4;
const PAGE_ROWS = 3;
export const PER_PAGE = PAGE_COLUMNS * PAGE_ROWS;
export const PER_SPREAD = PER_PAGE * 2;

/** Lorcana cards are 0.72 wide-to-tall. Drives the whole layout. */
const CARD_ASPECT = 0.72;

/** A page's margin around its pockets. */
const PAGE_PADDING = SPACING.md;

/**
 * The board round the pages, which the zip runs along (#941): the spread's sizing counts it on
 * both axes, and on a phone it comes out of the lone page's width.
 */
const BOARD = SPACING.section;

/** The binder's cover board: the inside front cover, and the inside back cover past the last card. */
const COVER_BOARD = '/art/backgrounds/binder-cover.webp';

/**
 * A spread page's column: one card's width, spelled out from the page's own height.
 * The page is as tall as the box around the pages (`PAGES_BOX`, a size container) less
 * the board round them, so `100cqh` is the page and the board: less those, the page's
 * padding and its row gaps, a third of it is a card's height, and the card's aspect
 * turns that into its width.
 *
 * EXPLICIT BECAUSE WEBKIT WILL NOT DERIVE IT (#826). A page hugs its cards, and each
 * card takes its width from its row's height (`slotStyle`). Chromium carries that ratio
 * into sizing the columns; WebKit sizes the columns before it knows the rows, gets no
 * width from a card (a tile is an inline-size container, so it counts as 0), and drew
 * every page 48px wide, its padding and gaps alone, with each row's cards piled on one
 * another: measured at 1280x720, against Chromium's 304px. Spelled out, the columns are
 * the same in both.
 *
 * FIREFOX FITS THEM ONCE PER LAYOUT (#922). It reads `100cqh` on its first pass and keeps that
 * answer, though the box may change height later in the same layout, until the box next changes
 * size. So nothing the pages share their height with may come out a different size on that pass:
 * the spread map under them once did (see its `FULL_CELL`), and every pocket came out 0 wide.
 */
const PAGE_CHROME_HEIGHT = 2 * PAGE_PADDING + (PAGE_ROWS - 1) * SPACING.sm + 2 * BOARD;
const SPREAD_COLUMN = `calc((100cqh - ${PAGE_CHROME_HEIGHT}px) / ${PAGE_ROWS} * ${CARD_ASPECT})`;

/**
 * A page. The rows are `minmax(0, 1fr)`, so the grid claims exactly the height it is
 * given and each slot fits the card aspect INSIDE its row: the layout sizes itself
 * from the space it has rather than from a fixed card width. A spread page's columns
 * are that card's width (`SPREAD_COLUMN`); a lone page's are `minmax(0, 1fr)` of the
 * width it is given (`singlePageStyle`).
 *
 * `minmax(0, 1fr)` is load-bearing where it is used, not stylistic. A bare `1fr` is
 * `minmax(auto, 1fr)`, whose auto floor is the item's min-content size, so tracks
 * refuse to shrink: measured, three 249px cards overflowed a 561px page instead
 * of sizing down to fit it.
 *
 * COLUMNS WERE `auto` UNTIL 2026-08-14, which made width derive from height with
 * no width constraint at all. On a tall window that is unbounded: measured on
 * Browse's binder view (since removed) the spread ran 88px past the viewport at 1440x900, 47px at
 * 2560x1440 and 588px at 1400x1400. Nobody noticed while the pager was a row
 * underneath, because the casualty was a clipped card edge; the moment the page
 * arrows moved beside the spread the casualty became the navigation itself,
 * pushed off-screen. The height cap (`spreadMaxHeight`) is what bounds it: the
 * columns follow the page's height, and the cap keeps that height to what fits.
 */
function pageStyle(side: 'left' | 'right', cover = false): CSSProperties {
  return {
    height: '100%',
    // A page HUGS ITS CARDS, and that is safe only because the slots are sized
    // from the row height (see `slotStyle`), which is definite. It was briefly
    // `flex: 1 1 0` while the slots were width-driven, and the pages then filled
    // the row while the cards stayed height-bound — measured at 1920x855, 864px
    // pages holding 128px cards, so every pocket carried 88px of slack and the
    // spread read as a loose grid rather than a binder.
    //
    // The trap that forced that detour: with width-driven slots a page's width
    // came from the card IMAGES' intrinsic size, so a page turn collapsed both
    // pages from 642px to 48px until they decoded. Height-driven slots have no
    // such dependency — the width is derived from a definite row height and is
    // identical at zero images loaded and at twenty-four.
    display: 'grid',
    gridTemplateColumns: `repeat(${PAGE_COLUMNS}, ${SPREAD_COLUMN})`,
    gridTemplateRows: `repeat(${PAGE_ROWS}, minmax(0, 1fr))`,
    gap: SPACING.sm,
    padding: PAGE_PADDING,
    // A page wider than its cards (one widened to its box, see `EDGE_FRAME`) keeps its
    // pockets together in its middle: the extra width is margin, never slack between them.
    justifyContent: 'center',
    // A page of cards is a pro page, all binder.css's (`.binder-page`); a cover keeps its board.
    ...(cover && coverStyle(side)),
    borderRadius:
      side === 'left'
        ? `${RADIUS.card}px ${RADIUS.sm}px ${RADIUS.sm}px ${RADIUS.card}px`
        : `${RADIUS.sm}px ${RADIUS.card}px ${RADIUS.card}px ${RADIUS.sm}px`,
  };
}

/**
 * A cover's blue board. Mirrored, so the inside front and back covers are not visibly
 * the same image.
 */
function coverStyle(side: 'left' | 'right'): CSSProperties {
  return {
    backgroundImage: `url(${COVER_BOARD})`,
    backgroundSize: 'cover',
    backgroundPosition: side === 'left' ? 'left center' : 'right center',
  };
}

/**
 * The spine. Wide enough to hold hardware, because a bare gap reads as two
 * separate panels rather than one bound object. Rings are the most legible
 * signal of "binder" and survive at any spread height, where stitching or a
 * leather texture would compete with the pages and need its own asset.
 */
const SPINE_WIDTH = SPACING.xxl;
const ARROW_WIDTH = 44;
/** The two arrows beside a spread and the gaps around them, where they are drawn. */
const ARROWS_CHROME = 2 * ARROW_WIDTH + 3 * SPACING.sm;

const spineStyle: CSSProperties = {
  width: SPINE_WIDTH,
  background: COLORS.background,
  alignSelf: 'stretch',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-evenly',
  alignItems: 'center',
  // Inner shadow on both page edges: the pages fall away into the gutter, which
  // is what makes it a valley rather than a painted stripe.
  boxShadow: `inset 6px 0 8px -6px ${blackRgba(0.85)}, inset -6px 0 8px -6px ${blackRgba(0.85)}`,
};

/**
 * One ring. An open pill rather than a filled dot — a ring is read by its hole,
 * and a solid circle reads as a rivet. The asymmetric border is what stops a
 * flat outline from looking like a drawn oval instead of metal.
 */
const ringStyle: CSSProperties = {
  width: 14,
  height: 22,
  borderRadius: `${RADIUS.pill}px`,
  border: `2px solid ${COLORS.gray400}`,
  borderRightColor: COLORS.gray300,
  borderBottomColor: COLORS.gray300,
  boxShadow: `0 1px 2px ${blackRgba(0.6)}`,
};

/**
 * A card-shaped box, sized from its row's height.
 *
 * HEIGHT IS THE FIXED AXIS and the width follows, which only works because the
 * row height is definite — `minHeight: 0` is what stops the slot's own
 * min-content re-imposing the floor the row just gave up.
 *
 * A version sized from WIDTH (`width: 100%` + `maxHeight: 100%`) was tried on
 * 2026-08-14 and reverted the same day. It looks like it fits both axes and does
 * not: `max-height` clamps the height but `aspect-ratio` does NOT re-derive the
 * width from the clamp, so on a short window the slot rendered 208x221 — ratio
 * 0.94 against a card's 0.72 — and the art overflowed into the row below. Fitting
 * BOTH axes is not expressible this way; that is what `spreadMaxHeight` is for.
 *
 * `margin: auto` centres the card when its column is wider than the card, which
 * happens whenever the pages have more width than the height budget can spend.
 */
const slotStyle: CSSProperties = {
  height: '100%',
  minHeight: 0,
  margin: 'auto',
  aspectRatio: `${CARD_ASPECT}`,
};

/*
 * SINGLE-PAGE MODE IS WIDTH-DRIVEN, the opposite of the spread. On a phone the
 * scarce axis is width, so the page fills the row and each slot takes its column's
 * width; `aspect-ratio` derives the height, the rows size to their slots, and the
 * page hugs the result. All of it is resolved by CSS in the first frame. Reusing
 * the spread's height cap here would have needed a measurement, which lands one
 * frame late, and with the arrows BELOW the page that late height would move them:
 * a layout shift on every load.
 */
const singlePageStyle: CSSProperties = {
  flex: '1 1 0',
  minWidth: 0,
  height: 'auto',
  // The width it is given, not a spread's height-drawn columns: a lone page sits in
  // no size container, where `100cqh` would read the viewport's height.
  gridTemplateColumns: `repeat(${PAGE_COLUMNS}, minmax(0, 1fr))`,
  gridTemplateRows: 'repeat(3, auto)',
};

const singleSlotStyle: CSSProperties = {
  width: '100%',
  aspectRatio: `${CARD_ASPECT}`,
};

/**
 * The tallest the spread may be before its DERIVED width stops fitting `width`.
 *
 * The layout sizes cards from height, so height is the only knob; capping it is
 * what keeps a tall, narrow window from producing a spread wider than itself.
 * Measured against the real page before this existed: 88px past the viewport at
 * 1440x900, 47px at 2560x1440, 588px at 1400x1400.
 *
 * Solved in JS rather than CSS on purpose. The constraint is `min()` of two
 * axes with different constants on each, and neither `aspect-ratio` nor
 * `max-*` can express it — every CSS attempt distorted the box instead of
 * shrinking it.
 */
function spreadMaxHeight(width: number, withArrows: boolean): number | undefined {
  if (width <= 0) return undefined;
  // Everything the eight cards do NOT get: the arrows and their gaps where they
  // are drawn, the board round the pages, the spine, and each page's padding and
  // column gaps.
  const chrome =
    (withArrows ? ARROWS_CHROME : 0) + 2 * BOARD + SPINE_WIDTH + 2 * (2 * PAGE_PADDING + 3 * SPACING.sm);
  const cardWidth = (width - chrome) / 8;
  if (cardWidth <= 0) return undefined;
  const cardHeight = cardWidth / CARD_ASPECT;
  // Three rows, two row gaps, the page's own vertical padding, and the board above and below.
  return 3 * cardHeight + 2 * SPACING.sm + 2 * PAGE_PADDING + 2 * BOARD;
}


/**
 * A card-shaped placeholder for one slot, so a binder that is still loading has the
 * SAME geometry as one that is not — the spread's chrome is rendered either way
 * and only the slot contents differ, which is what makes the swap shift-free.
 *
 * The cards are not known yet, so it is the neutral ink tile (InkCardPlaceholder).
 */
export function BinderSlotSkeleton() {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: `${RADIUS.sm}px`,
        overflow: 'hidden',
      }}>
      <InkCardPlaceholder />
    </div>
  );
}

interface BinderSpreadProps {
  /**
   * Absolute index of the first slot on the left page: -12 on a spread binder's first
   * spread, whose left page is then the inside front cover. A lone page starts at 0 or past.
   */
  start: number;
  /**
   * Slot content for an absolute index, or null for an empty pocket. The empty
   * slot still occupies its cell: collapsing it would reflow the trailing spread
   * into a different shape from every other one.
   *
   * `tabIndex` is the pocket's place in the Tab order: 0 for the one pocket in view
   * that Tab stops at, -1 for the rest (see `usePocketFocus`). Content that takes
   * focus passes it on and marks itself `data-roving-item`, as `CardTile` does. An
   * open pocket (`isOpen`) takes no focus, so it has no use for it.
   */
  renderSlot: (index: number, tabIndex: number) => ReactNode;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  /**
   * One page per view instead of a spread, for phone widths (owner, 2026-10-07).
   * A spread at 390px left each card ~26px wide; one page with the arrows moved
   * to a row underneath gives ~75px. Slots stay where they were: a page is still
   * the same 12-card block, so the caller pages by `PER_PAGE` instead of
   * `PER_SPREAD` and every card keeps its pocket.
   *
   * The CALLER decides, because the paging step is the caller's arithmetic and
   * the two must come from one fact. Read it from `useResponsive().isMobile`.
   */
  single?: boolean;
  /**
   * Where the page arrows go: beside the spread (the default), or, where Browse docks its
   * panels, on its outer edges, as small discs that grow under the pointer (owner,
   * 2026-10-22). There the spread fills its box's width from the top, with no padding of
   * its own, so its edges line up with what the page puts around it. A lone page keeps its
   * row of arrows under it either way.
   */
  arrows?: 'beside' | 'edges';
  /**
   * Drawn directly under a spread with its arrows on its edges: the collection binder's
   * spread map. The spread gives up only the height it needs.
   */
  footer?: ReactNode;
  /**
   * How many pockets the binder fills. A spread whose right page starts past the last
   * of them is the last, and that empty page is drawn as the inside back cover. It also
   * says how far through the binder a view is, for the sheet edges under its pages. Left
   * out (the loading binder), every page holds pockets and none has sheets under it.
   */
  cardCount?: number;
  /**
   * Whether a pocket the binder fills is open: drawn with nothing in it to press, as a promo set
   * draws a number that has no card yet (#805), so it takes no focus. The pockets' Tab stop and
   * arrow keys pass over it. A waiting promo's scan, which opens full size, is not open here.
   * Left out, every pocket the binder fills holds a card.
   */
  isOpen?: (index: number) => boolean;
}

/** The binder's ringed spine. A lone page keeps it, so it still reads as a binder. */
function Spine() {
  return (
    <div style={spineStyle} aria-hidden="true">
      <span style={ringStyle} />
      <span style={ringStyle} />
      <span style={ringStyle} />
    </div>
  );
}

/** The board's own layout round what it holds: a row, the pages and spine stretched to its height. */
const BOARD_ROW: CSSProperties = {display: 'flex', alignItems: 'stretch'};

/**
 * The binder's cover board round the pages and spine (#941), with the zip running round its
 * outer edge and its pull: the look is binder.css's, and its padding is `BOARD`, which the
 * spread's sizing counts. It tells binder.css how many sheet edges to draw under each page
 * (`sheets`) and how wide the spine between the two zips is.
 */
function Board({
  sheets,
  single = false,
  layout = BOARD_ROW,
  children,
}: {
  sheets: ViewSheets;
  single?: boolean;
  /** How it lays out what it holds: a row by default. */
  layout?: CSSProperties;
  children: ReactNode;
}) {
  const style = {
    ...layout,
    padding: BOARD,
    '--binder-spine': `${SPINE_WIDTH}px`,
    '--sheets-l': String(sheets.left),
    '--sheets-r': String(sheets.right),
  } as CSSProperties;
  return (
    <div className={single ? 'binder-board binder-board-single' : 'binder-board'} style={style}>
      {children}
      <span className="binder-zip-pull" aria-hidden="true" />
    </div>
  );
}

/** A cover: the inside front cover before the first page, or the inside back cover past the last card. */
type Cover = 'front' | 'back';

interface BinderPageProps {
  from: number;
  side: 'left' | 'right';
  single: boolean;
  renderSlot: (index: number) => ReactNode;
  /** Drawn as a cover, which holds no cards. */
  cover?: Cover;
}

const COVER_LABELS: Record<Cover, string> = {front: 'Front cover', back: 'Back cover'};

/** What a page is called: "Page" alone, or its side of the spread, or the cover it is. */
function pageLabel({side, single, cover}: Pick<BinderPageProps, 'side' | 'single' | 'cover'>): string {
  if (single) return 'Page';
  if (cover) return COVER_LABELS[cover];
  return side === 'left' ? 'Left page' : 'Right page';
}

/** A page's classes for binder.css: its side, for the sheets under it and its shade, and a cover's board. */
const pageClass = (side: 'left' | 'right', cover: Cover | undefined) =>
  `binder-page binder-page-${side}${cover ? ' binder-cover' : ''}`;

/**
 * One page of twelve pockets, slots sized for a spread or for a lone page. A cover keeps
 * its twelve slots, empty: a page takes its width from them, and without them it would
 * collapse. Empty whatever `renderSlot` gives, so a loading binder's shimmer stays off it.
 * Every slot on a page of cards is a pocket (`binder-pocket`), its sleeve and front sheet
 * drawn round whatever it holds, so one past the last card shows an empty sleeve.
 */
function BinderPage({from, side, single, renderSlot, cover}: BinderPageProps) {
  return (
    <div
      className={pageClass(side, cover)}
      // A labelled GROUP, not a section: three region landmarks for one binder
      // made the landmark list noise. The binder itself is the one region.
      role="group"
      style={single ? {...pageStyle(side), ...singlePageStyle} : pageStyle(side, cover !== undefined)}
      aria-label={pageLabel({side, single, cover})}>
      {Array.from({length: PER_PAGE}, (_, i) => (
        <div key={from + i} className={cover ? undefined : 'binder-pocket'} style={single ? singleSlotStyle : slotStyle}>
          {cover ? null : renderSlot(from + i)}
        </div>
      ))}
    </div>
  );
}

interface ViewProps {
  start: number;
  renderSlot: (index: number) => ReactNode;
  /** The page arrows: beside a spread or on its outer edges, or in a row under a lone page. */
  arrows: {prev: ReactNode; next: ReactNode};
  /** Under a spread with its arrows on its edges (see `BinderSpreadProps.footer`). */
  footer?: ReactNode;
  /** How many pockets the binder fills (see `BinderSpreadProps.cardCount`). */
  cardCount?: number;
  /** The sheets under each page, by how far through the binder the view is (see `viewSheets`). */
  sheets: ViewSheets;
}

/**
 * The two facing pages and the spine between them: the left one the front cover before the
 * first page, the right one the back cover once the cards run out.
 */
function Pages({start, renderSlot, cardCount}: Pick<ViewProps, 'start' | 'renderSlot' | 'cardCount'>) {
  const right = start + PER_PAGE;
  return (
    <>
      <BinderPage
        from={start}
        side="left"
        single={false}
        renderSlot={renderSlot}
        cover={start < 0 ? 'front' : undefined}
      />
      <Spine />
      <BinderPage
        from={right}
        side="right"
        single={false}
        renderSlot={renderSlot}
        cover={cardCount !== undefined && right >= cardCount ? 'back' : undefined}
      />
    </>
  );
}

/*
 * The height cap lives on the box around the pages, NOT on the row. The row keeps
 * `flex: 1` and therefore a constant height, so whatever sits below it never moves,
 * which matters because the cap arrived one frame late (ResizeObserver runs after
 * first paint). On the row itself that late arrival shrank it from 700px to 669px
 * and scored a 0.036 layout shift; on the inner box the same measurement only moves
 * content inside a box that never changed. Since #790 the first cap comes before the
 * first paint (see `useRowWidth`), but one after a resize still lands a frame late.
 */
const PAGES_BOX: CSSProperties = {
  minWidth: 0,
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'center',
  // A size container, so a spread page can read its own height (`SPREAD_COLUMN`). Safe
  // because nothing inside sizes this box: the row's flex, its height and the cap do.
  containerType: 'size',
};

/** An element's content-box width: what a ResizeObserver reports for it. */
function contentWidth(el: HTMLElement): number {
  const {paddingLeft, paddingRight} = getComputedStyle(el);
  return Math.max(0, el.getBoundingClientRect().width - parseFloat(paddingLeft) - parseFloat(paddingRight));
}

/**
 * The row's width, from before the first paint and on every resize after it.
 *
 * MEASURED IN A LAYOUT EFFECT TOO (#790). `useContainerWidth` reads its first width
 * after the first paint, and the collection binder remounts on every new set, sort or
 * filter (keyed by its cards, see `CollectionBinderSection`), so each switch painted a
 * frame with no height cap: at 1920x1080, one frame of 257px cards before the capped
 * 200px, on every switch. The layout effect reads it before that paint.
 */
function useRowWidth(ref: RefObject<HTMLDivElement | null>): number {
  const observed = useContainerWidth(ref);
  const [first, setFirst] = useState(0);
  useLayoutEffect(() => {
    if (ref.current) setFirst(contentWidth(ref.current));
  }, [ref]);
  return observed > 0 ? observed : first;
}

/** Two facing pages, sized from the height they are given, arrows either side. */
function FlankedSpread({start, renderSlot, arrows, cardCount, sheets}: ViewProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const maxHeight = spreadMaxHeight(useRowWidth(rowRef), true);
  return (
    // The arrows are FLEX SIBLINGS of the pages, not an overlay. Overlaying them
    // was tried and reverted the same hour: the spread's width is derived from its
    // height, so on a tall window it is wider than the viewport, and absolutely-
    // positioned arrows landed 80-580px inside the cards. Laid out in the row
    // they are beside the pages at every size by construction.
    <div
      ref={rowRef}
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        padding: `${SPACING.sm}px ${SPACING.sm}px 0`,
      }}>
      {arrows.prev}
      <div style={{...PAGES_BOX, flex: '1 1 0', height: '100%', maxHeight}}>
        <Board sheets={sheets}>
          <Pages start={start} renderSlot={renderSlot} cardCount={cardCount} />
        </Board>
      </div>
      {arrows.next}
    </div>
  );
}

/**
 * An arrow on the spread's outer edge, where Browse docks its panels (owner, 2026-10-22):
 * halfway down it, the disc's centre a little past the board's edge (the page's, before the
 * board came round the pages, #941), so at rest it covers the board's edge and stops short of
 * the page, the rest of it in the gutter beside the spread. Grown under the pointer, it reaches
 * onto the page's margin and stays clear of the pockets. A page that takes spare width (see
 * `EDGE_FRAME`) has a wider margin, which keeps the disc further from its pockets. Over them,
 * so a pocket's glow under the pointer never covers it.
 */
function edgeArrowPlace(side: 'left' | 'right'): CSSProperties {
  return {
    position: 'absolute',
    zIndex: 2,
    top: `calc(50% - ${EDGE_DISC_SIZE / 2}px)`,
    [side]: PAGE_PADDING - EDGE_DISC_SIZE,
  };
}

/** An arrow's props for the spread's outer edge on `side`, where the arrows go there. */
function onEdge(side: 'left' | 'right', edges: boolean) {
  return edges ? {edge: true, style: edgeArrowPlace(side)} : {};
}

/**
 * The spread itself, filling the width of the box the height cap sizes: two equal pages
 * either side of the spine, in the board (#941), so the arrows laid over its outer edges sit
 * on the box's edges. Arrows laid over the row instead landed inside the cards (see
 * `FlankedSpread`).
 *
 * THE PAGES TAKE THE WIDTH THE HEIGHT LEAVES (owner, 2026-10-23). Where the height runs out
 * first, the cards stop short of the box's width: 42px short at 1920x900. The spread hugged
 * its pages then, so that width fell to its right, and its right edge stopped short of the
 * search bar's end. Now each page takes half of it, as margin around its pockets.
 */
const EDGE_FRAME: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  flex: 1,
  height: '100%',
};

/**
 * Two facing pages with the arrows on their outer edges, anchored to the top of their box:
 * unpadded, so the spread's top and side edges are the box's, and level with the docked
 * panels beside it. A column, so the pages give the footer the height it needs.
 *
 * THE FOOTER SITS ON THE BOX'S BOTTOM EDGE (owner, 2026-10-12), level with the panels'
 * bottoms, and any height the pages leave over falls between the two. It also holds still
 * when the height cap arrives a frame late: under the pages, the footer rose with them.
 *
 * BOTH SIDE EDGES ARE THE BOX'S: the left under the search bar's start (owner, 2026-10-08),
 * the right under its end (owner, 2026-10-23), the pages widening to meet it where the height
 * runs out first (see `EDGE_FRAME`). Pinned left, so on the one paint before a resize's new
 * height cap lands, a spread too wide for its box runs past its right edge, never its left.
 */
function StackedSpread({start, renderSlot, arrows, footer, cardCount, sheets}: ViewProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const maxHeight = spreadMaxHeight(useRowWidth(rowRef), false);
  return (
    <div
      ref={rowRef}
      style={{flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
      <div style={{...PAGES_BOX, justifyContent: 'flex-start', flex: '1 1 0', minHeight: 0, maxHeight}}>
        <Board sheets={sheets} layout={EDGE_FRAME}>
          {arrows.prev}
          <Pages start={start} renderSlot={renderSlot} cardCount={cardCount} />
          {arrows.next}
        </Board>
      </div>
      {footer}
    </div>
  );
}

/** Two facing pages, the arrows beside them or on their outer edges. */
function SpreadView({edges, ...props}: ViewProps & {edges: boolean}) {
  return edges ? <StackedSpread {...props} /> : <FlankedSpread {...props} />;
}

/**
 * One page, sized from the width (see `singlePageStyle`), arrows in a row below.
 * The lone page is the RIGHT-hand sheet: rings on its left edge, so it still reads
 * as a page in a binder rather than a loose card grid, in a board with one zip
 * round it (#941). Nothing here is measured, which is what keeps the arrows below
 * it from moving after first paint.
 */
function SingleView({start, renderSlot, arrows, sheets}: ViewProps) {
  return (
    <>
      <div style={{padding: `${SPACING.sm}px ${SPACING.sm}px 0`}}>
        <Board sheets={sheets} single>
          <Spine />
          <BinderPage from={start} side="right" single renderSlot={renderSlot} />
        </Board>
      </div>
      <div style={{display: 'flex', justifyContent: 'center', gap: SPACING.xxl, paddingTop: SPACING.sm}}>
        {arrows.prev}
        {arrows.next}
      </div>
    </>
  );
}

/** A pocket's place on the grid in view: a spread's two pages side by side are eight columns. */
interface Cell {
  row: number;
  col: number;
}

const cellOf = (pocket: number): Cell => {
  const onPage = pocket % PER_PAGE;
  return {
    row: Math.floor(onPage / PAGE_COLUMNS),
    col: Math.floor(pocket / PER_PAGE) * PAGE_COLUMNS + (onPage % PAGE_COLUMNS),
  };
};

const pocketAt = ({row, col}: Cell): number =>
  Math.floor(col / PAGE_COLUMNS) * PER_PAGE + row * PAGE_COLUMNS + (col % PAGE_COLUMNS);

/** Where each arrow key steps on that grid. */
const STEPS = new Map<string, Cell>([
  ['ArrowRight', {row: 0, col: 1}],
  ['ArrowLeft', {row: 0, col: -1}],
  ['ArrowDown', {row: 1, col: 0}],
  ['ArrowUp', {row: -1, col: 0}],
]);

/** The pockets in view: which take focus and how many pages across they sit. */
interface PocketView {
  /** The pockets in view that hold a card, by their place in the view, in order. */
  focusable: readonly number[];
  /** Pages across: two for a spread, one for a lone page. */
  pages: number;
}

const onGrid = ({row, col}: Cell, pages: number) =>
  row >= 0 && row < PAGE_ROWS && col >= 0 && col < pages * PAGE_COLUMNS;

/**
 * The pocket an arrow steps to from the cell `from`: the next one that way with a card in it,
 * past any open or empty pocket, or null where the grid ends first.
 */
function stepFrom(from: Cell, step: Cell, view: PocketView): number | null {
  const to = {row: from.row + step.row, col: from.col + step.col};
  if (!onGrid(to, view.pages)) return null;
  const pocket = pocketAt(to);
  return view.focusable.includes(pocket) ? pocket : stepFrom(to, step, view);
}

/** A key with a modifier is the browser's or the reader's (Alt+Left goes back), not the binder's. */
const isModified = (e: KeyboardEvent) => e.altKey || e.ctrlKey || e.metaKey;

/**
 * Where a key takes focus from pocket `from` (undefined when focus is on no card): an arrow to
 * the next card that way, Home and End to the first and last.
 */
function pocketForKey(e: KeyboardEvent, from: number | undefined, view: PocketView): number | null {
  if (from === undefined || isModified(e)) return null;
  const {focusable} = view;
  if (e.key === 'Home') return focusable[0];
  if (e.key === 'End') return focusable[focusable.length - 1];
  const step = STEPS.get(e.key);
  return step ? stepFrom(cellOf(from), step, view) : null;
}

const NEVER_OPEN = () => false;

/**
 * The pockets in view that hold a card, by their place in it: the filled ones, which run from
 * the first card, past the front cover's page on the first spread (#806), less any open one.
 * Every pocket while the binder is loading.
 */
function focusableInView(
  start: number,
  perView: number,
  {cardCount, isOpen = NEVER_OPEN}: Pick<BinderSpreadProps, 'cardCount' | 'isOpen'>,
): number[] {
  const first = Math.max(0, -start);
  const filled = cardCount === undefined ? perView : Math.max(0, Math.min(perView, cardCount - start));
  const inView = Array.from({length: filled}, (_, pocket) => pocket);
  return inView.filter((pocket) => pocket >= first && !isOpen(start + pocket));
}

/**
 * The cards in view, from an event in the binder: their tiles, the pockets they sit in, and
 * the pocket of the card the event came from (undefined for anything else, such as an arrow).
 * The tiles run in their pockets' order. A caller that leaves `cardCount` out may fill fewer
 * pockets than the view holds, so the tiles have the last word on how many cards there are.
 */
function cardsAt(e: SyntheticEvent<HTMLElement>, view: PocketView) {
  const tiles = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-roving-item]')];
  const focusable = view.focusable.slice(0, tiles.length);
  const tile = tiles.indexOf(e.target as HTMLElement);
  return {tiles, view: {...view, focusable}, from: tile < 0 ? undefined : focusable[tile]};
}

/**
 * ONE TAB STOP FOR THE POCKETS (#790): Tab enters the view on one card and leaves it with
 * the next press, and the arrow keys move between its cards, across the spine too, with
 * Home and End going to the first and last. Before, every card was a Tab stop, so whatever
 * came after the binder sat 25 presses past it on every spread. The card focused last
 * keeps the stop, however it took focus (a key, a click, the card modal handing it back),
 * and a new view starts on its first card. An open pocket holds no card (a promo set's,
 * #805), so the stop and the arrow keys pass over it.
 *
 * Not `useRovingTabIndex`, which reads its items as one grid, row by row. A spread's
 * pockets run page by page, so its Right from the left page's last column would drop to
 * the next row instead of crossing the spine, and it follows only the focus its own keys move.
 */
function usePocketFocus(start: number, view: PocketView) {
  const [last, setLast] = useState({start, pocket: 0});
  const stop = last.start === start && view.focusable.includes(last.pocket) ? last.pocket : view.focusable[0];
  return {
    tabIndexFor: (index: number) => (index - start === stop ? 0 : -1),
    onFocus: (e: FocusEvent<HTMLElement>) => {
      const {from} = cardsAt(e, view);
      if (from !== undefined) setLast({start, pocket: from});
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      const cards = cardsAt(e, view);
      const to = pocketForKey(e, cards.from, cards.view);
      if (to === null) return;
      e.preventDefault();
      cards.tiles[cards.view.focusable.indexOf(to)].focus();
    },
  };
}

const NO_SHEETS: ViewSheets = {left: 0, right: 0};

/**
 * The sheets under each page of the view from `start` (see `viewSheets`): how far through
 * the binder it is, from the view's place among them all. None while the binder loads.
 */
function sheetsAt(start: number, single: boolean, cardCount: number | undefined): ViewSheets {
  if (cardCount === undefined) return NO_SHEETS;
  const perView = single ? PER_PAGE : PER_SPREAD;
  // A spread binder's views start a page in, for the front cover (see `start`).
  const lead = single ? 0 : PER_PAGE;
  return viewSheets((start + lead) / perView, Math.max(1, Math.ceil((cardCount + lead) / perView)), single);
}

export function BinderSpread({
  start,
  renderSlot,
  onPrev,
  onNext,
  canPrev,
  canNext,
  single = false,
  arrows = 'beside',
  footer,
  cardCount,
  isOpen,
}: BinderSpreadProps) {
  const unit = single ? 'page' : 'spread';
  const perView = single ? PER_PAGE : PER_SPREAD;
  const focusable = focusableInView(start, perView, {cardCount, isOpen});
  const pockets = usePocketFocus(start, {focusable, pages: single ? 1 : 2});
  const edges = arrows === 'edges' && !single;
  const views: ViewProps = {
    start,
    renderSlot: (index) => renderSlot(index, pockets.tabIndexFor(index)),
    footer,
    cardCount,
    sheets: sheetsAt(start, single, cardCount),
    arrows: {
      prev: (
        <NavArrowButton
          direction="prev"
          label={`Previous ${unit}`}
          onClick={onPrev}
          atEnd={!canPrev}
          {...onEdge('left', edges)}
        />
      ),
      next: (
        <NavArrowButton
          direction="next"
          label={`Next ${unit}`}
          onClick={onNext}
          atEnd={!canNext}
          {...onEdge('right', edges)}
        />
      ),
    },
  };
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- roving tabindex: the arrow keys move between the pockets (#790)
    <section
      aria-label="Binder"
      onKeyDown={pockets.onKeyDown}
      onFocus={pockets.onFocus}
      style={{...BINDER_LOOK, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0}}>
      {single ? <SingleView {...views} /> : <SpreadView {...views} edges={edges} />}
    </section>
  );
}
