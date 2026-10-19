import {forwardRef, type CSSProperties, type ReactNode} from 'react';
import {VirtuosoGrid} from 'react-virtuoso';
import type {CardPrinting, LorcanaCard} from 'inkweave-synergy-engine';
import {cardPath} from 'inkweave-synergy-engine/card';
import {CardTile} from './CardTile';
import {COLORS, FONT_SIZES, LAYOUT, SPACING} from '../../../shared/constants';
import {RenderProfiler} from '../../../shared/components';
import {useResponsive} from '../../../shared/hooks';
import {CardGridSkeleton} from './CardGridSkeleton';
import {BROWSE_GUTTER} from './BrowseSidePanel';

interface BrowseCardGridProps {
  cards: LorcanaCard[];
  isLoading: boolean;
  onCardSelect: (card: LorcanaCard) => void;
  /** The printing a card's tile shows instead of its own art (see `CardTile`'s `printing`). */
  printingFor?: (card: LorcanaCard) => CardPrinting | undefined;
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
// Visual top breathing-room comes from the toolbar's bottom padding.
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
 * A tile's card page. A promo's tile is its card on that promo (#805), and only the card has a
 * page, so the tile links there: a click opens the promo in the modal, a new tab opens the card.
 */
const tilePath = (card: LorcanaCard) => cardPath({id: card.baseId ?? card.id, fullName: card.fullName});

export function BrowseCardGrid({cards, isLoading, onCardSelect, printingFor}: BrowseCardGridProps) {
  const {isMobile} = useResponsive();
  const paddingX = isMobile ? SPACING.lg : BROWSE_GUTTER;
  const minColWidth = isMobile ? LAYOUT.cardGridMinWidthMobile : LAYOUT.cardGridMinWidth;
  const ListContainer = createListContainer({paddingX, minColWidth});

  if (isLoading) {
    return <CardGridSkeleton />;
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
        components={{List: ListContainer}}
        itemContent={(index) => (
          <CardTile
            card={displayedCards[index]}
            href={tilePath(displayedCards[index])}
            isSelected={false}
            onSelect={onCardSelect}
            variant="minimal"
            priority={index < 6}
            useSmallImage
            printing={printingFor?.(displayedCards[index])}
          />
        )}
        style={{height: '100%'}}
      />
    </RenderProfiler>
  );
}
