import fs from 'node:fs';
import {describe, it, expect} from 'vitest';
import {finishesById, isFinishes} from '../finishes.mjs';
import {collectionPromos, mergePromoPrintings, promoBaseProblems} from '../promo-printings.mjs';

const art = (path) => ({
  full: `https://api.lorcana.ravensburger.com/images/en/${path}_full.jpg`,
  thumbnail: `https://api.lorcana.ravensburger.com/images/en/${path}_thumb.jpg`,
});

/** Mickey Mouse - True Friend's four promos as the catalog lists them: two have no art yet. */
const P1 = {id: 80042, rarity: 'Special', number: 25, promoGrouping: 'P1'};
const P2 = {id: 80044, rarity: 'Special', number: 15, promoGrouping: 'P2'};
const P2_36 = {
  id: 3595,
  rarity: 'Special',
  number: 36,
  promoGrouping: 'P2',
  images: art('promo2/36'),
};
const P3 = {id: 2432, rarity: 'Special', number: 10, promoGrouping: 'P3', images: art('promo3/10')};

/** Mickey Mouse - True Friend as allCards.json stores it. */
const mickey = (variants) => ({
  id: 1949,
  fullName: 'Mickey Mouse - True Friend',
  setCode: '9',
  number: 13,
  ...(variants && {variants}),
});

const group = (variants, over = {}) => ({
  baseId: 1949,
  fullName: 'Mickey Mouse - True Friend',
  setCode: '9',
  number: 13,
  variants,
  ...over,
});

/** A catalog with `fold` groups, and one card allCards.json doesn't hold. */
const catalog = (...fold) => ({
  fold,
  noBaseCard: [
    {
      fullName: 'Ariel - Spectacular Singer',
      lorcanaJsonBaseId: 2,
      variants: [
        {id: 3237, rarity: 'Special', number: 1, promoGrouping: 'CC1', images: art('cc1/1')},
        {
          id: 3238,
          rarity: 'Special',
          number: 1,
          promoGrouping: 'CC2',
          artVariant: 'b',
          promoSource: 'x',
        },
      ],
    },
  ],
});

const ENCHANTED = {id: 2163, rarity: 'Enchanted', number: 221, images: art('set9/221')};

/** The message `fn` throws, or undefined when it throws nothing. */
function thrown(fn) {
  try {
    fn();
  } catch (error) {
    return error.message;
  }
  return undefined;
}

describe('mergePromoPrintings', () => {
  it("adds a card's promos after its other printings, by promo set and then number", () => {
    const cards = [mickey([ENCHANTED])];
    const {changes} = mergePromoPrintings(cards, catalog(group([P3, P2_36, P1, P2])));

    expect(cards[0].variants.map((v) => v.id)).toEqual([2163, 80042, 80044, 3595, 2432]);
    expect(changes).toHaveLength(1);
    expect(changes[0].added).toHaveLength(4);
  });

  it("keeps only a promo's printing fields and art, and leaves out a number nobody knows", () => {
    const minnie = {
      id: 2224,
      fullName: 'Minnie Mouse - Amethyst Champion',
      setCode: '10',
      number: 35,
    };
    const nonFoil = {
      id: 80016,
      rarity: 'Special',
      number: null,
      promoGrouping: 'C2',
      finish: 'normal',
      scanLanguage: 'ja',
      artVariant: 'b',
      promoSource: 'Gateway',
    };
    mergePromoPrintings(
      [minnie],
      catalog(group([nonFoil], {baseId: 2224, fullName: minnie.fullName})),
    );

    expect(minnie.variants).toEqual([
      {id: 80016, rarity: 'Special', promoGrouping: 'C2', finish: 'normal', scanLanguage: 'ja'},
    ]);
  });

  it('sorts a promo whose number is unknown after the numbered ones of its set', () => {
    const minnie = {
      id: 2224,
      fullName: 'Minnie Mouse - Amethyst Champion',
      setCode: '10',
      number: 35,
    };
    const nonFoil = {
      id: 80016,
      rarity: 'Special',
      number: null,
      promoGrouping: 'C2',
      finish: 'normal',
    };
    const foil = {id: 80015, rarity: 'Special', number: 20, promoGrouping: 'C2', finish: 'foil'};
    mergePromoPrintings(
      [minnie],
      catalog(group([nonFoil, foil], {baseId: 2224, fullName: minnie.fullName})),
    );

    expect(minnie.variants.map((v) => v.id)).toEqual([80015, 80016]);
  });

  it('replaces the entry with the same id when the catalog changed it', () => {
    const cards = [mickey([{id: 2432, rarity: 'Special', number: 10, promoGrouping: 'P3'}])];
    const {changes} = mergePromoPrintings(cards, catalog(group([P3])));

    expect(changes[0].updated).toHaveLength(1);
    expect(cards[0].variants).toEqual([P3]);
  });

  it('removes a promo the catalog no longer lists, and reports it', () => {
    const dropped = {id: 80099, rarity: 'Special', number: 9, promoGrouping: 'P9'};
    const cards = [mickey([dropped, P1])];
    const {changes} = mergePromoPrintings(cards, catalog(group([P1])));

    expect(cards[0].variants).toEqual([P1]);
    expect(changes[0].removed).toEqual([dropped]);
  });

  it('removes the promos of a card the catalog no longer has a group for', () => {
    const cards = [mickey([ENCHANTED, P1])];
    const {changes} = mergePromoPrintings(cards, catalog());

    expect(cards[0].variants).toEqual([ENCHANTED]);
    expect(changes[0].removed).toEqual([P1]);
  });

  it('leaves Epic, Enchanted, Iconic and alt foil entries as they were, ahead of the promos', () => {
    const others = [
      {id: 2200, rarity: 'Iconic', number: 240},
      ENCHANTED,
      {id: 2150, rarity: 'Epic', number: 213, images: art('set9/213')},
      {id: 3573, rarity: 'Super Rare', number: 247},
    ];
    const cards = [mickey([...others])];
    mergePromoPrintings(cards, catalog(group([P1])));

    expect(cards[0].variants.slice(0, 4)).toEqual(others);
    others.forEach((entry, i) => expect(cards[0].variants[i]).toBe(entry));
    expect(cards[0].variants[4]).toEqual(P1);
  });

  it('refuses a catalog it cannot merge, naming every problem and changing nothing', () => {
    const cards = [mickey([ENCHANTED]), {id: 2224, fullName: 'Minnie Mouse - Amethyst Champion'}];
    const bad = catalog(
      group([], {baseId: 2224, fullName: 'Minnie Mouse - Wide-Eyed Diver'}),
      group([], {baseId: 9999, fullName: 'Nobody - Anywhere'}),
      // 2163 is the Enchanted's id; 2432 is no promo at all.
      group([
        {...P1, id: 2163},
        {...P3, rarity: 'Enchanted'},
      ]),
    );
    const message = thrown(() => mergePromoPrintings(cards, bad));

    for (const marker of ['Wide-Eyed Diver', '9999', '2163', '2432'])
      expect(message).toContain(marker);
    expect(cards[0].variants).toEqual([ENCHANTED]);
    expect(cards[1]).not.toHaveProperty('variants');
  });

  it('changes nothing on a second run, keeping hashes a local image build injected', () => {
    const cards = [mickey([ENCHANTED])];
    mergePromoPrintings(cards, catalog(group([P1, P3])));
    Object.assign(cards[0].variants[2], {imageHash: 'h', imageHashSm: 'hs'});
    const before = structuredClone(cards);
    const {changes} = mergePromoPrintings(cards, catalog(group([P1, P3])));

    expect(cards).toEqual(before);
    expect(changes[0]).toMatchObject({added: [], updated: [], removed: []});
    expect(changes[0].unchanged).toHaveLength(2);
  });

  describe('versions (#880)', () => {
    it("copies the catalog's versions as each entry's last key, Both as admin writes it included", () => {
      const cards = [mickey()];
      mergePromoPrintings(cards, catalog(group([{...P1, finishes: ['normal']}, {...P3, finishes: ['normal', 'foil']}])));

      expect(cards[0].variants.map((v) => v.finishes)).toEqual([['normal'], ['normal', 'foil']]);
      expect(Object.keys(cards[0].variants[1]).at(-1)).toBe('finishes');
    });

    it('updates a promo whose versions the catalog changed', () => {
      const cards = [mickey([{...P1, finishes: ['foil']}])];
      const {changes} = mergePromoPrintings(cards, catalog(group([{...P1, finishes: ['normal']}])));

      expect(changes[0].updated).toHaveLength(1);
      expect(cards[0].variants[0].finishes).toEqual(['normal']);
    });

    it('leaves an entry that holds versions the catalog names none for untouched', () => {
      const stored = {...P1, finishes: ['foil']};
      const cards = [mickey([stored])];
      const {changes} = mergePromoPrintings(cards, catalog(group([P1])));

      expect(changes[0].unchanged).toEqual([stored]);
      expect(cards[0].variants[0]).toBe(stored);
    });

    it('leaves allCards.json byte for byte as it was when run again', () => {
      const cards = [mickey([ENCHANTED])];
      const promos = catalog(group([{...P1, finishes: ['normal']}, P3]));
      mergePromoPrintings(cards, promos);
      const once = JSON.stringify(cards, null, 2);
      mergePromoPrintings(cards, promos);

      expect(JSON.stringify(cards, null, 2)).toBe(once);
    });

    it("keeps a card's own versions its last key once promos give it variants", () => {
      const cards = [{...mickey(), finishes: ['normal']}];
      mergePromoPrintings(cards, catalog(group([P1])));

      expect(Object.keys(cards[0]).slice(-2)).toEqual(['variants', 'finishes']);
    });
  });

  it("refuses versions that aren't the app's words, in either section (#880)", () => {
    const cards = [mickey()];
    const bad = catalog(group([{...P1, finishes: ['foil', 'normal']}]));
    bad.noBaseCard[0].variants[0].finishes = ['Foil'];
    const message = thrown(() => mergePromoPrintings(cards, bad));

    expect(message).toContain('80042');
    expect(message).toContain('3237');
    expect(cards[0]).not.toHaveProperty('variants');
  });

  it('skips the printings of cards allCards.json does not hold, counting them', () => {
    const cards = [mickey()];
    const {changes, skipped} = mergePromoPrintings(cards, catalog());

    expect(skipped).toEqual({printings: 2, cards: 1});
    expect(changes).toEqual([]);
    expect(cards[0]).not.toHaveProperty('variants');
  });
});

describe('collectionPromos', () => {
  /** Hades - Dark Usurper's promo: its card is in Set 15, which no dataset holds yet. */
  const hades = {
    fullName: 'Hades - Dark Usurper',
    lorcanaJsonBaseId: null,
    variants: [{id: 80033, rarity: 'Special', number: 29, promoGrouping: 'C3'}],
  };

  it('lists the promos of both sections, by promo set and then number', () => {
    const promos = collectionPromos(catalog(group([P3, P1])));

    expect(promos.map((promo) => promo.id)).toEqual([3237, 3238, 80042, 2432]);
  });

  it("names each promo's card: the Core card it folds onto, or the pre-Core one", () => {
    const [ariel, , mickeyP1] = collectionPromos(catalog(group([P1])));

    expect(mickeyP1).toMatchObject({fullName: 'Mickey Mouse - True Friend', baseId: 1949});
    expect(ariel).toMatchObject({fullName: 'Ariel - Spectacular Singer', baseId: 2});
  });

  it('keeps the art variant that tells two arts under one number apart, but not where it came from', () => {
    const second = collectionPromos(catalog()).find((promo) => promo.id === 3238);

    expect(second).toEqual({
      id: 3238,
      rarity: 'Special',
      number: 1,
      promoGrouping: 'CC2',
      artVariant: 'b',
      fullName: 'Ariel - Spectacular Singer',
      baseId: 2,
    });
  });

  it("keeps the name a promo was printed under where it isn't its card's: 26/P2's Vaiana", () => {
    const vaiana = {id: 1663, rarity: 'Special', number: 26, promoGrouping: 'P2', printedName: 'Vaiana'};
    const moana = {fullName: 'Moana - Adventurer of Land and Sea', lorcanaJsonBaseId: 1589, variants: [vaiana]};
    const {noBaseCard, ...rest} = catalog();
    const promos = collectionPromos({...rest, noBaseCard: [...noBaseCard, moana]});

    expect(promos.find((promo) => promo.id === 1663)).toMatchObject({printedName: 'Vaiana', baseId: 1589});
  });

  it("gives each promo the catalog's versions as its last key, after its card (#880)", () => {
    const promos = collectionPromos(catalog(group([{...P1, finishes: ['foil']}])));
    const p1 = promos.find((promo) => promo.id === 80042);

    expect(Object.keys(p1).slice(-3)).toEqual(['fullName', 'baseId', 'finishes']);
    expect(p1.finishes).toEqual(['foil']);
    expect(promos.find((promo) => promo.id === 3237)).not.toHaveProperty('finishes');
  });

  it('keeps the versions the stored file gives a promo the catalog names none for, never over its own (#880)', () => {
    const kept = new Map([
      ['3237', ['normal']],
      ['80042', ['normal']],
    ]);
    const promos = collectionPromos(catalog(group([{...P1, finishes: ['foil']}])), kept);

    expect(promos.find((promo) => promo.id === 3237).finishes).toEqual(['normal']);
    expect(promos.find((promo) => promo.id === 80042).finishes).toEqual(['foil']);
  });

  it('writes the same promos again, byte for byte, from its own file (#880)', () => {
    const source = catalog(group([{...P1, finishes: ['foil']}]));
    const once = JSON.stringify(collectionPromos(source));
    expect(JSON.stringify(collectionPromos(source, finishesById(JSON.parse(once))))).toBe(once);
  });

  it('gives a promo whose card no dataset holds yet no card to reprint', () => {
    const {noBaseCard, ...rest} = catalog();
    const promos = collectionPromos({...rest, noBaseCard: [...noBaseCard, hades]});

    expect(promos.find((promo) => promo.id === 80033)).not.toHaveProperty('baseId');
  });
});

describe('promoBaseProblems', () => {
  const ariel = {id: 2, fullName: 'Ariel - Spectacular Singer'};

  it('passes promos whose cards are there, by name, and those that have no card yet', () => {
    const promos = [
      {id: 3237, fullName: 'Ariel - Spectacular Singer', baseId: 2},
      {id: 80033, fullName: 'Hades - Dark Usurper'},
    ];

    expect(promoBaseProblems(promos, [ariel])).toEqual([]);
  });

  it('names a promo whose card is missing, or is another card', () => {
    const promos = [
      {id: 3237, fullName: 'Ariel - Spectacular Singer', baseId: 9},
      {id: 3238, fullName: 'Ariel - On Human Legs', baseId: 2},
    ];
    const problems = promoBaseProblems(promos, [ariel]);

    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('no dataset holds');
    expect(problems[1]).toContain('which is Ariel - Spectacular Singer');
  });
});

describe('the promo catalog', () => {
  const catalogFile = new URL('../../data/promo-printings.json', import.meta.url);
  const {fold, noBaseCard} = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  const printings = [...fold, ...noBaseCard].flatMap((group) => group.variants);

  it('holds only the versions the app knows, in its words and order (#880)', () => {
    const named = printings.filter((printing) => printing.finishes !== undefined);
    expect(named.filter((printing) => !isFinishes(printing.finishes))).toEqual([]);
  });
});
