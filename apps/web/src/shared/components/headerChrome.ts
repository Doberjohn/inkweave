/**
 * Where the header's chrome applies. Lives outside `CompactHeader.tsx` so the rule
 * is importable without dragging a component along, and so that file keeps
 * exporting only components (react-refresh/only-export-components). Same split as
 * inkweave-ui's `lib/ctaStyles.ts`, kept out of `components/CtaButton.tsx`.
 */

/** Responsive viewport config. Derived from CompactHeader's `isMobile` prop. */
export interface ViewportConfig {
  isMobile: boolean;
}

/**
 * Whether the top header renders, and therefore whether it carries the auth control.
 *
 * Where it doesn't, on a phone, the auth control is the bottom nav's account tab
 * (`MobileBottomNav`, which AppLayout mounts only on a phone), there while accounts are on
 * and sign-in is configured, as the header's is. The tab doesn't read this predicate, so a
 * future slim phone header that carried auth would have to hide the tab, or the page's chrome
 * would hold two sign-in controls. The deck builder's `/decks` reads it negated for a phone
 * sign-in button of its own, which the tab makes a second control (#1100).
 *
 * Mobile chrome is MobileBottomNav + SearchBottomSheet, mounted by AppLayout.
 */
export function headerCarriesAuth({isMobile}: ViewportConfig): boolean {
  return !isMobile;
}
