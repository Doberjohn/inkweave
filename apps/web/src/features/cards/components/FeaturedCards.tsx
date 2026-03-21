import type {LorcanaCard} from '../types';
import {CardTile} from './CardTile';
import {COLORS, FONT_SIZES, SPACING} from '../../../shared/constants';
import {RenderProfiler} from '../../../shared/components';

/** Curated card IDs — one per ink, chosen for visual appeal and synergy variety. */
const FEATURED_IDS = [
  '1219', // Amber    — Simba - Pride Protector
  '1492', // Amethyst — Yzma - Transformed Kitten
  '2010', // Emerald  — Goofy - Set for Adventure
  '1319', // Ruby     — Minnie Mouse - Pirate Lookout
  '1100', // Sapphire — The Queen - Fairest of All
  '2128', // Steel    — John Silver - Greedy Treasure Seeker
];

const FEATURED_COUNT = FEATURED_IDS.length;

interface FeaturedCardsProps {
  cards: LorcanaCard[];
  onCardSelect: (card: LorcanaCard) => void;
  isMobile?: boolean;
}

/** Look up curated featured cards by ID, preserving display order. */
function pickFeatured(cards: LorcanaCard[]): LorcanaCard[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return FEATURED_IDS.map((id) => byId.get(id)).filter(
    (c): c is LorcanaCard => c != null && !!c.imageUrl,
  );
}

function getStyles(isMobile: boolean) {
  return {
    container: {
      width: isMobile ? '100%' : 1280,
      maxWidth: '100%',
      margin: '0 auto',
      padding: isMobile ? `0 ${SPACING.lg}px 48px` : '0 32px',
      position: 'relative',
      zIndex: 1,
      boxSizing: 'border-box',
    } as React.CSSProperties,
    label: {
      fontSize: `${isMobile ? FONT_SIZES.xs : FONT_SIZES.base}px`,
      letterSpacing: isMobile ? '2px' : '2.8px',
      color: COLORS.featuredLabel,
      fontWeight: 400,
      textTransform: 'uppercase',
      flexShrink: 0,
    } as React.CSSProperties,
    grid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : `repeat(${FEATURED_COUNT}, 1fr)`,
      gap: isMobile ? `${SPACING.md}px` : `${SPACING.xxl}px`,
      listStyle: 'none',
      padding: 0,
      margin: 0,
    } as React.CSSProperties,
  };
}

function getSectionLabelRow(isMobile: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: `${SPACING.md}px`,
    marginBottom: isMobile ? 20 : 32,
  };
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

export function FeaturedCards({
  cards,
  onCardSelect,
  isMobile,
}: FeaturedCardsProps) {
  const featured = pickFeatured(cards);

  const styles = getStyles(!!isMobile);

  if (featured.length === 0) return null;

  return (
    <RenderProfiler id="FeaturedCards">
    <section
      data-testid="featured-cards"
      aria-label="Popular Synergy Starters"
      style={styles.container}>
      {/* Section label with divider lines */}
      <div style={getSectionLabelRow(!!isMobile)}>
        <DividerLine />
        <div style={{flexShrink: 0, textAlign: 'center'}}>
          <div style={styles.label}>Popular Synergy Starters</div>
          <div
            style={{
              fontSize: `${FONT_SIZES.xs}px`,
              color: COLORS.featuredLabel,
              marginTop: 4,
            }}>
            Cards with the most powerful connections
          </div>
        </div>
        <DividerLine />
      </div>

      {/* Responsive grid: 3-col mobile (2 rows), 6-col desktop */}
      <ul style={styles.grid}>
        {featured.map((card, i) => (
          <li key={card.id}>
            <CardTile
              card={card}
              onSelect={onCardSelect}
              isSelected={false}
              variant="minimal"
              borderRadius={isMobile ? 10 : undefined}
              disablePreview={isMobile}
              priority={i < (isMobile ? 3 : 6)}
              useSmallImage
            />
          </li>
        ))}
      </ul>
    </section>
    </RenderProfiler>
  );
}
