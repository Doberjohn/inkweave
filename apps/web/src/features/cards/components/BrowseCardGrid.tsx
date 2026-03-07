import {useCallback} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile} from './CardTile';
import {COLORS, FONT_SIZES, LAYOUT, SPACING} from '../../../shared/constants';
import {LoadingSpinner} from '../../../shared/components';

interface BrowseCardGridProps {
  cards: LorcanaCard[];
  isLoading: boolean;
  onCardSelect: (card: LorcanaCard) => void;
}

export function BrowseCardGrid({cards, isLoading, onCardSelect}: BrowseCardGridProps) {
  const handleSelect = useCallback((card: LorcanaCard) => onCardSelect(card), [onCardSelect]);

  if (isLoading) {
    return (
      <div style={{display: 'flex', justifyContent: 'center', padding: 64}}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div style={{padding: `${SPACING.lg}px 32px 32px`}}>
      {cards.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 64,
            color: COLORS.textMuted,
            fontSize: `${FONT_SIZES.xl}px`,
          }}>
          No cards match your filters.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${LAYOUT.browseCardMinWidth}px, 1fr))`,
            gap: SPACING.md,
          }}>
          {cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              isSelected={false}
              onSelect={handleSelect}
              variant="minimal"
              useThumbnail
            />
          ))}
        </div>
      )}
    </div>
  );
}
