import {describe, expect, it} from 'vitest';
import {
  copiesRowHeight,
  desktopCardRowHeight,
  modalCardSize,
  pickCardColumnLayout,
  pickCardsRowStyle,
  pickModalFrameStyle,
  pickModalShellStyle,
} from '../cardOverviewModalStyles';

// A phone's window used to shrink-wrap its widest line, so it widened when the synergies landed.
describe('the frame', () => {
  it("takes a phone's width from the start, up to the shell's widest, and leaves desktop's to the shell", () => {
    expect(pickModalFrameStyle(true)).toMatchObject({width: '100%', maxWidth: pickModalShellStyle(true).maxWidth});
    expect(pickModalFrameStyle(false).width).toBeUndefined();
  });
});

describe('modalCardSize', () => {
  it('keeps a desktop card at its full 337x470 where its window fits', () => {
    expect(modalCardSize(false, {viewportHeight: 1080})).toEqual({cardWidth: 337, cardHeight: 470});
    expect(modalCardSize(false, {viewportHeight: 697})).toEqual({cardWidth: 337, cardHeight: 470});
    expect(modalCardSize(false)).toEqual({cardWidth: 337, cardHeight: 470});
  });

  it('counts the copies row under the card where the window holds one', () => {
    expect(modalCardSize(false, {viewportHeight: 741, copiesRow: true})).toEqual({cardWidth: 337, cardHeight: 470});
    expect(modalCardSize(false, {viewportHeight: 740, copiesRow: true})).toEqual({cardWidth: 336, cardHeight: 469});
    expect(modalCardSize(false, {viewportHeight: 740})).toEqual({cardWidth: 337, cardHeight: 470});
  });

  it("shrinks every desktop card alike on a shorter screen, down to a floor, and never a phone's", () => {
    // Every card, printings or not, so all keep one art height (owner, 2026-10-20).
    expect(modalCardSize(false, {viewportHeight: 696})).toEqual({cardWidth: 336, cardHeight: 469});
    expect(modalCardSize(false, {viewportHeight: 674})).toEqual({cardWidth: 321, cardHeight: 447});
    expect(modalCardSize(false, {viewportHeight: 400})).toEqual({cardWidth: 215, cardHeight: 300});
    expect(modalCardSize(true, {viewportHeight: 400, copiesRow: true})).toEqual({cardWidth: 240, cardHeight: 335});
  });
});

// The copies row under the card (owner, 2026-10-22), as tall as the card's own black bar.
describe('the copies row', () => {
  it("is as tall as the card's black bar, under a desktop card or a phone's", () => {
    expect(copiesRowHeight(337)).toBe(32);
    expect(copiesRowHeight(240)).toBe(23);
  });

  // 12px under the card (owner, 2026-10-22).
  it("adds its gap and the row to a desktop card's row only where it shows", () => {
    expect(desktopCardRowHeight({cardWidth: 337, cardHeight: 470, copiesRow: true})).toBe(470 + 12 + 32);
    expect(desktopCardRowHeight({cardWidth: 337, cardHeight: 470, copiesRow: false})).toBe(470);
  });
});

// A card dragged aside to another printing passes over the synergy column (owner, 2026-10-22).
describe('the card row', () => {
  it('lays the card column over the synergy column, and keeps that layer inside the row', () => {
    expect(pickCardColumnLayout(false)).toMatchObject({position: 'relative', zIndex: 1});
    expect(pickCardsRowStyle({isMobile: false, cardWidth: 337, rowHeight: 514}).isolation).toBe('isolate');
  });
});
