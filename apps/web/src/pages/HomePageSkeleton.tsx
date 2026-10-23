import Skeleton from 'react-loading-skeleton';
import {FeaturedCardsSkeleton} from '../features/cards/components/FeaturedCardsSkeleton';
import {Footer} from '../shared/components/Footer';
import {COLORS, HERO_LOGO_IMG, RADIUS, SPACING, Z_INDEX} from '../shared/constants';
import {HOME_PAGE_STYLE, homeMainStyle} from './homeFrame';

/**
 * Suspense fallback for the `/` route. Mirrors the final HomePage layout:
 * real logo + subtitle (instant static assets), skeletons for the interactive
 * search bar + CTA buttons, and the shared FeaturedCardsSkeleton row, in
 * HomePage's own frame with its Footer (`homeFrame.ts`, #914), so the content
 * is centered in the same space and nothing moves when the page arrives.
 *
 * Once HomePage mounts, FeaturedCards itself renders the same skeleton row
 * while the cards JSON is loading: that hand-off keeps the placeholder row
 * continuous across the Suspense boundary, so there's no flash of an empty
 * card section between page-chunk-load and data-fetch.
 *
 * `isMobile` defaults to false so the SSR/early-render path picks the desktop
 * layout. The router's fallback passes the viewport's (#914).
 */
interface HomePageSkeletonProps {
  isMobile?: boolean;
}

export function HomePageSkeleton({isMobile = false}: HomePageSkeletonProps) {
  return (
    <div style={HOME_PAGE_STYLE}>
      <main
        aria-busy="true"
        aria-label="Loading home"
        style={{...homeMainStyle(isMobile), background: COLORS.background}}>
        <HeroSkeleton isMobile={isMobile} />
        <FeaturedCardsSkeleton isMobile={isMobile} />
      </main>
      <Footer />
    </div>
  );
}

/**
 * Pre-computed style + sizing values, one constant per breakpoint. Picking the
 * shape with a single ternary in `pickHeroSkeletonStyles` keeps both the
 * picker and `HeroSkeleton` itself branchless (CC ≤ 2) — CodeScene scans
 * static literals as plain data, not as conditional branches.
 */
interface HeroSkeletonStyles {
  section: React.CSSProperties;
  heading: React.CSSProperties;
  logo: React.CSSProperties;
  subtitleContainer: React.CSSProperties;
  subtitleText: React.CSSProperties;
  searchRow: React.CSSProperties;
  searchHeight: number;
  ctaRow: React.CSSProperties;
  ctaHeight: number;
  ctaWidths: [number | string, number | string, number | string];
}

// The hero's spacing past the scale's top step (SPACING.xxxl, 32).
const PHONE_HERO_PADDING_TOP = 48;
const PHONE_HERO_PADDING_BOTTOM = 40;
// HeroSection's phone CTA gap, between SPACING.sm and SPACING.md. The skeleton keeps it until
// HeroSection's own spacing converges (#548), so the buttons don't move when the page loads.
const PHONE_HERO_CTA_GAP = 10;

const DESKTOP_HERO_STYLES: HeroSkeletonStyles = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    // None, as HeroSection: the featured row's margin is the space below it (#914).
    padding: 0,
    position: 'relative',
    zIndex: 2,
    width: undefined,
    boxSizing: 'border-box',
  },
  heading: {margin: 0, marginBottom: SPACING.xl, lineHeight: 0},
  logo: {display: 'block', width: 600, maxWidth: '100%', height: 'auto', userSelect: 'none'},
  subtitleContainer: {textAlign: 'center', marginBottom: SPACING.xxxl, padding: undefined},
  subtitleText: {
    fontSize: '20px',
    color: COLORS.heroSubtitle,
    margin: 0,
    lineHeight: '28px',
  },
  searchRow: {
    display: 'flex',
    width: '100%',
    maxWidth: 768,
    zIndex: Z_INDEX.autocomplete,
  },
  searchHeight: 56,
  ctaRow: {display: 'flex', flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl, width: undefined},
  ctaHeight: 44,
  // HeroSection's three buttons at 1440 px, measured (#914).
  ctaWidths: [165, 179, 157],
};

const MOBILE_HERO_STYLES: HeroSkeletonStyles = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: `${PHONE_HERO_PADDING_TOP}px ${SPACING.lg}px ${PHONE_HERO_PADDING_BOTTOM}px`,
    position: 'relative',
    zIndex: 2,
    width: '100%',
    boxSizing: 'border-box',
  },
  heading: {margin: 0, marginBottom: SPACING.lg, lineHeight: 0},
  logo: {display: 'block', width: 380, maxWidth: '100%', height: 'auto', userSelect: 'none'},
  subtitleContainer: {textAlign: 'center', marginBottom: SPACING.xxl, padding: `0 ${SPACING.sm}px`},
  subtitleText: {
    fontSize: '16px',
    color: COLORS.heroSubtitle,
    margin: 0,
    lineHeight: '22px',
  },
  searchRow: {
    display: 'flex',
    width: '100%',
    maxWidth: undefined,
    zIndex: Z_INDEX.autocomplete,
  },
  searchHeight: 48,
  ctaRow: {display: 'flex', flexDirection: 'column', gap: PHONE_HERO_CTA_GAP, marginTop: SPACING.lg, width: '100%'},
  ctaHeight: 48,
  ctaWidths: ['100%', '100%', '100%'],
};

function pickHeroSkeletonStyles(isMobile: boolean): HeroSkeletonStyles {
  return isMobile ? MOBILE_HERO_STYLES : DESKTOP_HERO_STYLES;
}

interface HeroSkeletonProps {
  isMobile: boolean;
}

/**
 * A skeleton as a block exactly its height, like the field and buttons it stands for: left
 * inline, each sits in a line box 4 px taller (#914).
 */
const SKELETON_BLOCK = {display: 'block'} as const;

function HeroSkeleton({isMobile}: HeroSkeletonProps) {
  const s = pickHeroSkeletonStyles(isMobile);
  return (
    <section aria-label="Hero" style={s.section}>
      <h1 style={s.heading}>
        {/* Same attributes and definite width as HeroSection's logo: this fallback renders
            first on the client, and must reserve the same box (#627). */}
        <img {...HERO_LOGO_IMG} alt="Inkweave" style={s.logo} />
      </h1>
      <div style={s.subtitleContainer}>
        <p style={s.subtitleText}>
          Select any Lorcana card and instantly discover powerful synergies.
        </p>
      </div>
      <div style={s.searchRow}>
        <Skeleton
          height={s.searchHeight}
          borderRadius={RADIUS.lg}
          containerClassName="inkweave-home-skel-flex"
          inline
          style={SKELETON_BLOCK}
        />
      </div>
      <div style={s.ctaRow}>
        <Skeleton width={s.ctaWidths[0]} height={s.ctaHeight} borderRadius={RADIUS.lg} inline style={SKELETON_BLOCK} />
        <Skeleton width={s.ctaWidths[1]} height={s.ctaHeight} borderRadius={RADIUS.lg} inline style={SKELETON_BLOCK} />
        <Skeleton width={s.ctaWidths[2]} height={s.ctaHeight} borderRadius={RADIUS.lg} inline style={SKELETON_BLOCK} />
      </div>
    </section>
  );
}
