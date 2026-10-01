import type {LorcanaCard} from '../types';
import {cardPath} from 'inkweave-synergy-engine/card';
import {CardTile} from './CardTile';
import {FeaturedCardsSkeleton} from './FeaturedCardsSkeleton';
import {FEATURED_IDS, pickFeatured, useFeaturedCardsFile} from '../featured';
import {COLORS, FONT_SIZES, SPACING} from '../../../shared/constants';
import {RenderProfiler} from '../../../shared/components';

const FEATURED_COUNT = FEATURED_IDS.length;

interface FeaturedCardsProps {
  cards: LorcanaCard[];
  onCardSelect: (card: LorcanaCard) => void;
  isMobile?: boolean;
  /**
   * True while the full card list is still loading. The tiles then come from the small
   * featured-cards file (#641); until that arrives, `<FeaturedCardsSkeleton>` keeps the
   * placeholder row continuous from the Suspense fallback through to the real card art.
   */
  isLoading?: boolean;
}

function getStyles(isMobile: boolean) {
  return {
    container: {
      width: isMobile ? '100%' : 1280,
      maxWidth: '100%',
      margin: '50px auto',
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
  isLoading,
}: FeaturedCardsProps) {
  const fromList = pickFeatured(cards);
  // The full list is the source of truth once it has the cards. Until then, the small file
  // renders the tiles, so they don't wait on the whole database (#641).
  const fromFile = useFeaturedCardsFile(fromList.length === 0 && !!isLoading);
  const featured = fromList.length > 0 ? fromList : (fromFile ?? []);

  const styles = getStyles(!!isMobile);

  // Nothing to show yet: keep the same skeleton row the Suspense fallback uses, so the
  // placeholder is continuous from page load to real card art. Only return null once the
  // list has loaded and still has no matches (curated IDs unknown, or empty data).
  if (featured.length === 0) {
    return isLoading ? <FeaturedCardsSkeleton isMobile={!!isMobile} /> : null;
  }

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
        </div>
        <DividerLine />
      </div>

      {/* Responsive grid: 3-col mobile (2 rows), 6-col desktop */}
      <ul style={styles.grid}>
        {featured.map((card, i) => (
          <li key={card.id}>
            <CardTile
              card={card}
              href={cardPath(card)}
              onSelect={onCardSelect}
              isSelected={false}
              variant="minimal"
              borderRadius={isMobile ? 10 : undefined}
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
