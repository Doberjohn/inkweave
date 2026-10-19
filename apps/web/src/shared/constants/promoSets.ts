/** One of the editions a promo set gathers: the code printed on its cards ("CC1" in 1/CC1) and its name. */
export interface PromoEdition {
  code: string;
  name: string;
}

/** A promo set: the code printed on its cards ("P1" in 25/P1) and its name. */
export interface PromoSet {
  /** The code on its cards; for a set that gathers editions, the letters theirs share (owner, 2026-10-19: "CC"). */
  code: string;
  name: string;
  /**
   * The editions a promo set gathers, oldest first, each printed with its own code (owner,
   * 2026-10-18: Curator's Collection's Heroines and Beauty and the Beast, with more to come).
   * Its binder holds each edition's pockets in turn, numbered as printed.
   */
  editions?: readonly PromoEdition[];
  /**
   * Numbers below the set's highest that were never released where the collection is kept:
   * the binder holds their pockets as not released, not as waiting for a listing (owner,
   * 2026-10-18: Promo Set 2's 37 to 41 came out in China only, if at all; 42 and 43 did, in
   * Chinese, 42 in very small numbers).
   */
  unreleased?: readonly number[];
  /**
   * Numbers below the set's highest still to come out: the binder holds their pockets as not
   * released yet (owner, 2026-10-18: Promo Set 4's 2 to 6, and Challenge Set 2's 19 and Disney
   * Promo's 9 to 18, which are not revealed yet).
   */
  upcoming?: readonly number[];
}

/**
 * The promo sets, oldest first (owner, 2026-10-17, release order from Lorcana Player), each
 * by the code printed on its cards ("P1" in 25/P1) and its name. Their cards are promo
 * printings of other cards (#805). Disney100's six promos are Promo Set 1's. A set that
 * gathers editions takes the place of its newest, so a new edition brings it forward.
 */
export const PROMO_SETS: readonly PromoSet[] = [
  {code: 'P1', name: 'Promo Set 1'},
  {code: 'C1', name: 'Challenge Set 1'},
  {code: 'P2', name: 'Promo Set 2', unreleased: [37, 38, 39, 40, 41]},
  {code: 'D23', name: 'D23 Collection'},
  {code: 'P3', name: 'Promo Set 3'},
  {code: 'C2', name: 'Challenge Set 2', upcoming: [19]},
  {code: 'DIS', name: 'Disney Promo', upcoming: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]},
  {code: 'P4', name: 'Promo Set 4', upcoming: [2, 3, 4, 5, 6]},
  {code: 'PD1', name: 'PD Promo Set'},
  {code: 'C3', name: 'Challenge Set 3'},
  {
    code: 'CC',
    name: "Curator's Collection",
    editions: [
      {code: 'CC1', name: 'Heroines Edition'},
      {code: 'CC2', name: 'Beauty and the Beast Edition'},
    ],
  },
  {code: 'RPH', name: 'RPH Promo'},
];

/** Whether a promo set goes by this code, or gathers an edition printed with it. */
const holds = (set: PromoSet, code: string) =>
  set.code === code || (set.editions?.some((edition) => edition.code === code) ?? false);

/** A promo set's place in release order, 0 for Promo Set 1, an edition its set's; -1 for a code no promo set has. */
export const promoSetRank = (code: string): number =>
  PROMO_SETS.findIndex((set) => holds(set, code));

/** The promo set with this code, or the one that gathers it as an edition ("CC1"); undefined for any other code. */
export const promoSetOf = (code: string): PromoSet | undefined =>
  PROMO_SETS.find((set) => holds(set, code));

/** The edition printed with this code ("CC1"), or undefined for any code no edition has. */
export const promoEditionOf = (code: string): PromoEdition | undefined =>
  promoSetOf(code)?.editions?.find((edition) => edition.code === code);

/**
 * The set a card printed with this code is collected in: an edition's promo set ("CC1" in
 * "CC"), else the code's own.
 */
export function binderSetOf(code: string): string {
  const set = promoSetOf(code);
  return set !== undefined && promoEditionOf(code) !== undefined ? set.code : code;
}

/** The codes printed on a set's cards, in its binder's order: a promo set's editions, else the set's own code. */
export const printedCodesOf = (code: string): string[] =>
  PROMO_SETS.find((set) => set.code === code)?.editions?.map((edition) => edition.code) ?? [code];

/** An edition's place among its set's editions, oldest 0; 0 for any other code. */
export const editionRank = (code: string): number =>
  Math.max(0, promoSetOf(code)?.editions?.findIndex((edition) => edition.code === code) ?? 0);
