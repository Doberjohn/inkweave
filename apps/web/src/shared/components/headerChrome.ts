/**
 * Where the header's chrome applies. Lives outside `CompactHeader.tsx` so the rule
 * is importable without dragging a component along, and so that file keeps
 * exporting only components (react-refresh/only-export-components). Same split as
 * `ctaStyles.ts` beside `CtaButton.tsx`.
 */

/** Responsive viewport config. Derived from CompactHeader's `isMobile` prop. */
export interface ViewportConfig {
  isMobile: boolean;
}

/**
 * Whether the top header renders, and therefore whether it carries the auth control.
 *
 * Read from two sides. `CompactHeader` gates its whole render on it, and `/decks`
 * NEGATES it to decide whether to render the fallback sign in / sign out button
 * (owner ruling 2026-08-05: mobile auth lives on /decks, because mobile has no
 * header to put it in).
 *
 * One predicate rather than each side testing `isMobile` independently. The values
 * are identical today, so this buys nothing today: it buys that a future slim
 * mobile header cannot leave two controls both named "Sign in" on one page, which
 * nothing in the suite currently checks for. Change the rule here, both follow.
 *
 * Mobile chrome is MobileBottomNav + SearchBottomSheet, mounted by AppLayout.
 */
export function headerCarriesAuth({isMobile}: ViewportConfig): boolean {
  return !isMobile;
}
