import {forwardRef, type CSSProperties, type ReactNode} from 'react';
import {VirtuosoGrid} from 'react-virtuoso';
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

interface ListContainerProps {
  style?: CSSProperties;
  children?: ReactNode;
}

interface ListContainerConfig {
  paddingX: number;
  minColWidth: number;
}

// CSS Grid handles responsive column count via auto-fill + minmax.
// IMPORTANT: VirtuosoGrid imperatively writes BOTH `paddingTop` (offset for
// items above the rendered range) and `paddingBottom` (offset below) for its
// virtual scroll positioning. Setting either here would block the effect cycle:
// hardcoded paddingTop pins items to the top of the List instead of letting
// them shift to their virtual row. Only horizontal padding is safe to set.
// The room above and below the cards comes from `GridHeader` and `GridFooter`.
const createListContainer = ({paddingX, minColWidth}: ListContainerConfig) =>
  forwardRef<HTMLDivElement, ListContainerProps>(function ListContainer(
    {style, children},
    ref,
  ) {
    return (
      <div
        ref={ref}
        style={{
          ...style,
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${minColWidth}px, 1fr))`,
          gap: SPACING.md,
          paddingLeft: paddingX,
          paddingRight: paddingX,
        }}>
        {children}
      </div>
    );
  });

/**
 * The room above the first row, inside the scroller: a pointed-at card's glow reaches past the
 * tile, and the scroller clips whatever lies outside it. Above the scroller, in the toolbar's
 * padding, the top of the first row's glow was cut off.
 */
const GridHeader = () => <div style={{height: BROWSE_ROW_TOP}} />;

/** The room under the last row, for its glow too: the grid ends level with the panels. */
const GridFooter = () => <div style={{height: SPACING.xxl}} />;

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
  const ListContainer = createListContainer({paddingX, minColWidth});

  if (isLoading) {
    // The loaded grid's room above its first row (`GridHeader`) and its gutters (#914).
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
          padding: 64,
          color: COLORS.textMuted,
          fontSize: `${FONT_SIZES.xl}px`,
        }}>
        No cards match your filters.
      </div>
    );
  }

  return (
    <RenderProfiler id="BrowseCardGrid">
      <VirtuosoGrid
        totalCount={displayedCards.length}
        components={{List: ListContainer, Header: GridHeader, Footer: GridFooter}}
        itemContent={(index) => {
          const card = displayedCards[index];
          // No `isSelected`: a card without a page is a plain button that opens it, not a toggle.
          return (
            <CardTile
              card={card}
              href={hasCardPage(card) ? tilePath(card) : undefined}
              onSelect={onCardSelect}
              variant="minimal"
              priority={index < 6}
              useSmallImage
              printing={printingFor?.(card)}
            />
          );
        }}
        style={{height: '100%'}}
      />
    </RenderProfiler>
  );
}
