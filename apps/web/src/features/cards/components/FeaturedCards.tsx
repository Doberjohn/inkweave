import {useMemo} from 'react';
import type {LorcanaCard} from '../types';
import {CardTile} from './CardTile';
import {COLORS, FONT_SIZES, SPACING} from '../../../shared/constants';

const FEATURED_DESKTOP = 6;
const FEATURED_MOBILE = 9;

interface FeaturedCardsProps {
  cards: LorcanaCard[];
  onCardSelect: (card: LorcanaCard) => void;
  isMobile?: boolean;
}

/** Fisher-Yates shuffle — random selection on each page load. */
function randomShuffle(cards: LorcanaCard[]): LorcanaCard[] {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function FeaturedCards({cards, onCardSelect, isMobile}: FeaturedCardsProps) {
  const count = isMobile ? FEATURED_MOBILE : FEATURED_DESKTOP;

  const featured = useMemo(() => {
    const withImages = cards.filter((c) => c.imageUrl || c.thumbnailUrl);
    return randomShuffle(withImages).slice(0, count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length, count]);

  if (featured.length === 0) return null;

  return (
    <div
      data-testid="featured-cards"
      style={{
        width: isMobile ? '100%' : '70%',
        margin: '0 auto',
        padding: isMobile ? `0 ${SPACING.md}px` : undefined,
        position: 'relative',
        zIndex: 1,
        boxSizing: 'border-box',
      }}>
      {/* Section label */}
      <div
        style={{
          fontSize: `${FONT_SIZES.sm}px`,
          letterSpacing: '0.15em',
          color: COLORS.text,
          fontWeight: 700,
          marginBottom: SPACING.sm,
          textAlign: 'left',
        }}>
        FEATURED CARDS
      </div>

      {/* Responsive grid: 3-col mobile, 6-col desktop */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)',
          gap: isMobile ? '6px' : '8px',
        }}>
        {featured.map((card) => (
          <CardTile
            key={card.id}
            card={card}
            onClick={() => onCardSelect(card)}
            isSelected={false}
            variant="minimal"
            useThumbnail={isMobile}
          />
        ))}
      </div>
    </div>
  );
}
