import {describe, it, expect} from 'vitest';
import {
  applyCardRules,
  droppedVariants,
  previewVariantsMissingFrom,
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
