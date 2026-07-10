import type {LorcanaCard} from '../types';
import {CardTile} from './CardTile';
import {FeaturedCardsSkeleton} from './FeaturedCardsSkeleton';
import {COLORS, FONT_SIZES, SPACING} from '../../../shared/constants';
import {RenderProfiler} from '../../../shared/components';

/**
 * Default featured card IDs — a Set 13 showcase spanning all six inks, chosen for
 * visual appeal. Used as the fallback when `VITE_FEATURED_CARD_IDS` is unset or
 * empty. Recommend keeping exactly 6 IDs so the desktop 6-col / mobile 3×2 grid
 * stays symmetrical.
 */
export const DEFAULT_FEATURED_IDS = [
  '2999', // Amber-Emerald: Woody & Buzz Lightyear - Best Buddies
  '3022', // Amethyst:      Mrs. Incredible - Created by the Vine
  '3053', // Emerald:       Russell - Junior Wilderness Explorer
  '3096', // Ruby:          Meilin Lee - Popular Red Panda
  '3129', // Sapphire:      Maid Marian - Created by the Vine
  '3168', // Steel:         The Vine - Towering Stalk
];

/**
 * Resolve the featured card IDs from the build-time env var, with a graceful
 * fallback to the in-code defaults. Vite inlines env vars at build time, so
 * changing this on Vercel requires a redeploy — that's the intended workflow.
 */
function resolveFeaturedIds(raw: string | undefined): string[] {
  if (!raw) return DEFAULT_FEATURED_IDS;
  const parsed = raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_FEATURED_IDS;
}

const FEATURED_IDS = resolveFeaturedIds(import.meta.env.VITE_FEATURED_CARD_IDS);
const FEATURED_COUNT = FEATURED_IDS.length;

interface FeaturedCardsProps {
  cards: LorcanaCard[];
  onCardSelect: (card: LorcanaCard) => void;
  isMobile?: boolean;
  /**
   * True while the cards JSON is still being fetched. Renders
   * `<FeaturedCardsSkeleton>` so the shimmer is continuous from the Suspense
   * fallback through to the real card art (no flash of empty section).
   */
  isLoading?: boolean;
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
  const featured = pickFeatured(cards);

  const styles = getStyles(!!isMobile);

  // While the cards JSON is in flight, render the same skeleton row the
  // Suspense fallback uses so the shimmer is visually continuous from page
  // load through to real card art. Only return null if loading has completed
  // and we still have no matches (curated IDs unknown, or empty data).
  if (isLoading) return <FeaturedCardsSkeleton isMobile={!!isMobile} />;
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
