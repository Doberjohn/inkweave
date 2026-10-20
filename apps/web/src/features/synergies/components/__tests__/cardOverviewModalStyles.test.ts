import {describe, expect, it} from 'vitest';
import {modalCardSize} from '../cardOverviewModalStyles';

describe('modalCardSize', () => {
  it('keeps a desktop card at its full 337x470 where a window with printings fits', () => {
    expect(modalCardSize(false, 1080)).toEqual({cardWidth: 337, cardHeight: 470});
    expect(modalCardSize(false, 743)).toEqual({cardWidth: 337, cardHeight: 470});
    expect(modalCardSize(false)).toEqual({cardWidth: 337, cardHeight: 470});
  });

  it("shrinks every desktop card alike on a shorter screen, down to a floor, and never a phone's", () => {
    // Every card, printings or not, so all keep one art height (owner, 2026-10-20).
    expect(modalCardSize(false, 742)).toEqual({cardWidth: 336, cardHeight: 469});
    expect(modalCardSize(false, 720)).toEqual({cardWidth: 321, cardHeight: 447});
    expect(modalCardSize(false, 400)).toEqual({cardWidth: 215, cardHeight: 300});
    expect(modalCardSize(true, 400)).toEqual({cardWidth: 240, cardHeight: 335});
  });
});
