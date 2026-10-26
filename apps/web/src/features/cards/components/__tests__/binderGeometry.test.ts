import {describe, it, expect} from 'vitest';
import {loneFitFor, mapBandHeight, pagingOf, perLonePage} from '../binderGeometry';

/**
 * Rows that fit. A room 378 wide gives the 3-row page cards 90px wide: 378, less 16 for
 * the board's inset and 92 for the board, spine, padding and gaps across, over three. Down, a
 * 4-row page takes 134 besides its cards (2 over the map, the map's band of 56, and 76 of board,
 * padding and gaps), so its cards are (height - 134) x 0.72 / 4 wide, and keep 90% of 90 from a
 * height of 584.
 */
describe('loneFitFor', () => {
  it('draws 3 rows where 4 would shrink the cards below 90% of their 3-row width', () => {
    expect(loneFitFor({width: 378, height: 583})).toEqual({rows: 3});
  });

  it('draws 4 rows from there, the box capped to the width whose page and map fit the height', () => {
    // Cards (585 - 134) x 0.18 = 81.18 wide, so 16 + 92 + 3 x 81.18 across.
    const fit = loneFitFor({width: 378, height: 585});
    expect(fit.rows).toBe(4);
    expect(fit.maxWidth).toBeCloseTo(351.54, 2);
  });

  it('draws 4 rows as wide as the room on a screen tall enough for that', () => {
    const fit = loneFitFor({width: 378, height: 900});
    expect(fit.rows).toBe(4);
    expect(fit.maxWidth).toBeCloseTo(378, 6);
  });

  it("weighs a wider phone's page by its own width", () => {
    // 414 wide: cards 102 at 3 rows, so 4 need a height of 134 + 5 x 102 = 644.
    expect(loneFitFor({width: 414, height: 643}).rows).toBe(3);
    expect(loneFitFor({width: 414, height: 645}).rows).toBe(4);
  });
});

describe('a lone page by its rows', () => {
  it('holds nine pockets at 3 rows and twelve at 4, its map band 45 and 56 tall', () => {
    expect([perLonePage(3), perLonePage(4)]).toEqual([9, 12]);
    expect([mapBandHeight(3), mapBandHeight(4)]).toEqual([45, 56]);
  });

  it('pages by one object per row count, so a dependency list sees a change only when the rows change', () => {
    expect(pagingOf(true, 4)).toBe(pagingOf(true, 4));
    expect(pagingOf(true, 3)).not.toBe(pagingOf(true, 4));
    expect(pagingOf(true, 4)).toEqual({perView: 12, lead: 0});
    expect(pagingOf(false, 4)).toEqual({perView: 24, lead: 12});
  });
});
