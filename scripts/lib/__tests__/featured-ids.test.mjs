import fs from 'node:fs';
import {describe, it, expect} from 'vitest';
import {
  FEATURED_INKS,
  featuredEntry,
  featuredIdsJson,
  featuredListProblem,
  missingFeaturedInks,
} from '../featured-ids.mjs';

const WEB = new URL('../../../apps/web/', import.meta.url);
const readWeb = (file) => fs.readFileSync(new URL(file, WEB), 'utf8');
const FEATURED_FILE = readWeb('src/features/cards/featuredCardIds.json');

/** One card per ink, ids 1 to 6. */
const oneOfEach = () => FEATURED_INKS.map((ink, i) => ({id: i + 1, inks: [ink]}));

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

describe('featuredListProblem', () => {
  it('accepts six different cards that carry every ink', () => {
    expect(featuredListProblem(oneOfEach())).toBeNull();
  });

  it.each([
    ['five cards', oneOfEach().slice(1)],
    ['seven cards', [...oneOfEach(), {id: 7, inks: ['Ruby']}]],
    ['the same card twice', [...oneOfEach().slice(1), {id: '2', inks: ['Amber']}]],
  ])('refuses %s', (_label, cards) => {
    expect(featuredListProblem(cards)).toBe('pick 6 different cards');
  });

  it('names the inks no card carries', () => {
    const cards = oneOfEach().map((card) => (card.id === 6 ? {...card, inks: ['Ruby']} : card));

    expect(featuredListProblem(cards)).toBe(
      'pick cards that carry every ink between them (no card is Steel)',
    );
  });
});

// Admin's Featured cards page (Doberjohn/inkweave-admin#95) commits featuredCardIds.json
// straight to master, so the committed list is checked against the real cards here too.
describe('featuredCardIds.json', () => {
  it('names six different cards that carry every ink between them', () => {
    const cards = ['public/data/allCards.json', 'public/data/previewCards.json'].flatMap(
      (file) => JSON.parse(readWeb(file)).cards,
    );
    const inksById = new Map(cards.map((card) => [String(card.id), card.color.split('-')]));
    const listed = JSON.parse(FEATURED_FILE).map(({id}) => ({id, inks: inksById.get(id) ?? []}));

    expect(featuredListProblem(listed)).toBeNull();
  });
});

describe('featuredIdsJson', () => {
  it('writes featuredCardIds.json in the format the file is kept in', () => {
    expect(featuredIdsJson(JSON.parse(FEATURED_FILE))).toBe(FEATURED_FILE);
  });
});
