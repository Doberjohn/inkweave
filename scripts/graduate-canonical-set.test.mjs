import {describe, it, expect} from 'vitest';
import {finishesById} from './lib/finishes.mjs';
import {
  applyCardRules,
  buildPreviewToCanonicalMap,
  droppedVariants,
  featuredEntriesFor,
  featuresGraduatingSet,
  graduatedFinishes,
  previewVariantsMissingFrom,
  remapMigrationName,
  remapMigrationSql,
  replaceSetCards,
  unmappedPreviewCards,
} from './graduate-canonical-set.mjs';

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

  it("folds a printing that keeps its base card's rarity instead of keeping it as a card (#796)", () => {
    const sameRarity = {
      id: 3600,
      baseId: 3288,
      number: 243,
      fullName: 'Mickey Mouse - Best in Town',
      rarity: 'Super Rare',
      images: IMAGES,
    };
    const {cards} = applyCardRules([...source, sameRarity], '14');

    expect(cards.map((c) => c.id)).toEqual([3288]);
    expect(cards[0].variants.map((v) => v.id)).toEqual([3506, 3600]);
  });

  it('never keeps an Epic, Enchanted or Iconic as a card, even one that has lost its baseId', () => {
    const unlinked = {id: 3601, number: 223, fullName: 'Mickey Mouse - Best in Town', rarity: 'Enchanted', images: IMAGES};
    const {cards, fold} = applyCardRules([...source, unlinked], '14');

    expect(cards.map((c) => c.id)).toEqual([3288]);
    expect(fold.unmatched).toEqual([unlinked]);
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

  describe('versions (Rule 5, #880)', () => {
    const [base, iconic, special] = source;
    /** The source with `foilTypes` on the card and its Iconic, as LorcanaJSON lists them. */
    const listing = (baseTypes, iconicTypes) => [
      {...base, foilTypes: baseTypes},
      {...iconic, foilTypes: iconicTypes},
      {...special, foilTypes: ['Cold']},
    ];
    const lastKey = (entry) => Object.keys(entry).at(-1);

    it("keeps foilTypes' versions as finishes where the rarity's are wrong, each entry's last key", () => {
      const {cards} = applyCardRules(listing(['None'], ['None', 'Cold']), '14');

      expect(cards[0].finishes).toEqual(['normal']);
      expect(lastKey(cards[0])).toBe('finishes');
      expect(cards[0]).not.toHaveProperty('foilTypes');
      expect(cards[0].variants[0].finishes).toEqual(['normal', 'foil']);
      expect(lastKey(cards[0].variants[0])).toBe('finishes');
    });

    it('writes none where they match the rarity rule: a Super Rare in both, an Iconic in foil', () => {
      const {cards} = applyCardRules(listing(['None', 'Cold'], ['Cold']), '14');

      expect(cards[0]).not.toHaveProperty('finishes');
      expect(cards[0].variants[0]).not.toHaveProperty('finishes');
    });

    it("keeps the versions the set's entries hold, whatever LorcanaJSON lists now", () => {
      // An owner's correction: the Iconic in both, where LorcanaJSON lists the foil one alone.
      const old = [{id: 3288, variants: [{id: 3506, finishes: ['normal', 'foil']}]}];
      const {cards} = applyCardRules(listing(['None', 'Cold'], ['Cold']), '14', finishesById(old));

      expect(cards[0].variants[0].finishes).toEqual(['normal', 'foil']);
    });

    it('lists the versions it gave, leaving the Specials out, and a rerun gives none and changes nothing', () => {
      const first = applyCardRules(listing(['None'], ['None', 'Cold']), '14');

      expect(graduatedFinishes(new Map(), first.cards)).toEqual([
        {label: '3288 #23 Super Rare Mickey Mouse - Best in Town', finishes: ['normal']},
        {label: '3506 #241 Iconic Mickey Mouse - Best in Town', finishes: ['normal', 'foil']},
      ]);
      const kept = finishesById(first.cards);
      const rerun = applyCardRules(listing(['None'], ['None', 'Cold']), '14', kept);
      expect(graduatedFinishes(kept, rerun.cards)).toEqual([]);
      expect(JSON.stringify(rerun.cards, null, 2)).toBe(JSON.stringify(first.cards, null, 2));
    });
  });
});

// Re-graduating a set replaces its cards wholesale; only the promo catalog writes promos (#805).
describe('replaceSetCards (graduation)', () => {
  const promo = {id: 3700, rarity: 'Special', number: 4, promoGrouping: 'D23'};
  const catalog = (baseId) => ({fold: [{baseId, fullName: 'Mickey Mouse - Best in Town', variants: [promo]}]});
  const oldCard = {id: 3288, setCode: '14', fullName: 'Mickey Mouse - Best in Town', variants: [promo]};
  const otherSet = {id: 1949, setCode: '9', fullName: 'Mickey Mouse - True Friend'};

  it("puts the catalog's promo printings on the new cards, after their own printings", () => {
    const {cards} = applyCardRules(source, '14');
    const all = {cards: [otherSet, oldCard]};

    const {dropped} = replaceSetCards(all, '14', cards, catalog(3288));
    expect(dropped).toEqual([oldCard]);
    expect(all.cards.map((card) => card.id)).toEqual([1949, 3288]);
    expect(all.cards[1].variants.map((v) => v.id)).toEqual([3506, 3700]);
  });

  it('throws, changing nothing, when the catalog names a card the new set lacks', () => {
    const {cards} = applyCardRules(source, '14');
    const all = {cards: [otherSet, oldCard]};

    expect(() => replaceSetCards(all, '14', cards, catalog(3299))).toThrow(/no card 3299/);
    expect(all.cards).toEqual([otherSet, oldCard]);
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
      'pick cards that carry every ink between them (no card is Sapphire)',
    );
  });
});
