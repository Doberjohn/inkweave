import fs from 'node:fs';
import {describe, it, expect} from 'vitest';
import {
  applyCardRules,
  buildPreviewToCanonicalMap,
  droppedVariants,
  featuredEntriesFor,
  featuredIdsJson,
  featuresGraduatingSet,
  previewVariantsMissingFrom,
  remapMigrationName,
  remapMigrationSql,
  unmappedPreviewCards,
} from './graduate-canonical-set.mjs';

const FEATURED_FILE = fs.readFileSync(
  new URL('../apps/web/src/features/cards/featuredCardIds.json', import.meta.url),
  'utf8',
);

const IMAGES = {full: 'full.jpg', thumbnail: 'thumb.jpg', foilMask: 'mask.jpg'};

/** A per-set LorcanaJSON file's cards: set info lives at the top level, not per card. */
const source = [
  {
    id: 3288,
    number: 23,
    fullName: 'Mickey Mouse - Best in Town',
    rarity: 'Super Rare',
    color: 'Amber',
    story: 'Mickey Mouse & Friends',
    images: IMAGES,
    artists: ['X'],
  },
  {
    id: 3506,
    baseId: 3288,
    number: 241,
    fullName: 'Mickey Mouse - Best in Town',
    rarity: 'Iconic',
    images: IMAGES,
  },
  {
    id: 3589,
    number: 13,
    fullName: 'Héctor Rivera - Gone to Pieces',
    rarity: 'Special',
    images: IMAGES,
  },
];

describe('applyCardRules (graduation)', () => {
  it('folds Epic/Enchanted/Iconic printings into their stripped base card (Rule 1)', () => {
    const {cards} = applyCardRules(source, '14');

    expect(cards).toHaveLength(1);
    expect(cards[0].variants).toEqual([
      {id: 3506, rarity: 'Iconic', number: 241, images: {full: 'full.jpg', thumbnail: 'thumb.jpg'}},
    ]);
  });

  it('still strips Special promos and per-card metadata', () => {
    const {cards, specialCount} = applyCardRules(source, '14');

    expect(specialCount).toBe(1);
    expect(cards[0]).not.toHaveProperty('artists');
    expect(cards[0].setCode).toBe('14');
  });

  it("keeps the card's story as its franchise, the field /reveals tiers by (Rule 4)", () => {
    const {cards} = applyCardRules(source, '14');

    expect(cards[0].franchise).toBe('Mickey Mouse & Friends');
    expect(cards[0]).not.toHaveProperty('story');
  });
});

const preview = (setCode, variants) => [
  {id: 14023, setCode, fullName: 'Mickey Mouse - Best in Town', variants},
];
const iconic = (number) => ({id: 14000 + number, rarity: 'Iconic', number});

// Hand-scanned reveal-season variants live only in previewCards.json, which graduation empties.
describe('previewVariantsMissingFrom (graduation)', () => {
  it('names the preview variants the canonical source lacks, matching on rarity and number', () => {
    const {cards} = applyCardRules(source, '14');

    const missing = previewVariantsMissingFrom(
      preview('14', [iconic(241), iconic(242)]),
      cards,
      '14',
    );

    expect(missing.map((v) => v.number)).toEqual([242]);
    expect(missing[0].base).toBe('Mickey Mouse - Best in Town');
  });

  it("ignores other sets' preview cards", () => {
    const {cards} = applyCardRules(source, '14');

    expect(previewVariantsMissingFrom(preview('13', [iconic(242)]), cards, '14')).toEqual([]);
  });
});

// Everything graduation would drop stops the run unless --allow-missing-variants is passed.
describe('droppedVariants (graduation)', () => {
  it('lists a canonical printing with no base card alongside the preview-only ones', () => {
    const orphan = {
      id: 3600,
      baseId: 9999,
      number: 230,
      fullName: 'Nobody - Anywhere',
      rarity: 'Epic',
      images: IMAGES,
    };
    const rules = applyCardRules([...source, orphan], '14');

    const dropped = droppedVariants(preview('14', [iconic(241), iconic(242)]), rules, '14');

    expect(dropped.map((v) => `${v.rarity} #${v.number} ${v.base}`)).toEqual([
      'Epic #230 Nobody - Anywhere',
      'Iconic #242 Mickey Mouse - Best in Town',
    ]);
  });
});

// Graduation renumbers cards, and votes, collections and decks follow them through this map (#748).
describe('buildPreviewToCanonicalMap (graduation)', () => {
  const canonical = [
    {id: 3230, number: 1, fullName: 'Ariel - Spectacular Singer'},
    {id: 3260, number: 31, fullName: 'Goofy - Super Goof'},
  ];

  it('joins preview ids to canonical ids on the collector number, whatever the name', () => {
    const previewCards = [
      {id: 14001, setCode: '14', number: 1, fullName: 'Ariel - Spectacular Songstress'},
    ];

    expect(buildPreviewToCanonicalMap(previewCards, canonical, '14')).toEqual(
      new Map([['14001', '3230']]),
    );
  });

  it('places a card revealed without a number by its full name, and reports what neither places', () => {
    const previewCards = [
      {id: 14900, setCode: '14', fullName: 'Goofy - Super Goof'},
      {id: 14901, setCode: '14', fullName: 'Nobody - Anywhere'},
    ];

    const map = buildPreviewToCanonicalMap(previewCards, canonical, '14');

    expect(map).toEqual(new Map([['14900', '3260']]));
    expect(unmappedPreviewCards(previewCards, map, '14').map((c) => c.id)).toEqual([14901]);
  });

  it("skips other sets' preview cards, whose numbers would match the wrong cards", () => {
    const previewCards = [{id: 15001, setCode: '15', number: 1, fullName: 'Someone - New'}];

    expect(buildPreviewToCanonicalMap(previewCards, canonical, '14').size).toBe(0);
  });
});

describe('remap migration (graduation)', () => {
  it('calls remap_card_ids with the whole map and labels the run by set', () => {
    const sql = remapMigrationSql(
      '14',
      new Map([
        ['14001', '3230'],
        ['14031', '3260'],
      ]),
    );

    const [, json, label] = sql.match(
      /select internal\.remap_card_ids\('([^']*)'::jsonb, '([^']*)'\);/,
    );
    expect(JSON.parse(json)).toEqual({14001: '3230', 14031: '3260'});
    expect(label).toBe('set 14 graduation');
  });

  it('is named with the UTC time it was written, like every migration', () => {
    expect(remapMigrationName('Q1', new Date('2026-10-20T08:05:09.123Z'))).toBe(
      '20261020080509_remap_setq1_preview_ids.sql',
    );
  });
});

describe('featured cards (graduation)', () => {
  const setCards = [
    {id: 3201, number: 7, color: 'Amber-Emerald', fullName: 'Ariel - Spectacular Singer'},
    {id: 3224, number: 30, color: 'Amethyst', fullName: 'Merlin - Shapeshifter'},
    {id: 3255, number: 61, color: 'Emerald', fullName: 'Robin Hood - Archery Contestant'},
    {id: 3289, number: 95, color: 'Ruby', fullName: 'Mulan - Elite Archer'},
    {id: 3324, number: 130, color: 'Sapphire', fullName: 'Belle - Inventive Engineer'},
    {id: 3364, number: 170, color: 'Steel', fullName: 'Hercules - Hero in Training'},
  ];

  it("asks only when the featured list holds none of the graduating set's cards", () => {
    const featured = (...ids) => ids.map((id) => ({id}));
    const previews = new Map([['14007', '3201']]);
    // A rerun: the first run emptied previewCards.json and left canonical ids in the list.
    const rerun = new Map();

    expect(featuresGraduatingSet(featured('14007', '2999'), setCards, previews)).toBe(true);
    expect(featuresGraduatingSet(featured('3224', '2999'), setCards, rerun)).toBe(true);
    expect(featuresGraduatingSet(featured('2999', '3022'), setCards, previews)).toBe(false);
  });

  // Amber comes only from card 7, Amber-Emerald: a dual-ink card counts for both its inks.
  it('turns six collector numbers into entries, in the order given', () => {
    const {entries} = featuredEntriesFor('30, 7 61,95 130 0170', setCards);
    const ids = entries.map((entry) => entry.id);

    expect(ids).toEqual(['3224', '3201', '3255', '3289', '3324', '3364']);
    expect(entries[1]).toEqual({id: '3201', card: 'Amber-Emerald: Ariel - Spectacular Singer'});
  });

  it("turns down an answer that isn't six different numbers from the set", () => {
    expect(featuredEntriesFor('7 30 61 95 130', setCards).error).toMatch(/6 different/);
    expect(featuredEntriesFor('7 7 61 95 130 170', setCards).error).toMatch(/6 different/);
    expect(featuredEntriesFor('7 30 61 95 130 999', setCards).error).toBe(
      'this set has no card numbered 999',
    );
  });

  it('turns down six cards that leave an ink out', () => {
    const secondRuby = {id: 3290, number: 96, color: 'Ruby', fullName: 'Mulan - Reflecting'};

    expect(featuredEntriesFor('7 30 61 95 96 170', [...setCards, secondRuby]).error).toBe(
      'pick one card of each ink (none is Sapphire)',
    );
  });

  it('writes featuredCardIds.json in the format the file is kept in', () => {
    expect(featuredIdsJson(JSON.parse(FEATURED_FILE))).toBe(FEATURED_FILE);
  });
});
