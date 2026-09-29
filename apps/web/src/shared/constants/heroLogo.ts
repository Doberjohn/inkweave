/**
 * `<img>` attributes for the homepage hero logo, shared by HeroSection and its Suspense
 * fallback HomePageSkeleton (which renders first on the client) so the two cannot drift.
 *
 * width/height are the SVG's intrinsic size (its root is `width="977" height="313"`). With
 * the definite CSS width both components give the logo, they reserve its box before the
 * file arrives, so the vertically centered <main> does not shift (#627). fetchPriority:
 * the logo is the homepage's LCP element. `alt` stays at each call site, where jsx-a11y
 * can see it.
 *
 * `src` is the static logo: its animations are paused on their first frame, so it costs no
 * per-frame work while the page loads (#639). HeroSection swaps to HERO_LOGO_ANIMATED_SRC
 * after `load` via useHeroLogoSrc; the skeleton never animates.
 */
export const HERO_LOGO_IMG = {
  src: '/brand/logo-static.svg',
  width: 977,
  height: 313,
  fetchPriority: 'high',
} as const;

/** Same box and first frame as HERO_LOGO_IMG.src, with its animations running. */
export const HERO_LOGO_ANIMATED_SRC = '/brand/logo-animated.svg';
