import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {
  searchCardsByName,
  filterCards,
  getUniqueKeywords,
  getUniqueClassifications,
  getUniqueSets,
  loadCardsFromJSON,
  fetchCardsFromLocal,
  smallImageUrl,
  applySortOrder,
} from '../loader';
import type {LorcanaCard} from '../types';
import {createCard} from '../../../shared/test-utils';

/** Wrap card overrides in the JSON structure loadCardsFromJSON expects. */
function makeJsonData(...cardOverrides: Record<string, unknown>[]) {
  return {
    metadata: {formatVersion: '1.0', generatedOn: '2024-01-01', language: 'en'},
    cards: cardOverrides.map((c, i) => ({
      id: i + 1,
      name: 'Test',
      fullName: 'Test Card',
      simpleName: 'test',
      cost: 3,
      color: 'Amber',
      inkwell: true,
      type: 'Character',
      ...c,
    })),
  };
}

describe('Card Search', () => {
  const cards: LorcanaCard[] = [
    createCard({id: '1', name: 'Elsa', fullName: 'Elsa - Snow Queen'}),
    createCard({id: '2', name: 'Anna', fullName: 'Anna - Heir to Arendelle'}),
    createCard({id: '3', name: 'Elsa', fullName: 'Elsa - Ice Maker', version: 'Ice Maker'}),
    createCard({id: '4', name: 'Mickey Mouse', fullName: 'Mickey Mouse - Brave Little Tailor'}),
  ];

  it.each([
    ['name (case insensitive)', 'elsa', 2],
    ['fullName', 'Snow Queen', 1],
    ['version', 'Ice Maker', 1],
    ['no match', 'Donald', 0],
  ])('should search by %s', (_label, query, expectedCount) => {
    expect(searchCardsByName(cards, query)).toHaveLength(expectedCount);
  });
});

describe('Card Filtering', () => {
  const cards: LorcanaCard[] = [
    createCard({id: '1', ink: 'Amber', cost: 2, type: 'Character'}),
    createCard({id: '2', ink: 'Amethyst', cost: 4, type: 'Action'}),
    createCard({id: '3', ink: 'Amber', cost: 6, type: 'Item'}),
    createCard({id: '4', ink: 'Ruby', cost: 3, type: 'Character', keywords: ['Evasive']}),
    createCard({
      id: '5',
      ink: 'Sapphire',
      cost: 5,
      type: 'Character',
      classifications: ['Princess'],
    }),
    createCard({id: '6', ink: 'Steel', cost: 1, type: 'Location', setCode: '1'}),
    createCard({id: '7', ink: 'Emerald', cost: 7, type: 'Character', setCode: '5'}),
  ];

  it('should filter by single ink', () => {
    const results = filterCards(cards, {ink: 'Amber'});
    expect(results).toHaveLength(2);
    expect(results.every((c) => c.ink === 'Amber')).toBe(true);
  });

  it('should filter by multiple inks', () => {
    expect(filterCards(cards, {ink: ['Amber', 'Ruby']})).toHaveLength(3);
  });

  it('should match dual-ink cards on either ink', () => {
    const dualInkCards = [
      ...cards,
      createCard({id: 'dual-1', ink: 'Amethyst', ink2: 'Sapphire', cost: 5}),
    ];
    expect(filterCards(dualInkCards, {ink: 'Sapphire'}).some((c) => c.id === 'dual-1')).toBe(true);
    expect(filterCards(dualInkCards, {ink: 'Amethyst'}).some((c) => c.id === 'dual-1')).toBe(true);
    expect(filterCards(dualInkCards, {ink: 'Ruby'}).some((c) => c.id === 'dual-1')).toBe(false);
  });

  it('should filter by card type', () => {
    const results = filterCards(cards, {type: 'Character'});
    expect(results).toHaveLength(4);
    expect(results.every((c) => c.type === 'Character')).toBe(true);
  });

  it('should filter by multiple types', () => {
    expect(filterCards(cards, {type: ['Character', 'Action']})).toHaveLength(5);
  });

  it('should filter by discrete costs', () => {
    const results = filterCards(cards, {costs: [3, 4, 5]});
    expect(results).toHaveLength(3);
    expect(results.every((c) => [3, 4, 5].includes(c.cost))).toBe(true);
  });

  it('should treat cost 9 as 9+ bucket (matching cost 9, 10, 12)', () => {
    const highCostCards = [
      createCard({id: '1', cost: 9}),
      createCard({id: '2', cost: 10}),
      createCard({id: '3', cost: 12}),
      createCard({id: '4', cost: 8}),
    ];
    const results = filterCards(highCostCards, {costs: [9]});
    expect(results).toHaveLength(3);
  });

  it('should filter by keywords', () => {
    expect(filterCards(cards, {keywords: ['Evasive']})).toHaveLength(1);
  });

  it('should filter by classifications', () => {
    expect(filterCards(cards, {classifications: ['Princess']})).toHaveLength(1);
  });

  it('should filter by set code', () => {
    const results = filterCards(cards, {setCode: '5'});
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('7');
  });

  it('should combine multiple filters', () => {
    const results = filterCards(cards, {ink: 'Amber', costs: [6]});
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('3');
  });

  it('should filter by text search matching card text or fullName', () => {
    const textCards = [
      createCard({id: '1', fullName: 'Elsa', text: 'draw a card'}),
      createCard({id: '2', fullName: 'Mickey Mouse - Leader', text: undefined}),
    ];
    expect(filterCards(textCards, {textSearch: 'draw'})).toHaveLength(1);
    expect(filterCards(textCards, {textSearch: 'Mouse'})).toHaveLength(1);
    expect(filterCards(textCards, {textSearch: 'ability'})).toHaveLength(0);
  });

  it('should return empty for missing keywords/classifications', () => {
    const plain = [createCard({id: '1'})];
    expect(filterCards(plain, {keywords: ['Evasive']})).toHaveLength(0);
    expect(filterCards(plain, {classifications: ['Princess']})).toHaveLength(0);
  });
});

describe('Song Type Filtering', () => {
  const cards: LorcanaCard[] = [
    createCard({id: '1', type: 'Character', name: 'Elsa'}),
    createCard({id: '2', type: 'Action', name: 'Dragon Fire'}),
    createCard({id: '3', type: 'Action', isSong: true, name: 'Let It Go'}),
    createCard({id: '4', type: 'Action', isSong: true, name: 'Be Our Guest'}),
    createCard({id: '5', type: 'Item', name: 'Magic Broom'}),
  ];

  it('should filter Song to only song cards', () => {
    const results = filterCards(cards, {type: 'Song'});
    expect(results).toHaveLength(2);
    expect(results.every((c) => c.isSong)).toBe(true);
  });

  it('should filter Action to only non-song actions', () => {
    const results = filterCards(cards, {type: 'Action'});
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Dragon Fire');
  });

  it('should filter Action + Song to all action cards', () => {
    expect(filterCards(cards, {type: ['Action', 'Song']})).toHaveLength(3);
  });

  it('should combine Song with other types', () => {
    expect(filterCards(cards, {type: ['Character', 'Song']})).toHaveLength(3);
  });
});

describe('Unique Extractors', () => {
  const cards: LorcanaCard[] = [
    createCard({id: '1', keywords: ['Singer 5', 'Evasive']}),
    createCard({id: '2', keywords: ['Singer 3']}),
    createCard({id: '3', keywords: ['Bodyguard', 'Ward']}),
    createCard({id: '4', classifications: ['Princess', 'Hero']}),
    createCard({id: '5', classifications: ['Villain']}),
    createCard({id: '6', setCode: '1'}),
    createCard({id: '7', setCode: '5'}),
    createCard({id: '8', setCode: '10'}),
    createCard({id: '9', setCode: 'Q1'}),
  ];

  it('should extract unique keywords (base form)', () => {
    const keywords = getUniqueKeywords(cards);
    expect(keywords).toContain('Singer');
    expect(keywords).not.toContain('Singer 5');
  });

  it('should extract unique classifications', () => {
    const classifications = getUniqueClassifications(cards);
    expect(classifications).toHaveLength(3);
    expect(classifications).toContain('Princess');
    expect(classifications).toContain('Hero');
    expect(classifications).toContain('Villain');
  });

  it('should extract unique sets sorted numerically', () => {
    expect(getUniqueSets(cards)).toEqual(['1', '5', '10', 'Q1']);
  });
});

describe('loadCardsFromJSON', () => {
  it('should transform LorcanaJSON data to LorcanaCard format', () => {
    const cards = loadCardsFromJSON(
      makeJsonData({
        name: 'Elsa',
        version: 'Snow Queen',
        fullName: 'Elsa - Snow Queen',
        cost: 5,
        color: 'Sapphire',
        subtypes: ['Floodborn', 'Princess'],
        abilities: [
          {type: 'keyword', keyword: 'Singer', keywordValue: '5', fullText: 'Singer 5'},
          {type: 'keyword', keyword: 'Evasive', fullText: 'Evasive'},
        ],
        fullText: 'This card has abilities',
        strength: 3,
        willpower: 4,
        lore: 2,
        images: {thumbnail: 'https://example.com/elsa.jpg'},
        setCode: '5',
        number: 42,
      }),
    );

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      id: '1',
      name: 'Elsa',
      version: 'Snow Queen',
      fullName: 'Elsa - Snow Queen',
      cost: 5,
      ink: 'Sapphire',
      inkwell: true,
      type: 'Character',
      classifications: ['Floodborn', 'Princess'],
      keywords: ['Singer 5', 'Evasive'],
      text: 'This card has abilities',
      strength: 3,
      willpower: 4,
      lore: 2,
      imageUrl: 'https://example.com/elsa.jpg',
      setCode: '5',
      setNumber: 42,
    });
  });

  it('should preserve both inks for dual-ink cards', () => {
    const cards = loadCardsFromJSON(makeJsonData({color: 'Amethyst-Sapphire'}));
    expect(cards[0].ink).toBe('Amethyst');
    expect(cards[0].ink2).toBe('Sapphire');
  });

  it('should filter out Song from subtypes (classifications)', () => {
    const cards = loadCardsFromJSON(makeJsonData({type: 'Action', subtypes: ['Song']}));
    expect(cards[0].classifications).toBeUndefined();
  });

  it.each([
    ['invalid ink color', {color: 'Purple'}],
    ['invalid type', {type: 'Enchantment'}],
  ])('should skip cards with %s', (_label, overrides) => {
    expect(loadCardsFromJSON(makeJsonData(overrides))).toHaveLength(0);
  });

  it('should load all cards from pre-deduplicated data', () => {
    const cards = loadCardsFromJSON(
      makeJsonData({setCode: '5'}, {id: 2, name: 'Test2', setCode: '6'}),
    );
    expect(cards).toHaveLength(2);
  });

  it('should handle cards without setCode or abilities', () => {
    const cards = loadCardsFromJSON(makeJsonData({}));
    expect(cards).toHaveLength(1);
    expect(cards[0].setCode).toBeUndefined();
    expect(cards[0].keywords).toBeUndefined();
  });

  it.each([
    [
      'populated sections',
      {fullTextSections: ['Singer 5 (reminder)', 'ABILITY — effect']},
      ['Singer 5 (reminder)', 'ABILITY — effect'],
    ],
    [
      'empty/whitespace entries filtered',
      {fullTextSections: ['Ability one', '', '  ', 'Ability two']},
      ['Ability one', 'Ability two'],
    ],
    ['all empty entries', {fullTextSections: ['', '  ']}, undefined],
    ['absent fullTextSections', {}, undefined],
  ])('textSections: %s', (_label, overrides, expected) => {
    const cards = loadCardsFromJSON(makeJsonData({fullText: 'text', ...overrides}));
    expect(cards[0].textSections).toEqual(expected);
  });

  it('should extract conditional Shift from ability effect text', () => {
    const cards = loadCardsFromJSON(
      makeJsonData({
        name: 'Anna',
        version: 'Soothing Sister',
        fullName: 'Anna - Soothing Sister',
        cost: 5,
        abilities: [
          {
            type: 'static',
            name: 'UNUSUAL TRANSFORMATION',
            effect: "If a card left a player's discard this turn, this card gains Shift 0.",
            fullText:
              "UNUSUAL TRANSFORMATION If a card left a player's discard this turn, this card gains Shift 0.",
          },
        ],
      }),
    );
    expect(cards[0].keywords).toContain('Shift 0');
  });
});

describe('fetchCardsFromLocal', () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mockFetch.mockReset();
  });

  it('should fetch and parse cards from local JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeJsonData({})),
    });

    const result = await fetchCardsFromLocal('/data/test.json');
    expect(mockFetch).toHaveBeenCalledWith('/data/test.json');
    expect(result.cards).toHaveLength(1);
    expect(result.sets).toEqual([]);
  });

  it('should throw error when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({ok: false, status: 404});
    await expect(fetchCardsFromLocal('/data/missing.json')).rejects.toThrow(
      'Failed to fetch local cards: 404',
    );
  });

  it.each([
    ['Error object', () => Promise.reject(new Error('Invalid JSON'))],
    ['non-Error value', () => Promise.reject('Something went wrong')],
  ])('should throw parse error for %s', async (_label, jsonFn) => {
    mockFetch.mockResolvedValueOnce({ok: true, json: jsonFn});
    await expect(fetchCardsFromLocal('/data/invalid.json')).rejects.toThrow(
      'Failed to parse card data: Invalid JSON',
    );
  });
});

describe('smallImageUrl', () => {
  it.each([
    ['/card-images/123.avif', '/card-images/123-sm.avif'],
    ['/card-images/elsa.jpg', '/card-images/elsa.jpg'],
    ['/card-images/123', '/card-images/123'],
    [undefined, undefined],
  ])('smallImageUrl(%s) → %s', (input, expected) => {
    expect(smallImageUrl(input)).toBe(expected);
  });
});

describe('applySortOrder - ink-cost', () => {
  const cards: LorcanaCard[] = [
    createCard({id: '1', ink: 'Sapphire', cost: 3, fullName: 'Zephyr'}),
    createCard({id: '2', ink: 'Amber', cost: 5, fullName: 'Alpha'}),
    createCard({id: '3', ink: 'Amber', cost: 2, fullName: 'Beta'}),
    createCard({id: '4', ink: 'Emerald', cost: 4, fullName: 'Gamma'}),
  ];

  it('should sort by ink color then cost ascending', () => {
    const sorted = applySortOrder(cards, 'ink-cost');
    expect(sorted.map((c) => c.ink)).toEqual(['Amber', 'Amber', 'Emerald', 'Sapphire']);
    expect(sorted[0].cost).toBe(2);
    expect(sorted[1].cost).toBe(5);
  });

  it('should not mutate the input array', () => {
    const original = [...cards];
    applySortOrder(cards, 'ink-cost');
    expect(cards).toEqual(original);
  });
});
