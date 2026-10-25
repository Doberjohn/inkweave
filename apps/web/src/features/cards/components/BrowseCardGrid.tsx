import {useLayoutEffect, useRef, useState, type ReactNode, type RefObject} from 'react';
import {flushSync} from 'react-dom';
import type {CardPrinting, LorcanaCard} from 'inkweave-synergy-engine';
import {cardPath} from 'inkweave-synergy-engine/card';
import {CardTile} from './CardTile';
import {COLORS, FONT_SIZES, LAYOUT, SPACING} from '../../../shared/constants';
import {RenderProfiler} from '../../../shared/components';
import {useResponsive} from '../../../shared/hooks';
import {CardGridSkeleton} from './CardGridSkeleton';
import {BROWSE_GUTTER, BROWSE_ROW_TOP} from './BrowseSidePanel';

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

  if (isLoading) {
    // The loaded grid's room above its first row (`BROWSE_ROW_TOP`) and its gutters (#914).
    return <CardGridSkeleton padding={`${BROWSE_ROW_TOP}px ${paddingX}px 0`} />;
  }

  const displayedCards = cards.slice(0, LAYOUT.maxDisplayedCards);

  if (displayedCards.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
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
        paddingX={paddingX}
        minColWidth={isMobile ? LAYOUT.cardGridMinWidthMobile : LAYOUT.cardGridMinWidth}
        renderTile={(card, index) => (
          // No `isSelected`: a card without a page is a plain button that opens it, not a toggle.
          <CardTile
            key={card.id}
            card={card}
            href={hasCardPage(card) ? tilePath(card) : undefined}
            onSelect={onCardSelect}
            variant="minimal"
            priority={index < EAGER_TILES}
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
 * a phone's first three rows. The rest load as they near the view.
 */
const EAGER_TILES = 6;

/** A tile's width over its height: CardTile's `aspectRatio`. */
const TILE_ASPECT = 0.72;

/** Rows drawn past each edge of the view: keyboard Tab moves into one, and focus scrolls it in. */
const OVERSCAN_ROWS = 1;

/** The gap between tiles, across and down. */
const TILE_GAP = SPACING.md;

interface ScrollerView {
  width: number;
  top: number;
  height: number;
}

/**
 * The scroller's width, scroll offset and height: read before paint, then on scroll and resize.
 * A scroll is drawn inside its own event, as react-virtuoso drew it: a render left for later
 * reaches the screen a frame after the scroll, and a fast scroll shows blank rows meanwhile. A
 * hidden scroller measures 0 wide and keeps its last view: the prerender crawl marks a phone
 * page's #root before it reads it, which takes the root out of the layout there (#915).
 */
function useScrollerView(ref: RefObject<HTMLElement | null>): ScrollerView {
  const [view, setView] = useState<ScrollerView>({width: 0, top: 0, height: 0});
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      if (el.clientWidth === 0) return;
      setView({width: el.clientWidth, top: el.scrollTop, height: el.clientHeight});
    };
    const onScroll = () => flushSync(read);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    el.addEventListener('scroll', onScroll, {passive: true});
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [ref]);
  return view;
}

/** The tiles a render draws, as [first, end), the grid's columns, and the undrawn rows' room. */
interface DrawnTiles {
  first: number;
  end: number;
  columns: string;
  roomAbove: number;
  roomBelow: number;
}

/** What sizes a tile: the gutters either side of the grid, and a column's narrowest width. */
interface TileSizing {
  paddingX: number;
  minColWidth: number;
}

/**
 * The tiles to draw before the scroller is measured: the first `EAGER_TILES`. React creates
 * their images as it renders the grid, often well before the commit that measures the scroller,
 * and the browser starts loading their art then, so it can be in hand as they mount and show
 * with no fade, as react-virtuoso's first tiles did (#931). A browser measures the scroller
 * before its first paint unless it is hidden, and auto-fill lays these tiles out in the columns
 * `tilesInView` counts. jsdom never measures it, so there every tile is drawn.
 */
function firstTiles(count: number, sizing: TileSizing): DrawnTiles {
  return {
    first: 0,
    end: typeof ResizeObserver === 'undefined' ? count : EAGER_TILES,
    columns: `repeat(auto-fill, minmax(${sizing.minColWidth}px, 1fr))`,
    roomAbove: 0,
    roomBelow: 0,
  };
}

/**
 * The tiles of the rows in view and `OVERSCAN_ROWS` past each edge. Every tile is the same
 * size, so a row's height follows from the scroller's width.
 */
function tilesInView(view: ScrollerView, count: number, sizing: TileSizing): DrawnTiles {
  const inner = view.width - 2 * sizing.paddingX;
  const columns = Math.max(1, Math.floor((inner + TILE_GAP) / (sizing.minColWidth + TILE_GAP)));
  const rowHeight = (inner - (columns - 1) * TILE_GAP) / columns / TILE_ASPECT + TILE_GAP;
  const rowCount = Math.ceil(count / columns);
  const [firstRow, endRow] = rowWindow(view, rowHeight, rowCount);
  return {
    first: firstRow * columns,
    end: endRow * columns,
    columns: `repeat(${columns}, 1fr)`,
    roomAbove: firstRow * rowHeight,
    roomBelow: (rowCount - endRow) * rowHeight,
  };
}

/**
 * The rows to draw, as [first, end): those in view and `OVERSCAN_ROWS` past each edge. A shorter
 * list (a filter, scrolled far down) lowers the grid, and the browser pulls the scroller's offset
 * back within it: the rows are those of the offset it will have, so they show at once.
 */
function rowWindow(view: ScrollerView, rowHeight: number, rowCount: number): [number, number] {
  const height = BROWSE_ROW_TOP + rowCount * rowHeight - TILE_GAP + SPACING.xxl;
  const top = Math.max(0, Math.min(view.top, height - view.height));
  const clamp = (row: number, min: number) => Math.min(rowCount, Math.max(min, row));
  const first = clamp(Math.floor((top - BROWSE_ROW_TOP) / rowHeight) - OVERSCAN_ROWS, 0);
  const end = clamp(
    Math.ceil((top + view.height - BROWSE_ROW_TOP) / rowHeight) + OVERSCAN_ROWS,
    first,
  );
  return [first, end];
}

/**
 * The scroller and the rows of tiles near its view: the rest are drawn as they scroll near, and
 * the grid's padding holds their room.
 */
function TileRows({
  cards,
  paddingX,
  minColWidth,
  renderTile,
}: {
  cards: LorcanaCard[];
  paddingX: number;
  minColWidth: number;
  renderTile: (card: LorcanaCard, index: number) => ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const view = useScrollerView(scrollerRef);
  const sizing = {paddingX, minColWidth};
  const tiles =
    view.width > 0 ? tilesInView(view, cards.length, sizing) : firstTiles(cards.length, sizing);

  return (
    <div
      ref={scrollerRef}
      data-testid="browse-grid-scroller"
      style={{height: '100%', overflowY: 'auto'}}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: tiles.columns,
          gap: TILE_GAP,
          // Room above the first row and under the last, inside the scroller: a pointed-at
          // card's glow reaches past its tile, and the scroller clips whatever lies outside it.
          // The last row ends level with the docked panels. Undrawn rows add their own height.
          paddingTop: BROWSE_ROW_TOP + tiles.roomAbove,
          paddingBottom: SPACING.xxl + tiles.roomBelow,
          paddingLeft: paddingX,
          paddingRight: paddingX,
        }}>
        {cards.slice(tiles.first, tiles.end).map((card, i) => renderTile(card, tiles.first + i))}
      </div>
    </div>
  );
}
