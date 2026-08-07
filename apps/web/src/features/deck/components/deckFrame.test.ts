import {describe, it, expect} from 'vitest';
import {frameFor, FRAME} from './deckFrame';
import type {Ink} from '../types';

const ALL: Ink[] = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];

describe('frameFor', () => {
  it('sorts alphabetically, so ink order in the deck does not matter', () => {
    // The 21 assets are named alphabetically. A deck stores its inks in whatever
    // order they were added, so without the sort half of them would 404.
    expect(frameFor(['Steel', 'Emerald'])).toBe('/art/frames/emerald-steel.webp');
    expect(frameFor(['Emerald', 'Steel'])).toBe('/art/frames/emerald-steel.webp');
  });

  it('gives a mono-ink deck the single-ink frame', () => {
    expect(frameFor(['Amber'])).toBe('/art/frames/amber.webp');
  });

  // The case that used to resolve to "/art/frames/.webp" and render a blank card:
  // an <img> with a bad src fails silently, and the text layers on top still made
  // it look like a card.
  it('returns null for a deck with no inks rather than a broken path', () => {
    expect(frameFor([])).toBeNull();
  });

  it('names a frame that exists for every legal ink combination', () => {
    // 6 mono + 15 pairs = the 21 assets on disk. This asserts the NAMES the code
    // will request; `deckFrame.assets.test` (node, fs) asserts they are all there.
    const combos: Ink[][] = ALL.map((ink) => [ink]);
    for (let i = 0; i < ALL.length; i++) {
      for (let j = i + 1; j < ALL.length; j++) combos.push([ALL[i], ALL[j]]);
    }
    const paths = combos.map((c) => frameFor(c));
    expect(paths).toHaveLength(21);
    expect(new Set(paths).size).toBe(21);
    expect(paths.every((p) => p?.endsWith('.webp'))).toBe(true);
  });
});

describe('FRAME geometry', () => {
  // These are measurements off the bitmaps, so a change here is either a re-export
  // or a mistake. The test states the invariants a frame must satisfy for the
  // overlay to land in the right places.
  it('places the bands in reading order below the art', () => {
    const artBottom = FRAME.art.top + FRAME.art.height;
    expect(FRAME.bandTop).toBeGreaterThanOrEqual(artBottom - 1);
    expect(FRAME.stripTop).toBeCloseTo(FRAME.bandTop + FRAME.bandHeight, 2);
  });

  it('keeps every overlay inside the card', () => {
    expect(FRAME.art.left + FRAME.art.width).toBeLessThanOrEqual(100);
    expect(FRAME.stripTop + FRAME.stripHeight).toBeLessThanOrEqual(100);
  });

  it('is portrait, at the printed card ratio', () => {
    expect(FRAME.aspect).toBeCloseTo(734 / 1024, 4);
  });
});
