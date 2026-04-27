import {forwardRef, useMemo, type CSSProperties, type ReactNode} from 'react';
import {VirtuosoGrid} from 'react-virtuoso';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile} from './CardTile';
import {COLORS, FONT_SIZES, LAYOUT, SPACING} from '../../../shared/constants';
import {RenderProfiler} from '../../../shared/components';
import {useResponsive} from '../../../shared/hooks';
import {CardGridSkeleton} from './CardGridSkeleton';

interface BrowseCardGridProps {
  cards: LorcanaCard[];
  isLoading: boolean;
  onCardSelect: (card: LorcanaCard) => void;
}

interface ListContainerProps {
  style?: CSSProperties;
  children?: ReactNode;
}

interface ListContainerStyle {
  padding: string;
}

// CSS Grid handles responsive column count natively via auto-fill + minmax.
// VirtuosoGrid mounts virtual items into this container; off-screen items stay unmounted.
const createListContainer = ({padding}: ListContainerStyle) =>
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
          gridTemplateColumns: `repeat(auto-fill, minmax(${LAYOUT.browseCardMinWidth}px, 1fr))`,
          gap: SPACING.md,
          padding,
        }}>
        {children}
      </div>
    );
  });

export function BrowseCardGrid({cards, isLoading, onCardSelect}: BrowseCardGridProps) {
  const {isMobile} = useResponsive();
  const padding = isMobile
    ? `${SPACING.md}px ${SPACING.lg}px 48px`
    : `${SPACING.lg}px 32px 32px`;
  const ListContainer = useMemo(() => createListContainer({padding}), [padding]);

  if (isLoading) {
    return <CardGridSkeleton />;
  }

  const displayedCards = cards.slice(0, LAYOUT.maxDisplayedCards);

  if (displayedCards.length === 0) {
    return (
      <div
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
            isSelected={false}
            onSelect={onCardSelect}
            variant="minimal"
            priority={index < 6}
            useSmallImage
          />
        )}
        style={{height: '100%'}}
      />
    </RenderProfiler>
  );
}
