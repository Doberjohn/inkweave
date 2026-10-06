import {describe, it, expect} from 'vitest';
import {
  DETAIL_FIELDS,
  INDEX_FIELDS,
  buildDetailChunks,
  buildIndex,
  chunkFilename,
  selectCollectionCards,
} from '../collectionData.mjs';

const CDN = 'https://api.lorcana.ravensburger.com/images/en/set1';

function card(over = {}) {
  return {
    id: 1,
    name: 'Ariel',
    version: 'On Human Legs',
    fullName: 'Ariel - On Human Legs',
    cost: 4,
    color: 'Amber',
    inkwell: true,
    type: 'Character',
    subtypes: ['Princess'],
    strength: 3,
    willpower: 4,
    lore: 2,
    fullText: 'Some text.',
    fullTextSections: ['Some text.'],
    abilities: [{fullText: 'Some text.', type: 'static'}],
    images: {foilMask: `${CDN}/x.jpg`, full: `${CDN}/f.jpg`, thumbnail: `${CDN}/t.jpg`},
    setCode: '1',
    number: 1,
    rarity: 'Uncommon',
    artists: ['Someone'],
    flavorText: 'Flavour.',
    ...over,
  };
}

describe('selectCollectionCards', () => {
  it('keeps only cards absent from the excluded sets', () => {
    const kept = selectCollectionCards([card({id: 1}), card({id: 2}), card({id: 3})], [new Set(['2'])]);
    expect(kept.map((c) => c.id)).toEqual([1, 3]);
  });

  it('excludes ids from EVERY set given, not just the first', () => {
    // allCards.json AND previewCards.json: a preview card is merged into the Core
    // pool at runtime, so shipping it here too would show it twice.
    const kept = selectCollectionCards([card({id: 1}), card({id: 2})], [new Set(['1']), new Set(['2'])]);
    expect(kept).toEqual([]);
  });

  it('compares ids as strings, so numeric and string ids cannot slip past', () => {
    expect(selectCollectionCards([card({id: 7})], [new Set([7])])).toEqual([]);
  });
});

// Many of these fields are legitimately absent on many cards — `baseId` only on
// alternate printings, `moveCost` only on Locations, `strength` only on
// characters. So the completeness checks assert the actual contract: a field the
// INPUT carries survives into the output. Asserting unconditional presence would
// be testing the fixture, not the code.
const carriedFrom = (input, fields) => fields.filter((f) => input[f] !== undefined);

describe('buildIndex', () => {
  const [entry] = buildIndex([card()]);

  /*
    Also an independent list, for the same reason as TRANSFORMER_READS below: these are
    the fields the grid, the filter controls and name search read, named here rather than
    taken from INDEX_FIELDS, so dropping one from the projection fails a test instead of
    quietly narrowing the expectation.
  */
  const GRID_NEEDS = [
    'id', 'name', 'fullName', 'cost', 'color', 'inkwell', 'type', 'subtypes', 'setCode',
    'number', 'rarity',
  ];

  it('projects what the grid and filters need', () => {
    expect(INDEX_FIELDS).toEqual(expect.arrayContaining(GRID_NEEDS));
  });

  it('carries those fields through into a real index entry', () => {
    for (const field of carriedFrom(card(), GRID_NEEDS)) expect(entry).toHaveProperty(field);
  });

  it('carries baseId when the card is an alternate printing', () => {
    const [reprint] = buildIndex([card({baseId: 42})]);
    expect(reprint.baseId).toBe(42);
  });

  it('omits image URLs — the per-set detail chunk carries those', () => {
    expect(entry.images).toBeUndefined();
  });

  it('omits the heavy fields: card text, stats and abilities', () => {
    expect(entry.fullText).toBeUndefined();
    expect(entry.abilities).toBeUndefined();
    expect(entry.strength).toBeUndefined();
  });

  it('drops upstream fields nothing renders', () => {
    expect(entry.artists).toBeUndefined();
    expect(entry.flavorText).toBeUndefined();
  });

  it('omits absent optional fields rather than writing nulls', () => {
    const [minimal] = buildIndex([card({version: undefined, subtypes: undefined})]);
    expect('version' in minimal).toBe(false);
    expect('subtypes' in minimal).toBe(false);
  });
});

describe('buildDetailChunks', () => {
  const chunks = buildDetailChunks([card({id: 1, setCode: '1'}), card({id: 2, setCode: '1'}), card({id: 3, setCode: 'Q1'})]);

  it('groups by set', () => {
    expect(new Set(chunks.keys())).toEqual(new Set(['1', 'Q1']));
    expect(chunks.get('1')).toHaveLength(2);
  });

  /*
    AN INDEPENDENT LIST, not derived from DETAIL_FIELDS. Checking the projection against
    the same constant that drives it proves only that the code agrees with itself: delete
    a transformer-required field from DETAIL_FIELDS and the expectation shrinks with it,
    so the test stays green while collection cards render incomplete.

    These names come from reading `transformCard` in
    packages/synergy-engine/src/utils/cardTransformer.ts and listing every `raw.*` it
    touches. When that function gains a field, this list fails first and DETAIL_FIELDS
    must follow.

    `franchise` is deliberately absent: `transformCard` reads it, but it is set only on
    preview cards, and the collection dataset holds historical sets that never carry one.
  */
  const TRANSFORMER_READS = [
    'color', 'cost', 'fullName', 'fullText', 'fullTextSections', 'id', 'inkwell', 'lore',
    'moveCost', 'name', 'number', 'rarity', 'setCode', 'strength', 'subtypes', 'type',
    'version', 'willpower',
  ];

  it('projects every field the engine transformer reads', () => {
    expect(DETAIL_FIELDS).toEqual(expect.arrayContaining(TRANSFORMER_READS));
  });

  it('carries those fields through into a real chunk entry', () => {
    const [detail] = chunks.get('1');
    for (const field of carriedFrom(card(), TRANSFORMER_READS)) expect(detail).toHaveProperty(field);
  });

  it('carries the optional fields too when the card has them', () => {
    const [location] = buildDetailChunks([card({moveCost: 2, baseId: 42})]).get('1');
    expect(location.moveCost).toBe(2);
    expect(location.baseId).toBe(42);
  });

  it('keeps thumbnail and full image URLs but drops foilMask', () => {
    const [detail] = chunks.get('1');
    expect(detail.images.thumbnail).toBeDefined();
    // `full` carries the upstream content hash Phase A's restore path reads.
    expect(detail.images.full).toBeDefined();
    expect(detail.images.foilMask).toBeUndefined();
  });

  it('still drops upstream fields nothing renders', () => {
    const [detail] = chunks.get('1');
    expect(detail.artists).toBeUndefined();
    expect(detail.flavorText).toBeUndefined();
  });
});

describe('chunkFilename', () => {
  it('names a chunk after its set', () => {
    expect(chunkFilename('1')).toBe('1.json');
    expect(chunkFilename('Q1')).toBe('Q1.json');
  });

  it('refuses a set code that would escape the output directory', () => {
    expect(() => chunkFilename('../secrets')).toThrow();
    expect(() => chunkFilename('a/b')).toThrow();
  });
});
