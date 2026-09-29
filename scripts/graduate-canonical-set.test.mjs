import {describe, it, expect} from 'vitest';
import {applyCardRules} from './graduate-canonical-set.mjs';

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
