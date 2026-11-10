import {describe, expect, it} from 'vitest';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {CollectionEntries} from '../collectionParser';
import {ALL_PROMO_SETS, WHOLE_COLLECTION} from '../binderCards';
import {binderFace} from './binderCovers';
import type {Binder} from './binderRules';

/** A card named by its id: a 1-cost Amber Common in Set 12 unless told otherwise. */
const cardOf = (facts: Partial<LorcanaCard> & Pick<LorcanaCard, 'id'>) =>
  ({
    name: facts.id,
    fullName: facts.id,
    cost: 1,
    ink: 'Amber',
    inkwell: true,
    type: 'Character',
    rarity: 'Common',
    setCode: '12',
    setNumber: 1,
    ...facts,
  }) as LorcanaCard;

const POOL = [
  cardOf({id: 'common-12', setNumber: 3}),
  cardOf({id: 'rare-12', rarity: 'Rare', setNumber: 40}),
  cardOf({id: 'epic-12', rarity: 'Epic', setNumber: 210, baseId: 'rare-12'}),
  cardOf({id: 'steel-12', ink: 'Steel', rarity: 'Legendary', setNumber: 190}),
  cardOf({id: 'rare-11', rarity: 'Rare', setCode: '11', setNumber: 12}),
  cardOf({id: 'promo-p1', rarity: 'Special', setCode: 'P1', setNumber: 5, baseId: 'common-12'}),
  cardOf({id: 'promo-p2', ink: 'Steel', rarity: 'Special', setCode: 'P2', setNumber: 9, baseId: 'steel-12'}),
];

const binder = (scope: string, rules = '', cover: string | null = null): Binder => ({
  id: 'b1',
  name: 'Binder',
  scope,
  rules,
  pages: 4,
  cover,
  place: 0,
});

const binderFigures = (...args: Parameters<typeof binderFace>) => binderFace(...args).figures;
const coverDesign = (...args: Parameters<typeof binderFace>) => binderFace(...args).cover;

describe("a binder's figures", () => {
  // Held: common-12 in normal only, epic-12 in foil (all it comes in), rare-11 in both, promo-p1 in normal.
  const entries: CollectionEntries = {
    'common-12': {normal: 1, foil: 0},
    'epic-12': {normal: 0, foil: 1},
    'rare-11': {normal: 2, foil: 1},
    'promo-p1': {normal: 1, foil: 0},
  };

  it('counts every card for My collection, as the panel counts the whole collection', () => {
    expect(binderFigures(POOL, entries, null)).toEqual({complete: 4, master: 2, cards: 7});
  });

  it("counts a rule's cards across every set", () => {
    // Amber: common-12, rare-12, epic-12, rare-11, promo-p1. Held 4; held in every finish: epic-12, rare-11.
    expect(binderFigures(POOL, entries, binder(WHOLE_COLLECTION, 'ink=Amber'))).toEqual({
      complete: 4,
      master: 2,
      cards: 5,
    });
  });

  it("counts a set scope's cards alone", () => {
    // Set 12: common-12, rare-12, epic-12, steel-12. Held: common-12, epic-12; in every finish: epic-12.
    expect(binderFigures(POOL, entries, binder('12'))).toEqual({complete: 2, master: 1, cards: 4});
  });

  it("counts a promo scope's cards, a rarity rule ignored as the binder ignores it", () => {
    expect(binderFigures(POOL, entries, binder(ALL_PROMO_SETS, 'rarity=Epic'))).toEqual({
      complete: 1,
      master: 0,
      cards: 2,
    });
  });

  it('reads nothing for a binder whose rules hold no card', () => {
    expect(binderFigures(POOL, entries, binder(WHOLE_COLLECTION, 'ink=Ruby'))).toEqual({
      complete: 0,
      master: 0,
      cards: 0,
    });
  });
});

describe("a binder's cover", () => {
  it('is the design its row names', () => {
    expect(coverDesign(POOL, {}, binder('12', '', 'tartan')).id).toBe('tartan');
  });

  it('is the first design with none named, or one this build does not know', () => {
    expect(coverDesign(POOL, {}, binder('12')).id).toBe('starry-night');
    expect(coverDesign(POOL, {}, binder('12', '', 'paisley')).id).toBe('starry-night');
  });

  it("is My collection's shelf design for My collection, never a binder's", () => {
    expect(coverDesign(POOL, {}, null, 'argyle').id).toBe('argyle');
    expect(coverDesign(POOL, {}, binder('12'), 'argyle').id).toBe('starry-night');
  });
});
