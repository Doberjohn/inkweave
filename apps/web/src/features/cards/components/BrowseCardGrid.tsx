import {useMemo, useCallback} from 'react';
import type {LorcanaCard} from 'lorcana-synergy-engine';
import {CardTile} from './CardTile';
import {COLORS, FONT_SIZES, LAYOUT, SPACING} from '../../../shared/constants';
import {LoadingSpinner} from '../../../shared/components';

interface BrowseCardGridProps {
  cards: LorcanaCard[];
  isLoading: boolean;
  onCardSelect: (card: LorcanaCard) => void;
  /** Total number of unfiltered cards (for the result count) */
  totalCards?: number;
}

export function BrowseCardGrid({cards, isLoading, onCardSelect, totalCards}: BrowseCardGridProps) {
  const displayedCards = useMemo(() => cards.slice(0, LAYOUT.maxDisplayedCards), [cards]);

  const handleSelect = useCallback((card: LorcanaCard) => onCardSelect(card), [onCardSelect]);

  if (isLoading) {
    return (
      <div style={{display: 'flex', justifyContent: 'center', padding: 64}}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: `${LAYOUT.browseMaxWidth}px`,
        margin: '0 auto',
        padding: `${SPACING.xl}px ${SPACING.xxl}px`,
      }}>
      {/* Result count */}
      <div
        style={{
          fontSize: `${FONT_SIZES.sm}px`,
          color: COLORS.textMuted,
          marginBottom: SPACING.lg,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
        }}>
        {cards.length === totalCards
          ? `${cards.length} cards`
          : `${cards.length} of ${totalCards ?? cards.length} cards`}
        {cards.length > LAYOUT.maxDisplayedCards && (
          <span style={{color: COLORS.textDim}}> · showing first {LAYOUT.maxDisplayedCards}</span>
        )}
      </div>

      {/* Card grid */}
      {displayedCards.length === 0 ? (
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
          {displayedCards.map((card) => (
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
