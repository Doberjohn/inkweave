import fs from 'node:fs';
import path from 'node:path';
import {describe, it, expect} from 'vitest';
import {settleOf} from './binderPockets';

const IDS = (
  JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data/allCards.json'), 'utf8')) as {
    cards: {id: number | string}[];
  }
).cards.map((card) => String(card.id));

describe('settleOf', () => {
  it('settles a card the same way every time', () => {
    expect(settleOf('1936')).toEqual(settleOf('1936'));
  });

  it("keeps every card within a pixel across, 0.4 to 1.6px down and 0.8 of a degree round", () => {
    for (const id of IDS) {
      const {sx, sy, sr} = settleOf(id);
      expect(Math.abs(sx), id).toBeLessThanOrEqual(1);
      expect(sy, id).toBeGreaterThanOrEqual(0.4);
      expect(sy, id).toBeLessThanOrEqual(1.6);
      expect(Math.abs(sr), id).toBeLessThanOrEqual(0.8);
    }
  });

  it("settles a page's cards each its own way, never all leaning alike", () => {
    // A page's twelve cards have ids a character or two apart. Settled by their ids' plain hash,
    // they leant within 0.15 of a degree of each other, and sat as far across.
    const page = IDS.slice(0, 12).map(settleOf);
    const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
    expect(spread(page.map(({sr}) => sr))).toBeGreaterThan(0.8);
    expect(spread(page.map(({sx}) => sx))).toBeGreaterThan(1);
  });
});
