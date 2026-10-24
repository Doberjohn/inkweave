import {describe, it, expect} from 'vitest';
import {sheetCount, viewSheets} from '../binderSheets';

describe('binderSheets', () => {
  it('draws three sheets under the right page of a set\'s second spread, and none under the left', () => {
    // Nine spreads, the first opening on the front cover: the second is view 1.
    expect(viewSheets(1, 9, false)).toEqual({left: 0, right: 3});
  });

  it('moves a sheet to the left page as the spreads go by', () => {
    expect(viewSheets(2, 9, false)).toEqual({left: 1, right: 2});
  });

  it('draws three under the left page of the last spread, and none under the right', () => {
    expect(viewSheets(8, 9, false)).toEqual({left: 3, right: 0});
  });

  it("lays a phone's lone page on the pages still to come, with no left page", () => {
    expect(viewSheets(0, 17, true)).toEqual({left: 0, right: 3});
    expect(viewSheets(16, 17, true)).toEqual({left: 0, right: 0});
  });

  it('draws one sheet for the fewest there can be, and never more than three', () => {
    expect(sheetCount(0, 9)).toBe(0);
    expect(sheetCount(1, 40)).toBe(1);
    expect(sheetCount(50, 40)).toBe(3);
  });
});
