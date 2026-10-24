import {describe, it, expect} from 'vitest';
import {foldVariants} from '../fold-variants.mjs';

const IMAGES = {
  full: 'https://api.lorcana.ravensburger.com/images/en/set9/223_full.jpg',
  thumbnail: 'https://api.lorcana.ravensburger.com/images/en/set9/223_thumb.jpg',
};

/** A base printing as allCards.json stores it. */
const base = (over = {}) => ({
  id: 1938,
  setCode: '9',
  number: 2,
  fullName: 'Pongo - Determined Father',
  rarity: 'Super Rare',
  ...over,
});

/** A LorcanaJSON variant printing, with the metadata the fold must drop. */
const variant = (over = {}) => ({
  id: 2141,
  baseId: 1938,
  setCode: '9',
  number: 223,
  fullName: 'Pongo - Determined Father',
  rarity: 'Enchanted',
  images: {...IMAGES, foilMask: 'mask.jpg', varnishMask: 'varnish.jpg'},
  artists: ['Kenneth Anderson'],
  ...over,
});

const byBaseId = {matchBy: 'baseId', idFor: (v) => v.id};

/** A variant entry added by hand from a scan revealed abroad first (#681): no art URLs. */
const italianHandScan = () => ({id: 2141, rarity: 'Enchanted', number: 223, scanLanguage: 'it'});

describe('foldVariants', () => {
  it('folds a variant into its base by baseId, keeping only id, rarity, number and full/thumbnail art', () => {
    const cards = [base()];
    foldVariants(cards, [variant()], byBaseId);

    expect(cards[0].variants).toEqual([
      {id: 2141, rarity: 'Enchanted', number: 223, images: IMAGES},
    ]);
  });

  it('folds a reveal-season variant by set and full name, storing the id idFor picks', () => {
    const cards = [{id: 14023, setCode: '14', number: 23, fullName: 'Mickey Mouse - Best in Town'}];
    const iconic = variant({
      id: 3506,
      baseId: 3288,
      setCode: '14',
      number: 241,
      fullName: 'Mickey Mouse - Best in Town',
      rarity: 'Iconic',
    });
    foldVariants(cards, [iconic], {matchBy: 'name', idFor: (v) => 14000 + v.number});

    expect(cards[0].variants).toEqual([{id: 14241, rarity: 'Iconic', number: 241, images: IMAGES}]);
  });

  it('ignores Special promos and cards with no baseId', () => {
    const cards = [base()];
    const result = foldVariants(
      cards,
      [variant({rarity: 'Special'}), base({id: 1939, number: 3})],
      byBaseId,
    );

    expect(cards[0].variants).toBeUndefined();
    expect(result).toEqual({folded: [], replaced: [], unchanged: [], unmatched: []});
  });

  it("folds a printing that keeps its base card's rarity, since it has a baseId (#796)", () => {
    const cards = [base()];
    const sameRarity = variant({id: 3573, number: 247, rarity: 'Super Rare'});
    const result = foldVariants(cards, [sameRarity], byBaseId);

    expect(result.folded).toEqual([sameRarity]);
    expect(cards[0].variants).toEqual([
      {id: 3573, rarity: 'Super Rare', number: 247, images: IMAGES},
    ]);
  });

  it.each(['Epic', 'Enchanted', 'Iconic'])(
    'reports an %s that has lost its baseId as unmatched, never skipping it',
    (rarity) => {
      const cards = [base()];
      const unlinked = variant({baseId: undefined, rarity});
      const result = foldVariants(cards, [unlinked], byBaseId);

      expect(result.unmatched).toEqual([unlinked]);
    },
  );

  it('reports a variant whose base is not in the target as unmatched', () => {
    const cards = [base()];
    const orphan = variant({baseId: 99});
    const result = foldVariants(cards, [orphan], byBaseId);

    expect(result.unmatched).toEqual([orphan]);
    expect(cards[0].variants).toBeUndefined();
  });

  it('is a no-op the second time, leaving build-injected hashes in place', () => {
    const cards = [base()];
    foldVariants(cards, [variant()], byBaseId);
    Object.assign(cards[0].variants[0], {imageHash: 'h', imageHashSm: 'hs'});
    const result = foldVariants(cards, [variant()], byBaseId);

    expect(result.unchanged).toHaveLength(1);
    expect(result.folded).toHaveLength(0);
    expect(cards[0].variants[0]).toMatchObject({imageHash: 'h', imageHashSm: 'hs'});
  });

  it('replaces the entry for the same printing instead of duplicating it', () => {
    const cards = [base({variants: [{id: 2141, rarity: 'Enchanted', number: 223}]})];
    const result = foldVariants(cards, [variant()], byBaseId);

    expect(result.replaced).toHaveLength(1);
    expect(cards[0].variants).toEqual([
      {id: 2141, rarity: 'Enchanted', number: 223, images: IMAGES},
    ]);
  });

  it('replaces an entry whose rarity changed under the same number, never keeping the stale one', () => {
    const cards = [base({variants: [{id: 2141, rarity: 'Epic', number: 223, images: IMAGES}]})];
    const result = foldVariants(cards, [variant()], byBaseId);

    expect(result.replaced).toHaveLength(1);
    expect(cards[0].variants).toEqual([
      {id: 2141, rarity: 'Enchanted', number: 223, images: IMAGES},
    ]);
  });

  it('keeps two printings of the same rarity apart, each under its own number (#796)', () => {
    const cards = [base()];
    const first = variant({id: 3573, number: 247, rarity: 'Super Rare'});
    const second = variant({id: 3580, number: 250, rarity: 'Super Rare'});
    const result = foldVariants(cards, [first, second], byBaseId);

    expect(result.folded).toEqual([first, second]);
    expect(cards[0].variants.map((v) => v.id)).toEqual([3573, 3580]);
  });

  it('keeps a base with several printings in collector-number order', () => {
    const cards = [base()];
    foldVariants(cards, [variant({id: 2200, number: 240, rarity: 'Iconic'}), variant()], byBaseId);

    expect(cards[0].variants.map((v) => v.number)).toEqual([223, 240]);
  });

  it('never overwrites a promo that shares the number of a printing it folds (#805)', () => {
    const promo = {id: 80010, rarity: 'Special', number: 223, promoGrouping: 'C1'};
    const cards = [base({variants: [promo]})];
    const result = foldVariants(cards, [variant()], byBaseId);

    expect(result.folded).toHaveLength(1);
    expect(cards[0].variants.map((v) => v.id)).toEqual([2141, 80010]);
  });

  it('keeps the promos after the other printings, in their own order (#805)', () => {
    const p3 = {id: 2432, rarity: 'Special', number: 10, promoGrouping: 'P3'};
    const p1 = {id: 80042, rarity: 'Special', number: 25, promoGrouping: 'P1'};
    const cards = [base({variants: [p1, p3]})];
    foldVariants(cards, [variant()], byBaseId);

    expect(cards[0].variants.map((v) => v.id)).toEqual([2141, 80042, 2432]);
  });

  it("drops a hand scan's scanLanguage once official art replaces the entry", () => {
    const cards = [base({variants: [italianHandScan()]})];
    const result = foldVariants(cards, [variant()], byBaseId);

    expect(result.replaced).toHaveLength(1);
    expect(cards[0].variants[0]).not.toHaveProperty('scanLanguage');
  });

  describe('versions (#880)', () => {
    /** Violet Parr - Super Resilient #247, the alt foil LorcanaJSON lists in foil alone. */
    const altFoil = (over = {}) =>
      variant({id: 3573, number: 247, rarity: 'Super Rare', foilTypes: ['Cold'], ...over});

    it("writes LorcanaJSON's versions as the entry's last key, only where the rarity rule gets them wrong", () => {
      const cards = [base()];
      foldVariants(cards, [variant({foilTypes: ['Cold']}), altFoil()], byBaseId);

      // The Enchanted comes in foil, as its rarity says, so it needs no field.
      expect(cards[0].variants[0]).not.toHaveProperty('finishes');
      expect(Object.keys(cards[0].variants[1])).toEqual([
        'id',
        'rarity',
        'number',
        'images',
        'finishes',
      ]);
      expect(cards[0].variants[1].finishes).toEqual(['foil']);
    });

    it('never changes or removes versions an entry holds, whatever LorcanaJSON says', () => {
      // An owner's correction to Both, from admin's Edit card.
      const corrected = {
        id: 3573,
        rarity: 'Super Rare',
        number: 247,
        images: IMAGES,
        finishes: ['normal', 'foil'],
      };
      const cards = [base({variants: [corrected]})];
      const result = foldVariants(cards, [altFoil()], byBaseId);

      expect(result.unchanged).toHaveLength(1);
      expect(cards[0].variants[0]).toBe(corrected);
    });

    it('keeps the versions an entry held when official art replaces it', () => {
      const scan = {id: 3573, rarity: 'Super Rare', number: 247, finishes: ['normal']};
      const cards = [base({variants: [scan]})];
      foldVariants(cards, [altFoil()], byBaseId);

      expect(cards[0].variants[0]).toEqual({
        id: 3573,
        rarity: 'Super Rare',
        number: 247,
        images: IMAGES,
        finishes: ['normal'],
      });
    });

    it('takes the versions `kept` holds for an entry the base card no longer has, as graduation passes them', () => {
      const cards = [base()];
      foldVariants(cards, [altFoil()], {
        ...byBaseId,
        kept: new Map([['3573', ['normal', 'foil']]]),
      });

      expect(cards[0].variants[0].finishes).toEqual(['normal', 'foil']);
    });

    it("keeps a Core card's own versions its last key when it gains its first printing", () => {
      const cards = [base({finishes: ['foil']})];
      foldVariants(cards, [variant()], byBaseId);

      expect(Object.keys(cards[0]).at(-1)).toBe('finishes');
      expect(cards[0].finishes).toEqual(['foil']);
    });

    it('leaves the data byte for byte as it was when run again', () => {
      const cards = [base()];
      foldVariants(cards, [variant({foilTypes: ['Cold']}), altFoil()], byBaseId);
      const once = JSON.stringify(cards, null, 2);
      foldVariants(cards, [variant({foilTypes: ['Cold']}), altFoil()], byBaseId);

      expect(JSON.stringify(cards, null, 2)).toBe(once);
    });
  });

  it("keeps a hand scan's scanLanguage while the source has no art for the printing yet", () => {
    const cards = [base({variants: [italianHandScan()]})];
    const result = foldVariants(cards, [variant({images: undefined})], byBaseId);

    expect(result.unchanged).toHaveLength(1);
    expect(cards[0].variants[0].scanLanguage).toBe('it');
  });
});
