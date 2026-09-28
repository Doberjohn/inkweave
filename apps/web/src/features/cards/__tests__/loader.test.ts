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
      cost: 3,
      color: 'Amber',
      inkwell: true,
      type: 'Character',
      // Default to a Core-legal set so fetchCardsFromLocal's MIN_CORE_SET filter
      // keeps these fixtures (override per-test to exercise the filter).
      setCode: '9',
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
    createCard({id: '5', name: "Bruno's Return", fullName: "Bruno's Return"}),
    createCard({id: '6', name: 'Curly’s Card', fullName: 'Curly’s Card'}),
  ];

  it.each([
    ['name (case insensitive)', 'elsa', 2],
    ['fullName', 'Snow Queen', 1],
    ['version', 'Ice Maker', 1],
    ['no match', 'Donald', 0],
    ['a typographic apostrophe against a straight name', 'bruno’s', 1],
    ['a straight apostrophe against a typographic name', "curly's", 1],
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

  it('should match text search across apostrophe styles', () => {
    const textCards = [
      createCard({
        id: '1',
        fullName: 'Warded',
        text: 'Opponents can’t choose this character except to challenge.',
      }),
    ];
    expect(filterCards(textCards, {textSearch: "can't choose"})).toHaveLength(1);
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

  describe('Keyword normalization', () => {
    it('collapses every Shift variant to a single "Shift" option', () => {
      const shiftCards = [
        createCard({id: 's1', keywords: ['Floodborn Shift 7']}),
        createCard({id: 's2', keywords: ['Puppy Shift 3']}),
        createCard({id: 's3', keywords: ['Combo Shift 4']}),
        createCard({id: 's4', keywords: ['Temporary Shift 3']}),
        createCard({id: 's5', keywords: ['Shift 5']}),
        createCard({id: 's6', keywords: ['Shift Remove 2 ink drops']}),
      ];
      // The classification/team prefixes must NOT leak as bogus keyword options:
      // "Floodborn" is a classification, findable via the Classification filter.
      expect(getUniqueKeywords(shiftCards)).toEqual(['Shift']);
    });

    it('keeps the two-word "Sing Together" keyword intact (not "Sing")', () => {
      const keywords = getUniqueKeywords([createCard({id: 'st', keywords: ['Sing Together 8']})]);
      expect(keywords).toContain('Sing Together');
      expect(keywords).not.toContain('Sing');
    });

    it('drops non-keyword noise from mis-tagged source abilities', () => {
      const keywords = getUniqueKeywords([
        createCard({id: 'n', keywords: ['THIS', 'gain', 'if', 'Bodyguard']}),
      ]);
      expect(keywords).toEqual(['Bodyguard']);
    });

    it('offers Adventurous (new in Set 14) as a filter option', () => {
      const keywords = getUniqueKeywords([createCard({id: 'adv', keywords: ['Adventurous']})]);
      expect(keywords).toEqual(['Adventurous']);
    });
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

  // Every canonical card carries a remote thumbnail, so a card without one is a
  // hand-built reveal card whose only art is its locally converted AVIF. Keyed on
  // the missing thumbnail, not the set code, so it needs no per-season edit.
  it('should fall back to the local preview AVIF when a card has no remote thumbnail', () => {
    const cards = loadCardsFromJSON(makeJsonData({id: 14050}));
    expect(cards[0].imageUrl).toBe('/card-images-preview/14050.avif');
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
    // Override the makeJsonData Core-set default back to undefined for this case.
    const cards = loadCardsFromJSON(makeJsonData({setCode: undefined}));
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

  it('should fetch and parse cards from local JSON (single file, legacy path)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeJsonData({})),
      })
      .mockResolvedValueOnce({ok: false, status: 404});

    const result = await fetchCardsFromLocal('/data/test.json');
    expect(mockFetch).toHaveBeenCalledWith('/data/test.json');
    expect(result.cards).toHaveLength(1);
    expect(result.sets).toEqual([]);
  });

  it('should throw error when primary fetch fails', async () => {
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

  it('should merge previewCards.json when present', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(makeJsonData({id: 1, name: 'MainCard', fullName: 'Main Card'})),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(makeJsonData({id: 2, name: 'PreviewCard', fullName: 'Preview Card'})),
      });

    const result = await fetchCardsFromLocal();

    expect(mockFetch).toHaveBeenCalledWith('/data/allCards.json');
    expect(mockFetch).toHaveBeenCalledWith('/data/previewCards.json');
    expect(result.cards).toHaveLength(2);
    expect(result.cards.map((c) => c.fullName).sort()).toEqual(['Main Card', 'Preview Card']);
  });

  it('should gracefully handle missing previewCards.json (404)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeJsonData({id: 1, name: 'Only', fullName: 'Only Card'})),
      })
      .mockResolvedValueOnce({ok: false, status: 404});

    const result = await fetchCardsFromLocal();

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].fullName).toBe('Only Card');
  });

  it('should handle empty previewCards.json cards array', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeJsonData({id: 1, name: 'Main', fullName: 'Main Card'})),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            metadata: {formatVersion: '1.0', generatedOn: '2026-04-17', language: 'en'},
            sets: {},
            cards: [],
          }),
      });

    const result = await fetchCardsFromLocal();
    expect(result.cards).toHaveLength(1);
  });

  it('should dedupe by card id (allCards.json wins)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(makeJsonData({id: 1, name: 'Canonical', fullName: 'Canonical Card'})),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(makeJsonData({id: 1, name: 'Preview', fullName: 'Stale Preview'})),
      });

    const result = await fetchCardsFromLocal();
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].fullName).toBe('Canonical Card');
  });

  it('should drop cards from sets below the Core rotation floor (MIN_CORE_SET)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(
            makeJsonData(
              {id: 1, name: 'Core', fullName: 'Core Card', setCode: '9'},
              {id: 2, name: 'Rotated', fullName: 'Rotated Card', setCode: '5'},
            ),
          ),
      })
      .mockResolvedValueOnce({ok: false, status: 404});

    const result = await fetchCardsFromLocal();
    expect(result.cards.map((c) => c.fullName)).toEqual(['Core Card']);
  });

  it('should merge sets from both files', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            metadata: {formatVersion: '1.0', generatedOn: '2026-04-17', language: 'en'},
            sets: {'11': {name: 'Reign of Jafar', number: 11, type: 'expansion'}},
            cards: [],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            metadata: {formatVersion: '1.0', generatedOn: '2026-04-17', language: 'en'},
            sets: {'12': {name: 'The Wilds Unknown', number: 12, type: 'expansion'}},
            cards: makeJsonData({id: 12001, setCode: '12'}).cards,
          }),
      });

    const result = await fetchCardsFromLocal();
    expect(result.sets.map((s) => s.code).sort()).toEqual(['11', '12']);
  });

  // A reveal season declares its set (with dates) before the first card lands. The
  // set list feeds the Set filter for every user, whatever the reveal flag says.
  it('should not offer a preview set that has no cards yet', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...makeJsonData({id: 1, setCode: '11'}),
            sets: {'11': {name: 'Winterspell', number: 11, type: 'expansion'}},
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            metadata: {formatVersion: '1.0', generatedOn: '2026-09-21', language: 'en'},
            sets: {'14': {name: 'Hyperia City', number: 14, type: 'expansion'}},
            cards: [],
          }),
      });

    const result = await fetchCardsFromLocal();
    expect(result.sets.map((s) => s.code)).toEqual(['11']);
  });
});

describe('smallImageUrl', () => {
  // Dev/CI mode (USE_LOCAL_IMAGES=false): falls back to .avif → -sm.avif string
  // transform on card.imageUrl. Production-mode hashed-URL behavior is covered
  // by the prod-build smoke test in CI (verifying Network tab + curl results).
  it.each([
    ['/card-images/123.avif', '/card-images/123-sm.avif'],
    ['/card-images/elsa.jpg', '/card-images/elsa.jpg'],
    ['/card-images/123', '/card-images/123'],
    [undefined, undefined],
  ])('dev fallback: imageUrl %s → %s', (imageUrl, expected) => {
    expect(smallImageUrl({id: '123', imageUrl})).toBe(expected);
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
