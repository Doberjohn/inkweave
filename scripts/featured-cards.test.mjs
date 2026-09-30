import {describe, it, expect} from 'vitest';
import {buildFeaturedCards, featuredIdsSetting, resolveFeaturedIds} from './featured-cards.mjs';

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
    expect(out.metadata).toBe(main.metadata);
  });

  it('prefers allCards.json on an id conflict and drops a card below the Core floor', () => {
    const out = buildFeaturedCards({main, preview, ids: ['3022', '1000'], isCoreSet});

    expect(out.cards).toEqual([card(3022)]);
  });
});

describe('featuredIdsSetting', () => {
  const files = {
    '.env.local': 'VITE_SUPABASE_URL=x\nVITE_FEATURED_CARD_IDS="1,2"\n',
    '.env': 'VITE_FEATURED_CARD_IDS=3\n',
  };
  const readEnvFile = (name) => files[name] ?? null;

  it.each([
    ['the environment first, as Vite does, even when empty', {VITE_FEATURED_CARD_IDS: ''}, readEnvFile, ''],
    ['.env.local before .env, unquoted', {}, readEnvFile, '1,2'],
    ['nothing when no file sets it', {}, () => null, undefined],
  ])('reads %s', (_label, env, read, expected) => {
    expect(featuredIdsSetting(env, read)).toBe(expected);
  });
});

describe('resolveFeaturedIds', () => {
  it.each([
    ['the env list when set', ' 1, 2 ,,3 ', ['1', '2', '3']],
    ['the defaults when unset', undefined, ['a']],
    ['the defaults when blank', ' , ', ['a']],
  ])('uses %s', (_label, raw, expected) => {
    expect(resolveFeaturedIds(raw, ['a'])).toEqual(expected);
  });
});
