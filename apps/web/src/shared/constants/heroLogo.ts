/**
 * `<img>` attributes for the homepage hero logo, shared by HeroSection and its Suspense
 * fallback HomePageSkeleton (which renders first on the client) so the two cannot drift.
 *
 * width/height are the SVG's intrinsic size (its root is `width="977" height="313"`). With
 * the definite CSS width both components give the logo, they reserve its box before the
 * file arrives, so the vertically centered <main> does not shift (#627). fetchPriority:
 * the logo is the homepage's LCP element. `alt` stays at each call site, where jsx-a11y
 * can see it.
 */
export const HERO_LOGO_IMG = {
  src: '/brand/logo-animated.svg',
  width: 977,
  height: 313,
  fetchPriority: 'high',
} as const;
