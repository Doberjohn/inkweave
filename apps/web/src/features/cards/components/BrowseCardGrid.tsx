import {useMemo, useRef} from 'react';
import {useVirtualizer} from '@tanstack/react-virtual';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile} from './CardTile';
import {COLORS, FONT_SIZES, LAYOUT, SPACING} from '../../../shared/constants';
import {LoadingSpinner} from '../../../shared/components';
import {useContainerWidth} from '../../../shared/hooks/useContainerWidth';

interface BrowseCardGridProps {
  cards: LorcanaCard[];
  isLoading: boolean;
  onCardSelect: (card: LorcanaCard) => void;
}

const GAP = SPACING.md;
const MIN_COL_WIDTH = LAYOUT.browseCardMinWidth;
// Card aspect ratio: width / height = 0.72, so height = width / 0.72
const CARD_ASPECT = 0.72;

export function BrowseCardGrid({cards, isLoading, onCardSelect}: BrowseCardGridProps) {
  const displayedCards = useMemo(() => cards.slice(0, LAYOUT.maxDisplayedCards), [cards]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(scrollRef);

  // Compute columns and row height from container width
  const columns = Math.max(1, Math.floor((containerWidth + GAP) / (MIN_COL_WIDTH + GAP)));
  const colWidth = (containerWidth - GAP * (columns - 1)) / columns;
  const rowHeight = colWidth / CARD_ASPECT + GAP;

  // Chunk cards into rows
  const rows = useMemo(() => {
    const result: LorcanaCard[][] = [];
    for (let i = 0; i < displayedCards.length; i += columns) {
      result.push(displayedCards.slice(i, i + columns));
    }
    return result;
  }, [displayedCards, columns]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
  });

  const displayWidth = `${Math.round(colWidth)}px`;

  if (isLoading) {
    return (
      <div style={{display: 'flex', justifyContent: 'center', padding: 64}}>
        <LoadingSpinner />
      </div>
    );
  }

  // Wait for container measurement before rendering virtual rows
  if (containerWidth === 0) {
    return (
      <div ref={scrollRef} style={{flex: 1, minHeight: 0, padding: `${SPACING.lg}px 32px 32px`}} />
    );
  }

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
    <div
      ref={scrollRef}
      style={{
        padding: `${SPACING.lg}px 32px 32px`,
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
      }}>
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: GAP,
              alignItems: 'start',
            }}>
            {rows[virtualRow.index].map((card) => (
              <CardTile
                key={card.id}
                card={card}
                isSelected={false}
                onSelect={onCardSelect}
                variant="minimal"
                useThumbnail
                displayWidth={displayWidth}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
