import {useLayoutEffect, useRef, useState, type ReactNode, type RefObject} from 'react';
import {flushSync} from 'react-dom';
import type {CardPrinting, LorcanaCard} from 'inkweave-synergy-engine';
import {cardPath} from 'inkweave-synergy-engine/card';
import {CardTile} from './CardTile';
import {COLORS, FONT_SIZES, LAYOUT, SPACING} from '../../../shared/constants';
import {RenderProfiler} from '../../../shared/components';
import {useResponsive} from '../../../shared/hooks';
import {CardGridSkeleton} from './CardGridSkeleton';
import {BROWSE_GUTTER, browseRowTop} from './BrowseSidePanel';

interface BrowseCardGridProps {
  cards: LorcanaCard[];
  isLoading: boolean;
  onCardSelect: (card: LorcanaCard) => void;
  /** The printing a card's tile shows instead of its own art (see `CardTile`'s `printing`). */
  printingFor?: (card: LorcanaCard) => CardPrinting | undefined;
  /**
   * Whether a tile's card has a page to link to: by default every card does. A sets 1-8 card
   * in Browse's search results has none (#911), so its tile is a button that opens the card
   * window, and never a link to "Card not found".
   */
  hasCardPage?: (card: LorcanaCard) => boolean;
}

/** The room around "No cards match", past the spacing scale's top step (SPACING.xxxl, 32). */
const NO_MATCH_PADDING = 64;

/**
 * A tile's card page. A promo's tile is its card on that promo (#805), and only the card has a
 * page, so the tile links there: a click opens the promo in the modal, a new tab opens the card.
 */
const tilePath = (card: LorcanaCard) => cardPath({id: card.baseId ?? card.id, fullName: card.fullName});

const everyCardHasAPage = () => true;

export function BrowseCardGrid({
  cards,
  isLoading,
  onCardSelect,
  printingFor,
  hasCardPage = everyCardHasAPage,
}: BrowseCardGridProps) {
  const {isMobile} = useResponsive();
  const paddingX = isMobile ? SPACING.lg : BROWSE_GUTTER;
  const minColWidth = isMobile ? LAYOUT.cardGridMinWidthMobile : LAYOUT.cardGridMinWidth;
  const rowTop = browseRowTop(isMobile);
  const eagerTiles = isMobile ? PHONE_EAGER_TILES : EAGER_TILES;

  if (isLoading) {
    // The loaded grid's room above its first row (`browseRowTop`) and its gutters; its
    // columns follow from the same minimum (#914).
    return <CardGridSkeleton padding={`${rowTop}px ${paddingX}px 0`} />;
  }

  const displayedCards = cards.slice(0, LAYOUT.maxDisplayedCards);

  if (displayedCards.length === 0) {
    // Not a live region: Browse's status line (BrowsePage.tsx) says it, so it is said once.
    return (
      <div
        style={{
          textAlign: 'center',
          padding: NO_MATCH_PADDING,
          color: COLORS.textMuted,
          fontSize: `${FONT_SIZES.xl}px`,
        }}>
        No cards match your filters.
      </div>
    );
  }

  return (
    <RenderProfiler id="BrowseCardGrid">
      <TileRows
        cards={displayedCards}
        sizing={{paddingX, minColWidth, rowTop}}
        eagerTiles={eagerTiles}
        renderTile={(card, index) => (
          // No `isSelected`: a card without a page is a plain button that opens it, not a toggle.
          <CardTile
            key={card.id}
            card={card}
            href={hasCardPage(card) ? tilePath(card) : undefined}
            onSelect={onCardSelect}
            variant="minimal"
            priority={index < eagerTiles}
            useSmallImage
            printing={printingFor?.(card)}
          />
        )}
      />
    </RenderProfiler>
  );
}

/**
 * Tiles whose art loads at once, since the page's largest paint is one of them: the first six,
 * a tablet's or a desktop's first row or two. The rest load as they near the view.
 */
const EAGER_TILES = 6;

/** On a phone, nine: its first three rows, three across (#968). */
const PHONE_EAGER_TILES = 9;

/** Rows drawn past each edge of the view: keyboard Tab moves into one, and focus scrolls it in. */
const OVERSCAN_ROWS = 1;

/** The gap between tiles, across and down. */
const TILE_GAP = SPACING.md;

interface ScrollerView {
  /** The grid's width, unrounded, as auto-fill lays out its columns in it. */
  width: number;
  top: number;
  height: number;
}

const UNMEASURED: ScrollerView = {width: 0, top: 0, height: 0};

/**
 * The scroller's view: the grid's width, the scroll offset and the scroller's height, read before
 * paint, after every commit, and on scroll and resize. A scroll is drawn inside its own event, as
 * react-virtuoso drew it: a render left for later reaches the screen a frame after the scroll, and
 * a fast scroll shows blank rows meanwhile. A read that would draw the same tiles (`sameWindow`)
 * renders nothing, keeping the view last drawn: a list that changes before the next scroll counts
 * its rows from an offset at most a row from the real one, which `OVERSCAN_ROWS` covers. A hidden
 * scroller measures 0 wide and keeps its last view: the prerender crawl marks a phone
 * page's #root before it reads it, which takes the root out of the layout there (#915). Without
 * ResizeObserver nothing is read, so a resize can't leave a stale window: every tile is drawn.
 */
function useScrollerView(
  scrollerRef: RefObject<HTMLElement | null>,
  gridRef: RefObject<HTMLElement | null>,
  sameWindow: (shown: ScrollerView, next: ScrollerView) => boolean,
): ScrollerView {
  const [view, setView] = useState(UNMEASURED);
  const sameWindowRef = useRef(sameWindow);
  const readRef = useRef(() => {});
  useLayoutEffect(() => {
    sameWindowRef.current = sameWindow;
  });
  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const scroller = scrollerRef.current;
    const grid = gridRef.current;
    if (!scroller || !grid) return;
    let shown = UNMEASURED;
    const read = () => {
      const width = grid.getBoundingClientRect().width;
      if (width === 0) return;
      const next = {width, top: scroller.scrollTop, height: scroller.clientHeight};
      if (sameWindowRef.current(shown, next)) return;
      shown = next;
      setView(next);
    };
    const onScroll = () => flushSync(read);
    readRef.current = read;
    read();
    scroller.addEventListener('scroll', onScroll, {passive: true});
    const observer = new ResizeObserver(read);
    // The grid too, which a scrollbar narrows: on CI's WebKit, watching the scroller alone once
    // left the undrawn rows' room measured from the width before its scrollbar appeared.
    observer.observe(scroller);
    observer.observe(grid);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      observer.disconnect();
      readRef.current = () => {};
    };
  }, [scrollerRef, gridRef]);
  // A commit that changes the undrawn rows' room can bring a classic scrollbar in or take it away,
  // and with it the grid's width. The observer sees that within the frame, but its render lands
  // after the paint, which shows room worked out from the old width: so each commit reads again.
  useLayoutEffect(() => {
    readRef.current();
  });
  return view;
}

/** The tiles a render draws, as [first, end), and the undrawn rows' room. */
interface DrawnTiles {
  first: number;
  end: number;
  roomAbove: number;
  roomBelow: number;
}

/**
 * What sizes and places a tile: the gutters either side of the grid, a column's narrowest width,
 * and the room above the first row (`browseRowTop`).
 */
interface TileSizing {
  paddingX: number;
  minColWidth: number;
  rowTop: number;
}

/**
 * The tiles to draw before the scroller is measured: those whose art loads at once. React creates
 * their images as it renders the grid, often well before the commit that measures the scroller,
 * and the browser starts loading their art then, so it can be in hand as they mount and show
 * with no fade, as react-virtuoso's first tiles did (#931). A browser measures the scroller
 * before its first paint unless it is hidden. jsdom never measures it, so there every tile is
 * drawn.
 */
function firstTiles(count: number, eagerTiles: number): DrawnTiles {
  return {
    first: 0,
    end: typeof ResizeObserver === 'undefined' ? count : eagerTiles,
    roomAbove: 0,
    roomBelow: 0,
  };
}

/**
 * The tiles of the rows in view and `OVERSCAN_ROWS` past each edge. Every tile is the same
 * size, so a row's height follows from the grid's width, in the columns auto-fill fits there.
 */
function tilesInView(view: ScrollerView, count: number, sizing: TileSizing): DrawnTiles {
  const inner = view.width - 2 * sizing.paddingX;
  const columns = Math.max(1, Math.floor((inner + TILE_GAP) / (sizing.minColWidth + TILE_GAP)));
  const rowHeight = (inner - (columns - 1) * TILE_GAP) / columns / LAYOUT.cardAspect + TILE_GAP;
  const rowCount = Math.ceil(count / columns);
  const [firstRow, endRow] = rowWindow(view, rowHeight, rowCount, sizing.rowTop);
  return {
    first: firstRow * columns,
    end: endRow * columns,
    roomAbove: firstRow * rowHeight,
    roomBelow: (rowCount - endRow) * rowHeight,
  };
}

/**
 * Whether two views draw the same tiles: the same size, and the same rows. The rows' room follows
 * from those, so the render would be the same.
 */
function sameTiles(shown: ScrollerView, next: ScrollerView, count: number, sizing: TileSizing) {
  if (shown.width !== next.width || shown.height !== next.height) return false;
  const a = tilesInView(shown, count, sizing);
  const b = tilesInView(next, count, sizing);
  return a.first === b.first && a.end === b.end;
}

/**
 * The rows to draw, as [first, end): those in view and `OVERSCAN_ROWS` past each edge. A shorter
 * list (a filter, scrolled far down) lowers the grid, and the browser pulls the scroller's offset
 * back within it: the rows are those of the offset it will have, so they show at once.
 */
function rowWindow(view: ScrollerView, rowHeight: number, rowCount: number, rowTop: number): [number, number] {
  const height = rowTop + rowCount * rowHeight - TILE_GAP + SPACING.xxl;
  const top = Math.max(0, Math.min(view.top, height - view.height));
  const clamp = (row: number, min: number) => Math.min(rowCount, Math.max(min, row));
  const first = clamp(Math.floor((top - rowTop) / rowHeight) - OVERSCAN_ROWS, 0);
  const end = clamp(Math.ceil((top + view.height - rowTop) / rowHeight) + OVERSCAN_ROWS, first);
  return [first, end];
}

/**
 * The scroller and the rows of tiles near its view: the rest are drawn as they scroll near, and
 * the grid's padding holds their room.
 */
function TileRows({
  cards,
  sizing,
  eagerTiles,
  renderTile,
}: {
  cards: LorcanaCard[];
  sizing: TileSizing;
  /** The tiles drawn before the scroller is measured, whose art loads at once. */
  eagerTiles: number;
  renderTile: (card: LorcanaCard, index: number) => ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const {paddingX, minColWidth, rowTop} = sizing;
  const view = useScrollerView(scrollerRef, gridRef, (shown, next) =>
    sameTiles(shown, next, cards.length, sizing),
  );
  const tiles =
    view.width > 0 ? tilesInView(view, cards.length, sizing) : firstTiles(cards.length, eagerTiles);

  return (
    <div
      ref={scrollerRef}
      data-testid="browse-grid-scroller"
      // No scroll anchoring: the drawn rows change under it as it scrolls, and the padding that
      // replaces them already keeps every tile in place.
      style={{height: '100%', overflowY: 'auto', overflowAnchor: 'none'}}>
      <div
        ref={gridRef}
        style={{
          display: 'grid',
          // auto-fill, even once measured: a prerendered page shown on a screen of another width
          // lays its tiles out in that screen's columns, as `tilesInView` counts them.
          gridTemplateColumns: `repeat(auto-fill, minmax(${minColWidth}px, 1fr))`,
          gap: TILE_GAP,
          // Room above the first row and under the last, inside the scroller: a pointed-at
          // card's glow reaches past its tile, and the scroller clips whatever lies outside it.
          // The last row ends level with the docked panels. Undrawn rows add their own height.
          paddingTop: rowTop + tiles.roomAbove,
          paddingBottom: SPACING.xxl + tiles.roomBelow,
          paddingLeft: paddingX,
          paddingRight: paddingX,
        }}>
        {cards.slice(tiles.first, tiles.end).map((card, i) => renderTile(card, tiles.first + i))}
      </div>
    </div>
  );
}
