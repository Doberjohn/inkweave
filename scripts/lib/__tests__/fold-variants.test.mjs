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

  it('ignores Special promos and base rarities', () => {
    const cards = [base()];
    const result = foldVariants(
      cards,
      [variant({rarity: 'Special'}), variant({rarity: 'Common'})],
      byBaseId,
    );

    expect(cards[0].variants).toBeUndefined();
    expect(result).toEqual({folded: [], replaced: [], unchanged: [], unmatched: []});
  });

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

  it('replaces an entry of the same rarity instead of duplicating it', () => {
    const cards = [base({variants: [{id: 2141, rarity: 'Enchanted', number: 223}]})];
    const result = foldVariants(cards, [variant()], byBaseId);

    expect(result.replaced).toHaveLength(1);
    expect(cards[0].variants).toEqual([
      {id: 2141, rarity: 'Enchanted', number: 223, images: IMAGES},
    ]);
  });

  it('keeps a base with several printings in collector-number order', () => {
    const cards = [base()];
    foldVariants(cards, [variant({id: 2200, number: 240, rarity: 'Iconic'}), variant()], byBaseId);

    expect(cards[0].variants.map((v) => v.number)).toEqual([223, 240]);
  });
});
