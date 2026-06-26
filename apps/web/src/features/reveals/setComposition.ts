/**
 * Set-composition constants for the reveals tracker.
 *
 * A Lorcana Core set is 204 cards. The tracker stylizes this as six per-ink
 * boards of 34 slots each (6 × 34 = 204). These are fixed denominators: the
 * board renders 34 slots per ink and fills them as cards reveal, so the page
 * works correctly even mid-season with only part of the set revealed.
 *
 * If a completed set ever diverges from this canonical split, revisit these
 * (and the per-rarity totals in rarity.ts) rather than deriving from the live,
 * incomplete card data.
 */
export const PER_INK = 34;
export const SET_TOTAL = 204; // PER_INK * 6
