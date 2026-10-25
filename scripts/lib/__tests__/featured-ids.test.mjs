import fs from 'node:fs';
import {describe, it, expect} from 'vitest';
import {
  FEATURED_INKS,
  featuredEntry,
  featuredIdsJson,
  missingFeaturedInks,
} from '../featured-ids.mjs';

const FEATURED_FILE = fs.readFileSync(
  new URL('../../../apps/web/src/features/cards/featuredCardIds.json', import.meta.url),
  'utf8',
);

describe('featuredEntry', () => {
  it('names a card by its ink and full name, its id as a string', () => {
    expect(featuredEntry({id: 3328, inks: ['Amethyst'], fullName: 'Un Poco Loco'})).toEqual({
      id: '3328',
      card: 'Amethyst: Un Poco Loco',
    });
  });

  it("joins a dual-ink card's inks as LorcanaJSON's color does", () => {
    const entry = featuredEntry({
      id: '3201',
      inks: ['Amber', 'Steel'],
      fullName: 'Ariel - Spectacular Singer',
    });

    expect(entry.card).toBe('Amber-Steel: Ariel - Spectacular Singer');
  });
});

describe('missingFeaturedInks', () => {
  it('finds nothing missing when the cards carry all six inks', () => {
    expect(missingFeaturedInks(FEATURED_INKS.map((ink) => [ink]))).toEqual([]);
  });

  it('names the inks no card carries, in the list order', () => {
    expect(missingFeaturedInks([['Amber'], ['Emerald'], ['Steel']])).toEqual([
      'Amethyst',
      'Ruby',
      'Sapphire',
    ]);
  });

  it('counts a dual-ink card for both of its inks', () => {
    const cards = [['Amber', 'Amethyst'], ['Emerald'], ['Ruby', 'Sapphire'], ['Steel']];

    expect(missingFeaturedInks(cards)).toEqual([]);
  });
});

describe('featuredIdsJson', () => {
  it('writes featuredCardIds.json in the format the file is kept in', () => {
    expect(featuredIdsJson(JSON.parse(FEATURED_FILE))).toBe(FEATURED_FILE);
  });
});
