/**
 * Lowest set code still legal in the Core format. Cards from sets below this are
 * filtered out of the pool at BOTH consumption points — the synergy precompute
 * (`scripts/precompute-synergies.mjs`) and the web loader (`loader.ts`) — so the
 * engine only ever computes over, and the app only ever shows, Core-legal cards.
 *
 * This codifies the "Core = recent sets" boundary that was previously enforced
 * only by hand-curating which sets appear in allCards.json (sets 1-4 were simply
 * omitted). Bump it when a Lorcana rotation drops a set out of Core — e.g. sets
 * 5-8 rotating out raised this from 5 to 9. The filter is belt-and-suspenders:
 * even if a full LorcanaJSON re-pull re-adds an out-of-rotation set, it is dropped
 * at load, so the boundary survives data refreshes.
 */
export const MIN_CORE_SET = 9;

/**
 * True when a card/set's numeric set code is at or above the Core rotation floor.
 * A missing or non-numeric set code (e.g. an undefined setCode or a promo like "Q1")
 * is treated as NOT Core-legal.
 */
export function isCoreSet(setCode: string | number | undefined): boolean {
  const n = Number(setCode);
  return Number.isFinite(n) && n >= MIN_CORE_SET;
}
