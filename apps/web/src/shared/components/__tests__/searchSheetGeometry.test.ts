import {describe, it, expect} from 'vitest';
import {searchSheetGeometry, SHEET_TOP_GAP} from '../searchSheetGeometry';

/** An iPhone-X-class screen with no keyboard up. */
const IDLE = {layoutHeight: 812, visibleHeight: 812, keyboardInset: 0, hasResults: false};

describe('searchSheetGeometry', () => {
  it('keeps the established idle height when nothing covers the viewport', () => {
    // 244/568 is what the hardcoded implementation produced at 812. Preserving it
    // is deliberate: this change is about the occluded case, and an idle sheet
    // that suddenly jumped size would be an unrelated visual regression.
    const {top, bottom} = searchSheetGeometry(IDLE);

    expect(top).toBe(244);
    expect(bottom).toBe(0);
  });

  it('pins the sheet above the keyboard rather than behind it', () => {
    const {bottom} = searchSheetGeometry({...IDLE, visibleHeight: 476, keyboardInset: 336});

    expect(bottom).toBe(336);
  });

  it('fills the visible band once the keyboard is up', () => {
    // The user is typing, so every remaining pixel should be results.
    const {top, bottom} = searchSheetGeometry({...IDLE, visibleHeight: 476, keyboardInset: 336});

    const height = 812 - bottom - top;
    expect(height).toBe(476 - SHEET_TOP_GAP);
    // Bottom edge sits exactly on the keyboard, top edge inside the visible band.
    expect(top + height).toBe(476);
  });

  it('grows beyond the idle height when there are results to show', () => {
    const idle = searchSheetGeometry(IDLE);
    const withResults = searchSheetGeometry({...IDLE, hasResults: true});

    expect(withResults.top).toBeLessThan(idle.top);
    expect(withResults.top).toBe(SHEET_TOP_GAP);
  });

  it('always leaves a strip of scrim above the sheet', () => {
    // The strip is the only tap-to-dismiss target once the sheet is at full
    // height; a sheet flush to the top edge reads as a page, not an overlay.
    const tall = searchSheetGeometry({...IDLE, hasResults: true});
    const short = searchSheetGeometry({
      layoutHeight: 667,
      visibleHeight: 407,
      keyboardInset: 260,
      hasResults: true,
    });

    expect(tall.top).toBeGreaterThanOrEqual(SHEET_TOP_GAP);
    expect(667 - short.bottom - short.top).toBeLessThanOrEqual(407 - SHEET_TOP_GAP);
  });

  it('scales the idle height with the screen instead of using a fixed offset', () => {
    const small = searchSheetGeometry({...IDLE, layoutHeight: 667, visibleHeight: 667});

    // A fixed 244px offset costs a 667px screen 37% of its height but a 932px
    // screen only 26%. Proportional keeps the sheet feeling the same size.
    expect(small.top).toBeLessThan(244);
  });

  it('never produces a negative height on a degenerate viewport', () => {
    const {top, bottom} = searchSheetGeometry({
      layoutHeight: 200,
      visibleHeight: 40,
      keyboardInset: 160,
      hasResults: true,
    });

    expect(200 - bottom - top).toBeGreaterThanOrEqual(0);
  });
});
