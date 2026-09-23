import {describe, it, expect} from 'vitest';
import {mobileSlotWidth} from '../mosaicSizing';
import {ROWS, ROWS_MOBILE} from '../CardMosaic';
import {PER_INK} from '../setComposition';
import {ALL_INKS} from '../../../shared/constants';

const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);

// MAX_COLS is the widest mobile row the sizing math is proven for, a fixed ceiling
// rather than the season's peak: the layouts suite below requires every
// ROWS_MOBILE to peak at or under it. Overflow can only happen when the 38px MIN
// clamp bites, and that row width grows with the column count, so a narrower
// layout always fits too. The mobile gap is 5px.
const MAX_COLS = 6;
const GAP = 5;
const widestRowWidth = (slotW: number) => slotW * MAX_COLS + (MAX_COLS - 1) * GAP;

// Usable mosaic width = viewport − 32px page padding − 32px board padding.
const avail = (viewport: number) => viewport - 64;

describe('mobileSlotWidth', () => {
  it('falls back to 46 before the rail is measured (width 0)', () => {
    expect(mobileSlotWidth(0, MAX_COLS, GAP)).toBe(46);
  });

  it('fits the widest row at the 320px floor', () => {
    const w = mobileSlotWidth(avail(320), MAX_COLS, GAP);
    expect(w).toBe(38);
    expect(widestRowWidth(w)).toBeLessThanOrEqual(avail(320));
  });

  it('grows to 50px on a typical 390px phone', () => {
    expect(mobileSlotWidth(avail(390), MAX_COLS, GAP)).toBe(50);
  });

  it('caps at 58px on a wide (~760px) "mobile" tablet', () => {
    expect(mobileSlotWidth(avail(760), MAX_COLS, GAP)).toBe(58);
  });

  it('never lets the widest row overflow, across 320–767px viewports', () => {
    for (let vp = 320; vp <= 767; vp++) {
      const w = mobileSlotWidth(avail(vp), MAX_COLS, GAP);
      expect(widestRowWidth(w)).toBeLessThanOrEqual(avail(vp));
    }
  });
});

describe('mosaic diamond layouts', () => {
  it('each ink renders exactly its PER_INK slot count (desktop + mobile)', () => {
    for (const ink of ALL_INKS) {
      expect(sum(ROWS[ink])).toBe(PER_INK[ink]);
      expect(sum(ROWS_MOBILE[ink])).toBe(PER_INK[ink]);
    }
  });

  it('desktop diamonds peak at <= 8 columns, mobile at <= 6', () => {
    for (const ink of ALL_INKS) {
      expect(Math.max(...ROWS[ink])).toBeLessThanOrEqual(8);
      expect(Math.max(...ROWS_MOBILE[ink])).toBeLessThanOrEqual(MAX_COLS);
    }
  });
});
