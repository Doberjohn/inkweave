import {describe, it, expect} from 'vitest';
import {mobileSlotWidth} from '../mosaicSizing';

// The mobile mosaic's widest row (ROWS_MOBILE) has 6 slots; the mobile gap is 5px.
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
