import {describe, it, expect, expectTypeOf} from 'vitest';
import {
  TODAY_PAGE,
  loneFitFor,
  lonePage,
  mapBandHeight,
  pagingOf,
  pocketsOf,
  squarePage,
  viewPage,
} from '../binderGeometry';

/**
 * Rows that fit. A room 378 wide gives the 3-row page cards 90px wide: 378, less 16 for
 * the board's inset and 92 for the board, spine, padding and gaps across, over three. Down, a
 * 4-row page takes 136 besides its cards (2 over the map, the map's band of 56, 76 of board,
 * padding and gaps, and 2 left unused against rounding), so its cards are (height - 136) x 0.72 / 4
 * wide, and keep 90% of 90 from a height of 586.
 */
describe('loneFitFor', () => {
  it('draws 3 rows where 4 would shrink the cards below 90% of their 3-row width', () => {
    expect(loneFitFor({width: 378, height: 585}, TODAY_PAGE)).toEqual({rows: 3});
  });

  it('draws 4 rows from there, the box capped to the width whose page and map fit the height', () => {
    // Cards (587 - 136) x 0.18 = 81.18 wide, so 16 + 92 + 3 x 81.18 across.
    const fit = loneFitFor({width: 378, height: 587}, TODAY_PAGE);
    expect(fit.rows).toBe(4);
    expect(fit.maxWidth).toBeCloseTo(351.54, 2);
  });

  it('draws 4 rows as wide as the room on a screen tall enough for that', () => {
    const fit = loneFitFor({width: 378, height: 900}, TODAY_PAGE);
    expect(fit.rows).toBe(4);
    expect(fit.maxWidth).toBeCloseTo(378, 6);
  });

  it("weighs a wider phone's page by its own width", () => {
    // 414 wide: cards 102 at 3 rows, so 4 need a height of 136 + 5 x 102 = 646.
    expect(loneFitFor({width: 414, height: 645}, TODAY_PAGE).rows).toBe(3);
    expect(loneFitFor({width: 414, height: 647}, TODAY_PAGE).rows).toBe(4);
  });
});

/**
 * A square page fits by its own size. A room 378 wide gives a 4 by 4 page cards 65.5 wide: 378,
 * less 16 for the inset and 100 for the board, spine, padding and gaps across, over four. Down it
 * takes 136 besides its cards (2 over the map, the map's band of 56, 76 of board, padding and
 * gaps, and 2 against rounding), so its cards are (height - 136) x 0.72 / 4 wide.
 */
describe('loneFitFor, a square page', () => {
  it('draws it as wide as the binder where its page and map fit the height', () => {
    expect(loneFitFor({width: 378, height: 520}, squarePage(4))).toEqual({rows: 3});
  });

  it('caps its box to the width that fits, where its cards keep 90% of their width', () => {
    // Cards (480 - 136) x 0.18 = 61.92 wide, 95% of 65.5: 16 + 100 + 4 x 61.92 across.
    expect(loneFitFor({width: 378, height: 480}, squarePage(4)).maxWidth).toBeCloseTo(363.68, 2);
  });

  it('leaves it width-driven on a phone too short for that, which scrolls to its map', () => {
    // (450 - 136) x 0.18 = 56.52, under 90% of 65.5.
    expect(loneFitFor({width: 378, height: 450}, squarePage(4))).toEqual({rows: 3});
  });
});

describe('a lone page by its rows', () => {
  it('holds nine pockets at 3 rows and twelve at 4, its map band 45 and 56 tall', () => {
    expect([pocketsOf(lonePage(3)), pocketsOf(lonePage(4))]).toEqual([9, 12]);
    expect([mapBandHeight(3), mapBandHeight(4)]).toEqual([45, 56]);
  });

  it("pages today's binder by one object per row count, so a dependency list sees a change only when the rows change", () => {
    expect(pagingOf(TODAY_PAGE, true, 4)).toBe(pagingOf(TODAY_PAGE, true, 4));
    expect(pagingOf(TODAY_PAGE, true, 3)).not.toBe(pagingOf(TODAY_PAGE, true, 4));
    expect(pagingOf(TODAY_PAGE, true, 4)).toEqual({perView: 12, lead: 12});
    expect(pagingOf(TODAY_PAGE, true, 3)).toEqual({perView: 9, lead: 9});
    expect(pagingOf(TODAY_PAGE, false, 4)).toEqual({perView: 24, lead: 12});
  });
});

describe('a page at its size', () => {
  it('pages a spread by two of its pages, the front cover taking the first', () => {
    expect(pagingOf(squarePage(2), false, 3)).toEqual({perView: 8, lead: 4});
    expect(pagingOf(squarePage(3), false, 3)).toEqual({perView: 18, lead: 9});
    expect(pagingOf(squarePage(4), false, 3)).toEqual({perView: 32, lead: 16});
  });

  it("pages a phone by the square itself, whatever rows today's page would fit", () => {
    expect(pagingOf(squarePage(4), true, 3)).toEqual({perView: 16, lead: 16});
    expect(pagingOf(squarePage(3), true, 4)).toEqual({perView: 9, lead: 9});
    expect(viewPage(squarePage(2), true, 4)).toBe(squarePage(2));
  });

  it("draws today's page 3 across on a phone, and as it is on a spread", () => {
    expect(viewPage(TODAY_PAGE, true, 4)).toEqual({columns: 3, rows: 4});
    expect(viewPage(TODAY_PAGE, false, 4)).toBe(TODAY_PAGE);
  });

  it("takes no page a view draws for a binder's own, so a 3 by 3 lone page never passes for a square", () => {
    // Checked by the typecheck: without the refusal, the directive below is unused and fails it.
    // @ts-expect-error a lone page is drawn from today's, and is no binder's page
    expectTypeOf(pagingOf).toBeCallableWith(viewPage(TODAY_PAGE, true, 3), true, 4);
    expectTypeOf(pagingOf).toBeCallableWith(squarePage(3), true, 4);
  });

  it('keeps one grid and one paging per size, so a dependency list sees a change only when the size changes', () => {
    expect(squarePage(3)).toBe(squarePage(3));
    expect(pagingOf(squarePage(3), false, 3)).toBe(pagingOf(squarePage(3), false, 4));
  });
});
