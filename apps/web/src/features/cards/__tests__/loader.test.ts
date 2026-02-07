import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {
  searchCardsByName,
  filterCards,
  getUniqueKeywords,
  getUniqueClassifications,
  getUniqueSets,
  loadCardsFromJSON,
  fetchCardsFromLocal,
} from '../loader';
import type {LorcanaCard} from '../types';
import {createCard} from '../../../shared/test-utils';

describe('Card Search', () => {
  const cards: LorcanaCard[] = [
    createCard({id: '1', name: 'Elsa', fullName: 'Elsa - Snow Queen'}),
    createCard({id: '2', name: 'Anna', fullName: 'Anna - Heir to Arendelle'}),
    createCard({id: '3', name: 'Elsa', fullName: 'Elsa - Ice Maker', version: 'Ice Maker'}),
    createCard({id: '4', name: 'Mickey Mouse', fullName: 'Mickey Mouse - Brave Little Tailor'}),
  ];

  it('should find cards by name (case insensitive)', () => {
    const results = searchCardsByName(cards, 'elsa');
    expect(results).toHaveLength(2);
    expect(results.every((c) => c.name === 'Elsa')).toBe(true);
  });

  it('should find cards by fullName', () => {
    const results = searchCardsByName(cards, 'Snow Queen');
    expect(results).toHaveLength(1);
    expect(results[0].fullName).toBe('Elsa - Snow Queen');
  });

  it('should find cards by version', () => {
    const results = searchCardsByName(cards, 'Ice Maker');
    expect(results).toHaveLength(1);
    expect(results[0].version).toBe('Ice Maker');
  });

  it('should return empty array for no matches', () => {
    const results = searchCardsByName(cards, 'Donald');
    expect(results).toHaveLength(0);
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
    const results = filterCards(cards, {ink: ['Amber', 'Ruby']});
    expect(results).toHaveLength(3);
  });

  it('should filter by card type', () => {
    const results = filterCards(cards, {type: 'Character'});
    expect(results).toHaveLength(4);
    expect(results.every((c) => c.type === 'Character')).toBe(true);
  });

  it('should filter by cost range', () => {
    const results = filterCards(cards, {minCost: 3, maxCost: 5});
    expect(results).toHaveLength(3);
    expect(results.every((c) => c.cost >= 3 && c.cost <= 5)).toBe(true);
  });

  it('should filter by keywords', () => {
    const results = filterCards(cards, {keywords: ['Evasive']});
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('4');
  });

  it('should filter by classifications', () => {
    const results = filterCards(cards, {classifications: ['Princess']});
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('5');
  });

  it('should filter by set code', () => {
    const results = filterCards(cards, {setCode: '5'});
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('7');
  });

  it('should combine multiple filters', () => {
    const results = filterCards(cards, {ink: 'Amber', minCost: 3});
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('3');
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
    expect(keywords).toContain('Evasive');
    expect(keywords).toContain('Bodyguard');
    expect(keywords).toContain('Ward');
    expect(keywords).not.toContain('Singer 5'); // Should extract base keyword
  });

  it('should extract unique classifications', () => {
    const classifications = getUniqueClassifications(cards);
    expect(classifications).toContain('Princess');
    expect(classifications).toContain('Hero');
    expect(classifications).toContain('Villain');
    expect(classifications).toHaveLength(3);
  });

  it('should extract unique sets sorted numerically', () => {
    const sets = getUniqueSets(cards);
    expect(sets).toEqual(['1', '5', '10', 'Q1']);
  });
});

describe('loadCardsFromJSON', () => {
  it('should transform LorcanaJSON data to LorcanaCard format', () => {
    const data = {
      metadata: {formatVersion: '1.0', generatedOn: '2024-01-01', language: 'en'},
      cards: [
        {
          id: 1,
          name: 'Elsa',
          version: 'Snow Queen',
          fullName: 'Elsa - Snow Queen',
          simpleName: 'elsa',
          cost: 5,
          color: 'Sapphire',
          inkwell: true,
          type: 'Character',
          subtypes: ['Floodborn', 'Princess'],
          abilities: [
            {type: 'keyword', keyword: 'Singer', keywordValue: '5', fullText: 'Singer 5'},
            {type: 'keyword', keyword: 'Evasive', fullText: 'Evasive'},
          ],
          fullText: 'This card has abilities',
          strength: 3,
          willpower: 4,
          lore: 2,
          images: {full: 'https://example.com/elsa.jpg'},
          setCode: '5',
          number: 42,
        },
      ],
    };

    const cards = loadCardsFromJSON(data);

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

  it('should handle dual-ink cards by using primary ink', () => {
    const data = {
      metadata: {formatVersion: '1.0', generatedOn: '2024-01-01', language: 'en'},
      cards: [
        {
          id: 1,
          name: 'Test',
          fullName: 'Test Card',
          simpleName: 'test',
          cost: 3,
          color: 'Amethyst-Sapphire',
          inkwell: true,
          type: 'Character',
        },
      ],
    };

    const cards = loadCardsFromJSON(data);

    expect(cards).toHaveLength(1);
    expect(cards[0].ink).toBe('Amethyst');
  });

  it('should filter out Song from subtypes (classifications)', () => {
    const data = {
      metadata: {formatVersion: '1.0', generatedOn: '2024-01-01', language: 'en'},
      cards: [
        {
          id: 1,
          name: 'Let It Go',
          fullName: 'Let It Go',
          simpleName: 'let-it-go',
          cost: 4,
          color: 'Sapphire',
          inkwell: true,
          type: 'Action',
          subtypes: ['Song'],
        },
      ],
    };

    const cards = loadCardsFromJSON(data);

    expect(cards).toHaveLength(1);
    expect(cards[0].classifications).toBeUndefined();
  });

  it('should skip cards with invalid ink color', () => {
    const data = {
      metadata: {formatVersion: '1.0', generatedOn: '2024-01-01', language: 'en'},
      cards: [
        {
          id: 1,
          name: 'Invalid',
          fullName: 'Invalid Card',
          simpleName: 'invalid',
          cost: 1,
          color: 'Purple',
          inkwell: true,
          type: 'Character',
        },
      ],
    };

    const cards = loadCardsFromJSON(data);

    expect(cards).toHaveLength(0);
  });

  it('should skip cards with invalid type', () => {
    const data = {
      metadata: {formatVersion: '1.0', generatedOn: '2024-01-01', language: 'en'},
      cards: [
        {
          id: 1,
          name: 'Invalid',
          fullName: 'Invalid Card',
          simpleName: 'invalid',
          cost: 1,
          color: 'Amber',
          inkwell: true,
          type: 'Enchantment',
        },
      ],
    };

    const cards = loadCardsFromJSON(data);

    expect(cards).toHaveLength(0);
  });

  it('should deduplicate cards by fullName, keeping latest set', () => {
    const data = {
      metadata: {formatVersion: '1.0', generatedOn: '2024-01-01', language: 'en'},
      cards: [
        {
          id: 1,
          name: 'Mickey Mouse',
          fullName: 'Mickey Mouse - Brave Little Tailor',
          simpleName: 'mickey',
          cost: 3,
          color: 'Amber',
          inkwell: true,
          type: 'Character',
          setCode: '1',
        },
        {
          id: 2,
          name: 'Mickey Mouse',
          fullName: 'Mickey Mouse - Brave Little Tailor',
          simpleName: 'mickey',
          cost: 3,
          color: 'Amber',
          inkwell: true,
          type: 'Character',
          setCode: '5',
        },
      ],
    };

    const cards = loadCardsFromJSON(data);

    expect(cards).toHaveLength(1);
    expect(cards[0].setCode).toBe('5');
    expect(cards[0].id).toBe('2');
  });

  it('should handle Q set codes in deduplication (lower priority)', () => {
    const data = {
      metadata: {formatVersion: '1.0', generatedOn: '2024-01-01', language: 'en'},
      cards: [
        {
          id: 1,
          name: 'Test',
          fullName: 'Test Card',
          simpleName: 'test',
          cost: 3,
          color: 'Amber',
          inkwell: true,
          type: 'Character',
          setCode: 'Q1',
        },
        {
          id: 2,
          name: 'Test',
          fullName: 'Test Card',
          simpleName: 'test',
          cost: 3,
          color: 'Amber',
          inkwell: true,
          type: 'Character',
          setCode: '1',
        },
      ],
    };

    const cards = loadCardsFromJSON(data);

    expect(cards).toHaveLength(1);
    expect(cards[0].setCode).toBe('1'); // Regular set takes priority over Q set
  });

  it('should handle cards without setCode', () => {
    const data = {
      metadata: {formatVersion: '1.0', generatedOn: '2024-01-01', language: 'en'},
      cards: [
        {
          id: 1,
          name: 'Test',
          fullName: 'Test Card',
          simpleName: 'test',
          cost: 3,
          color: 'Amber',
          inkwell: true,
          type: 'Character',
        },
      ],
    };

    const cards = loadCardsFromJSON(data);

    expect(cards).toHaveLength(1);
    expect(cards[0].setCode).toBeUndefined();
  });

  it('should handle cards without abilities', () => {
    const data = {
      metadata: {formatVersion: '1.0', generatedOn: '2024-01-01', language: 'en'},
      cards: [
        {
          id: 1,
          name: 'Test',
          fullName: 'Test Card',
          simpleName: 'test',
          cost: 3,
          color: 'Amber',
          inkwell: true,
          type: 'Character',
        },
      ],
    };

    const cards = loadCardsFromJSON(data);

    expect(cards).toHaveLength(1);
    expect(cards[0].keywords).toBeUndefined();
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
    const mockData = {
      metadata: {formatVersion: '1.0', generatedOn: '2024-01-01', language: 'en'},
      cards: [
        {
          id: 1,
          name: 'Test',
          fullName: 'Test Card',
          simpleName: 'test',
          cost: 3,
          color: 'Amber',
          inkwell: true,
          type: 'Character',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await fetchCardsFromLocal('/data/test.json');

    expect(mockFetch).toHaveBeenCalledWith('/data/test.json');
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].name).toBe('Test');
    expect(result.sets).toEqual([]);
  });

  it('should throw error when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(fetchCardsFromLocal('/data/missing.json')).rejects.toThrow(
      'Failed to fetch local cards: 404',
    );
  });

  it('should throw error when JSON parsing fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new Error('Invalid JSON')),
    });

    await expect(fetchCardsFromLocal('/data/invalid.json')).rejects.toThrow(
      'Failed to parse card data: Invalid JSON',
    );
  });

  it('should handle non-Error parse failures', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject('Something went wrong'),
    });

    await expect(fetchCardsFromLocal('/data/invalid.json')).rejects.toThrow(
      'Failed to parse card data: Invalid JSON',
    );
  });
});

describe('Card Filtering - Additional Cases', () => {
  const cards: LorcanaCard[] = [
    createCard({
      id: '1',
      name: 'Elsa',
      fullName: 'Elsa - Snow Queen',
      text: 'When played, draw a card',
    }),
    createCard({
      id: '2',
      name: 'Anna',
      fullName: 'Anna - Heir to Arendelle',
      text: 'Gains +1 strength',
    }),
    createCard({
      id: '3',
      name: 'Mickey',
      fullName: 'Mickey Mouse - Leader',
      text: undefined,
    }),
  ];

  it('should filter by text search matching card text', () => {
    const results = filterCards(cards, {textSearch: 'draw'});
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });

  it('should filter by text search matching fullName', () => {
    const results = filterCards(cards, {textSearch: 'Mouse'});
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('3');
  });

  it("should exclude cards without text when text search doesn't match name", () => {
    const results = filterCards(cards, {textSearch: 'ability'});
    expect(results).toHaveLength(0);
  });

  it('should return empty when filtering keywords on cards without keywords', () => {
    const cardsWithoutKeywords: LorcanaCard[] = [createCard({id: '1', keywords: undefined})];
    const results = filterCards(cardsWithoutKeywords, {keywords: ['Evasive']});
    expect(results).toHaveLength(0);
  });

  it('should return empty when filtering classifications on cards without classifications', () => {
    const cardsWithoutClassifications: LorcanaCard[] = [
      createCard({id: '1', classifications: undefined}),
    ];
    const results = filterCards(cardsWithoutClassifications, {classifications: ['Princess']});
    expect(results).toHaveLength(0);
  });

  it('should filter by multiple types', () => {
    const mixedCards: LorcanaCard[] = [
      createCard({id: '1', type: 'Character'}),
      createCard({id: '2', type: 'Action'}),
      createCard({id: '3', type: 'Item'}),
    ];
    const results = filterCards(mixedCards, {type: ['Character', 'Action']});
    expect(results).toHaveLength(2);
  });
});
