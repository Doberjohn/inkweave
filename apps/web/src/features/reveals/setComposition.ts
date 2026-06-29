import type {Ink} from 'inkweave-synergy-engine';

/**
 * Set-composition constants for the reveals tracker.
 *
 * Set 13 (Attack of the Vine) splits its 207 cards unevenly across the six inks,
 * so each ink board carries its own denominator rather than a shared one:
 *
 *   Amber 37 · Amethyst 36 · Emerald 35 · Ruby 34 · Sapphire 33 · Steel 32  (= 207)
 *
 * These are fixed denominators: a board renders its slots and fills them as cards
 * reveal, so the page works mid-season with only part of the set revealed.
 *
 * If a future set diverges from this split, revisit these (and the per-rarity
 * totals in rarity.ts) rather than deriving from the live, incomplete card data.
 */
export const PER_INK: Record<Ink, number> = {
  Amber: 37,
  Amethyst: 36,
  Emerald: 35,
  Ruby: 34,
  Sapphire: 33,
  Steel: 32,
};

/** Total cards in the set — the sum of the per-ink boards (207). */
export const SET_TOTAL = Object.values(PER_INK).reduce((sum, n) => sum + n, 0);
