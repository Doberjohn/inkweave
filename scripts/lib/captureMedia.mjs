/**
 * The screens each prerendered capture is for (#915), as media queries: the phone capture below
 * the app's 768 px breakpoint (useResponsive), the desktop capture from there up.
 *
 * `prerender.mjs` limits each capture's image preloads to its own screens with these, and
 * `check-rendered-html.mjs` reads them back. `apps/web/index.html` writes the phone one out
 * twice, in its style and its inline script, which run before any module could load: its test
 * holds them to this one.
 */
export const CAPTURE_MEDIA = {phone: '(max-width: 767.98px)', desktop: '(min-width: 768px)'};
