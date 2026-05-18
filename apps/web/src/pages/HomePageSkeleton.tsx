import Skeleton, {SkeletonTheme} from 'react-loading-skeleton';
import {FeaturedCardsSkeleton} from '../features/cards/components/FeaturedCardsSkeleton';
import {COLORS, RADIUS, SPACING, Z_INDEX} from '../shared/constants';

/**
 * Suspense fallback for the `/` route. Mirrors the final HomePage layout:
 * real logo + subtitle (instant static assets), skeletons for the interactive
 * search bar + CTA buttons, and the shared FeaturedCardsSkeleton row.
 *
 * Once HomePage mounts, FeaturedCards itself renders the same skeleton row
 * while the cards JSON is loading — that hand-off keeps the shimmer
 * continuous across the Suspense boundary, so there's no flash of an empty
 * card section between page-chunk-load and data-fetch.
 *
 * `isMobile` defaults to false so the SSR/early-render path picks the desktop
 * layout. On mount, the responsive hook in HomePage takes over instantly.
 */
export function HomePageSkeleton({isMobile = false}: {isMobile?: boolean} = {}) {
  const ctaHeight = isMobile ? 48 : 44;
  const searchHeight = isMobile ? 48 : 56;

  return (
    <main
      aria-busy="true"
      aria-label="Loading home"
      style={{
        minHeight: '100vh',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: isMobile ? undefined : 'center',
        background: COLORS.background,
      }}>
      <SkeletonTheme baseColor={COLORS.surfaceAlt} highlightColor={COLORS.surfaceHover}>
        <HeroSkeleton isMobile={isMobile} searchHeight={searchHeight} ctaHeight={ctaHeight} />
        <FeaturedCardsSkeleton isMobile={isMobile} />
      </SkeletonTheme>
    </main>
  );
}

interface HeroSkeletonProps {
  isMobile: boolean;
  searchHeight: number;
  ctaHeight: number;
}

function HeroSkeleton({isMobile, searchHeight, ctaHeight}: HeroSkeletonProps) {
  return (
    <section
      aria-label="Hero"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: isMobile ? `48px ${SPACING.lg}px 40px` : '0 0 80px',
        position: 'relative',
        zIndex: 2,
        width: isMobile ? '100%' : undefined,
        boxSizing: 'border-box',
      }}>
      <h1 style={{margin: 0, marginBottom: isMobile ? 16 : 20, lineHeight: 0}}>
        <img
          src="/brand/logo-animated.svg"
          alt="Inkweave"
          style={{
            display: 'block',
            width: '100%',
            maxWidth: isMobile ? 380 : 600,
            height: 'auto',
            userSelect: 'none',
          }}
        />
      </h1>
      <div style={{textAlign: 'center', marginBottom: isMobile ? 24 : 32, padding: isMobile ? '0 8px' : undefined}}>
        <p
          style={{
            fontSize: `${isMobile ? 16 : 20}px`,
            color: COLORS.heroSubtitle,
            margin: 0,
            lineHeight: isMobile ? '22px' : '28px',
          }}>
          Select any Lorcana card and instantly discover powerful synergies.
        </p>
      </div>
      <div style={{display: 'flex', width: '100%', maxWidth: isMobile ? undefined : 768, zIndex: Z_INDEX.autocomplete}}>
        <Skeleton
          height={searchHeight}
          borderRadius={RADIUS.lg}
          containerClassName="inkweave-home-skel-flex"
        />
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 10 : 12,
          marginTop: isMobile ? 16 : 20,
          width: isMobile ? '100%' : undefined,
        }}>
        <Skeleton width={isMobile ? '100%' : 168} height={ctaHeight} borderRadius={RADIUS.lg} />
        <Skeleton width={isMobile ? '100%' : 172} height={ctaHeight} borderRadius={RADIUS.lg} />
        <Skeleton width={isMobile ? '100%' : 152} height={ctaHeight} borderRadius={RADIUS.lg} />
      </div>
    </section>
  );
}
