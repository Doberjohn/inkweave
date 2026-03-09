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

  it('should match dual-ink cards on either ink', () => {
    const dualInkCards = [
      ...cards,
      createCard({id: 'dual-1', ink: 'Amethyst', ink2: 'Sapphire', cost: 5}),
    ];
    // Should match on secondary ink
    const bySapphire = filterCards(dualInkCards, {ink: 'Sapphire'});
    expect(bySapphire.some((c) => c.id === 'dual-1')).toBe(true);
    // Should match on primary ink
    const byAmethyst = filterCards(dualInkCards, {ink: 'Amethyst'});
    expect(byAmethyst.some((c) => c.id === 'dual-1')).toBe(true);
    // Should NOT match on unrelated ink
    const byRuby = filterCards(dualInkCards, {ink: 'Ruby'});
    expect(byRuby.some((c) => c.id === 'dual-1')).toBe(false);
  });

  it('should filter by card type', () => {
    const results = filterCards(cards, {type: 'Character'});
    expect(results).toHaveLength(4);
    expect(results.every((c) => c.type === 'Character')).toBe(true);
  });

  it('should filter by discrete costs', () => {
    const results = filterCards(cards, {costs: [3, 4, 5]});
    expect(results).toHaveLength(3);
    expect(results.every((c) => [3, 4, 5].includes(c.cost))).toBe(true);
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

  it('should treat cost 9 as 9+ bucket (matching cost 9, 10, 12)', () => {
    const highCostCards = [
      createCard({id: '1', cost: 9}),
      createCard({id: '2', cost: 10}),
      createCard({id: '3', cost: 12}),
      createCard({id: '4', cost: 8}),
    ];
    const results = filterCards(highCostCards, {costs: [9]});
    expect(results).toHaveLength(3);
    expect(results.map((c) => c.id)).toEqual(['1', '2', '3']);
  });

  it('should combine multiple filters', () => {
    const results = filterCards(cards, {ink: 'Amber', costs: [6]});
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
          images: {thumbnail: 'https://example.com/elsa.jpg'},
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

  it('should preserve both inks for dual-ink cards', () => {
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
    expect(cards[0].ink2).toBe('Sapphire');
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

  it('should load all cards from pre-deduplicated data', () => {
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
          setCode: '5',
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
          setCode: '6',
        },
      ],
    };

    const cards = loadCardsFromJSON(data);
    expect(cards).toHaveLength(2);
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

  it('should populate textSections from fullTextSections', () => {
    const data = {
      metadata: {formatVersion: '1.0', generatedOn: '2024-01-01', language: 'en'},
      cards: [
        {
          id: 1,
          name: 'Cinderella',
          fullName: 'Cinderella - Gentle and Kind',
          simpleName: 'cinderella',
          cost: 5,
          color: 'Sapphire',
          inkwell: true,
          type: 'Character',
          fullText: 'Singer 5 (reminder)\nA WONDERFUL DREAM — effect',
          fullTextSections: ['Singer 5 (reminder)', 'A WONDERFUL DREAM — effect'],
        },
      ],
    };

    const cards = loadCardsFromJSON(data);

    expect(cards[0].textSections).toEqual(['Singer 5 (reminder)', 'A WONDERFUL DREAM — effect']);
  });

  it('should filter empty/whitespace entries from fullTextSections', () => {
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
          fullText: 'Ability one\nAbility two',
          fullTextSections: ['Ability one', '', '  ', 'Ability two'],
        },
      ],
    };

    const cards = loadCardsFromJSON(data);

    expect(cards[0].textSections).toEqual(['Ability one', 'Ability two']);
  });

  it('should set textSections to undefined when all entries are empty', () => {
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
          fullText: 'Some text',
          fullTextSections: ['', '  '],
        },
      ],
    };

    const cards = loadCardsFromJSON(data);

    expect(cards[0].textSections).toBeUndefined();
  });

  it('should omit textSections when fullTextSections is absent', () => {
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
          fullText: 'Some text',
        },
      ],
    };

    const cards = loadCardsFromJSON(data);

    expect(cards[0].textSections).toBeUndefined();
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

  it('should extract conditional Shift from ability effect text', () => {
    const data = {
      metadata: {formatVersion: '1.0', generatedOn: '2024-01-01', language: 'en'},
      cards: [
        {
          id: 100,
          name: 'Anna',
          version: 'Soothing Sister',
          fullName: 'Anna - Soothing Sister',
          simpleName: 'anna',
          cost: 5,
          color: 'Amber',
          inkwell: true,
          type: 'Character',
          abilities: [
            {
              type: 'static',
              name: 'UNUSUAL TRANSFORMATION',
              effect: "If a card left a player's discard this turn, this card gains Shift 0.",
              fullText:
                "UNUSUAL TRANSFORMATION If a card left a player's discard this turn, this card gains Shift 0.",
            },
          ],
          setCode: '9',
        },
      ],
    };

    const cards = loadCardsFromJSON(data);

    expect(cards).toHaveLength(1);
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
    const results = filterCards(cards, {type: ['Action', 'Song']});
    expect(results).toHaveLength(3);
    expect(results.every((c) => c.type === 'Action')).toBe(true);
  });

  it('should combine Song with other types', () => {
    const results = filterCards(cards, {type: ['Character', 'Song']});
    expect(results).toHaveLength(3);
  });
});

describe('smallImageUrl', () => {
  it('should insert -sm before the .avif extension', () => {
    expect(smallImageUrl('/card-images/123.avif')).toBe('/card-images/123-sm.avif');
  });

  it('should return non-AVIF URLs unchanged (dev proxy)', () => {
    expect(smallImageUrl('/card-images/elsa.jpg')).toBe('/card-images/elsa.jpg');
  });

  it('should return URL unchanged when there is no extension', () => {
    expect(smallImageUrl('/card-images/123')).toBe('/card-images/123');
  });

  it('should return undefined for undefined input', () => {
    expect(smallImageUrl(undefined)).toBeUndefined();
  });
});
