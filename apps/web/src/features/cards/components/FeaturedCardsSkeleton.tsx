import {COLORS, FONT_SIZES, RADIUS, SPACING} from '../../../shared/constants';

/**
 * Skeleton row for the landing page's "Popular Synergy Starters" section.
 *
 * Used both by:
 *   - `HomePageSkeleton` (Suspense fallback while the HomePage JS chunk loads)
 *   - `FeaturedCards` (while the cards JSON is still in flight after HomePage mounts)
 *
 * Bridging both phases with the same component eliminates the visible gap
 * where FeaturedCards used to render `null` between Suspense resolving and
 * the cards data arriving — the shimmer is continuous.
 *
 * Renders the section's full chrome: divider lines + label + 6 aspect-ratio
 * 0.72 shimmer tiles in the same 6-col desktop / 3-col mobile grid as the
 * loaded FeaturedCards layout.
 */
interface FeaturedCardsSkeletonProps {
  isMobile?: boolean;
}

export function FeaturedCardsSkeleton({isMobile = false}: FeaturedCardsSkeletonProps = {}) {
  const tileRadius = isMobile ? 10 : RADIUS.xl;
  return (
    <section
      aria-label="Popular Synergy Starters loading"
      aria-busy="true"
      style={{
        width: isMobile ? '100%' : 1280,
        maxWidth: '100%',
        margin: '0 auto',
        padding: isMobile ? `0 ${SPACING.lg}px 48px` : '0 32px',
        position: 'relative',
        zIndex: 1,
        boxSizing: 'border-box',
      }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: `${SPACING.md}px`,
          marginBottom: isMobile ? 20 : 32,
        }}>
        <DividerLine />
        <div
          style={{
            flexShrink: 0,
            textAlign: 'center',
            fontSize: `${isMobile ? FONT_SIZES.xs : FONT_SIZES.base}px`,
            letterSpacing: isMobile ? '2px' : '2.8px',
            color: COLORS.featuredLabel,
            fontWeight: 400,
            textTransform: 'uppercase',
          }}>
          Popular Synergy Starters
        </div>
        <DividerLine />
      </div>
      <ul
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)',
          gap: isMobile ? `${SPACING.md}px` : `${SPACING.xxl}px`,
          listStyle: 'none',
          padding: 0,
          margin: 0,
        }}>
        {Array.from({length: 6}).map((_, i) => (
          <li key={i} style={{aspectRatio: '0.72'}}>
            <div
              className="inkweave-shimmer-tile"
              style={{
                borderRadius: tileRadius,
                background: `linear-gradient(110deg, ${COLORS.surfaceAlt} 0%, ${COLORS.surfaceHover} 50%, ${COLORS.surfaceAlt} 100%)`,
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

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
