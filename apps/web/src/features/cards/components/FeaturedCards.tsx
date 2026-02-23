import {useMemo, memo} from 'react';
import type {LorcanaCard} from '../types';
import type {Ink} from 'lorcana-synergy-engine';
import {CardTile} from './CardTile';
import {COLORS, FONT_SIZES, SPACING} from '../../../shared/constants';

const FEATURED_COUNT = 6;

/** Ink display order for featured cards. */
const INK_ORDER: Ink[] = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];

interface FeaturedCardsProps {
  cards: LorcanaCard[];
  onCardSelect: (card: LorcanaCard) => void;
  isMobile?: boolean;
}

/** Pick one random card per ink in display order. */
function pickFeatured(cards: LorcanaCard[]): LorcanaCard[] {
  const withImages = cards.filter((c) => (c.imageUrl || c.thumbnailUrl) && c.type !== 'Location');
  const result: LorcanaCard[] = [];

  for (const ink of INK_ORDER) {
    const pool = withImages.filter((c) => c.ink === ink);
    if (pool.length > 0) {
      result.push(pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  return result;
}

/** Gradient divider line that fades from transparent to center color and back. */
function DividerLine() {
  return (
    <div
      style={{
        flex: 1,
        height: 1,
        background: `linear-gradient(90deg, transparent 0%, ${COLORS.featuredDivider} 50%, transparent 100%)`,
      }}
    />
  );
}

export const FeaturedCards = memo(function FeaturedCards({cards, onCardSelect, isMobile}: FeaturedCardsProps) {
  const featured = useMemo(() => {
    return pickFeatured(cards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length]);

  if (featured.length === 0) return null;

  return (
    <div
      data-testid="featured-cards"
      style={{
        width: isMobile ? '100%' : 1280,
        maxWidth: '100%',
        margin: '0 auto',
        padding: isMobile ? `0 ${SPACING.lg}px 48px` : undefined,
        position: 'relative',
        zIndex: 1,
        boxSizing: 'border-box',
      }}>
      {/* Section label with divider lines */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: `${SPACING.md}px`,
          marginBottom: 32,
        }}>
        <DividerLine />
        <span
          style={{
            fontSize: isMobile ? `${FONT_SIZES.md}px` : `${FONT_SIZES.lg}px`,
            letterSpacing: isMobile ? '2.4px' : '2.8px',
            color: COLORS.featuredLabel,
            fontWeight: 400,
            textTransform: 'uppercase',
            flexShrink: 0,
          }}>
          Featured Cards
        </span>
        <DividerLine />
      </div>

      {/* Responsive grid: 3-col mobile (2 rows), 6-col desktop */}
      <ul
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : `repeat(${FEATURED_COUNT}, 1fr)`,
          gap: isMobile ? `${SPACING.sm}px` : `${SPACING.xxl}px`,
          listStyle: 'none',
          padding: 0,
          margin: 0,
        }}>
        {featured.map((card) => (
          <li key={card.id}>
            <CardTile
              card={card}
              onSelect={onCardSelect}
              isSelected={false}
              variant="minimal"
              useThumbnail
              borderRadius={isMobile ? 10 : undefined}
              disablePreview={isMobile}
            />
          </li>
        ))}
      </ul>
    </div>
  );
});
