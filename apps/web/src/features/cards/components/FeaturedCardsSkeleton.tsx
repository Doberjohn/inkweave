import {COLORS, FONT_SIZES, RADIUS, SPACING} from '../../../shared/constants';
import {InkCardPlaceholder} from '../../../shared/components/InkCardPlaceholder';

/**
 * The phone layout's bottom padding, past the spacing scale's top step (SPACING.xxxl, 32).
 * FeaturedCards pads its loaded row the same, so the cards land where the skeleton stood.
 */
export const FEATURED_PHONE_PADDING_BOTTOM = 48;

/**
 * The section's top and bottom margin, past the spacing scale's top step (SPACING.xxxl, 32).
 * The loaded row and the skeleton share it, so the heading stays put when the cards land (#914).
 */
export const FEATURED_MARGIN = 50;

/**
 * Skeleton row for the landing page's "Popular Synergy Starters" section.
 *
 * Used both by:
 *   - `HomePageSkeleton` (Suspense fallback while the HomePage JS chunk loads)
 *   - `FeaturedCards` (while the cards JSON is still in flight after HomePage mounts)
 *
 * Bridging both phases with the same component eliminates the visible gap
 * where FeaturedCards used to render `null` between Suspense resolving and
 * the cards data arriving: the placeholder row is continuous.
 *
 * Renders the section's full chrome: divider lines + label + 6 aspect-ratio
 * 0.72 placeholder tiles in the same 6-col desktop / 3-col mobile grid as the
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
        margin: `${FEATURED_MARGIN}px auto`,
        padding: isMobile
          ? `0 ${SPACING.lg}px ${FEATURED_PHONE_PADDING_BOTTOM}px`
          : `0 ${SPACING.xxxl}px`,
        position: 'relative',
        zIndex: 1,
        boxSizing: 'border-box',
      }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: `${SPACING.md}px`,
          marginBottom: isMobile ? SPACING.xl : SPACING.xxxl,
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
          <li
            key={i}
            style={{
              aspectRatio: '0.72',
              position: 'relative',
              borderRadius: tileRadius,
              overflow: 'hidden',
            }}>
            <InkCardPlaceholder />
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
