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
 * and sign-in is configured, as the header's is. One predicate rather than
 * each side testing `isMobile` on its own, so a future slim phone header cannot leave two
 * controls both named "Sign in" on one page. The deck builder's `/decks` also negates it for
 * a fallback sign-in button that predates the account tab: that button goes when the deck
 * builder reaches master.
 *
 * Mobile chrome is MobileBottomNav + SearchBottomSheet, mounted by AppLayout.
 */
export function headerCarriesAuth({isMobile}: ViewportConfig): boolean {
  return !isMobile;
}
