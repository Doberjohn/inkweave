import {describe, it, expect} from 'vitest';
import {buildFeaturedCards} from './featured-cards.mjs';

const card = (id, setCode = '13', extra = {}) => ({id, name: `Card ${id}`, setCode, ...extra});
const isCoreSet = (code) => Number(code) >= 9;

const main = {
  metadata: {formatVersion: '2.3.2', generatedOn: '2026-07-07', language: 'en'},
  sets: {8: {name: 'Old set'}, 13: {name: 'Set 13'}},
  cards: [card(2999), card(3022), card(1000, '8')],
};
const preview = {
  sets: {14: {name: 'Hyperia City'}},
  cards: [card(14001, '14'), card(3022, '13', {name: 'Preview copy'})],
};

describe('buildFeaturedCards', () => {
  it("builds the configured cards in allCards.json's shape and display order, with only their sets", () => {
    const out = buildFeaturedCards({main, preview, ids: ['14001', '2999'], isCoreSet});

    expect(out.cards.map((c) => c.id)).toEqual([14001, 2999]);
    expect(Object.keys(out.sets).sort()).toEqual(['13', '14']);
    expect(out.metadata).toEqual(main.metadata);
  });

  it('prefers allCards.json on an id conflict and drops a card below the Core floor', () => {
    const out = buildFeaturedCards({main, preview, ids: ['3022', '1000'], isCoreSet});

    expect(out.cards).toEqual([card(3022)]);
  });

  it('leaves out an ID neither file has, so the file comes out short and the app falls back', () => {
    const out = buildFeaturedCards({main, preview, ids: ['2999', '99999'], isCoreSet});

    expect(out.cards).toEqual([card(2999)]);
  });

  it('builds from allCards.json alone when there is no preview file', () => {
    const out = buildFeaturedCards({main, preview: null, ids: ['2999', '14001'], isCoreSet});

    expect(out.cards).toEqual([card(2999)]);
    expect(Object.keys(out.sets)).toEqual(['13']);
  });
});
