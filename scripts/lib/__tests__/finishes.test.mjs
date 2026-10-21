import {describe, it, expect} from 'vitest';
import {
  finishesById,
  finishesReport,
  givenFinishes,
  isFinishes,
  lorcanaFinishes,
  placeFinishes,
} from '../finishes.mjs';

describe('lorcanaFinishes', () => {
  it("gives an alt foil, which keeps its base card's rarity, its foil version alone", () => {
    // Violet Parr - Super Resilient #247, Super Rare: the rarity rule would give it both.
    expect(lorcanaFinishes({rarity: 'Super Rare', foilTypes: ['Cold']})).toEqual(['foil']);
  });

  it('gives no field where the versions match the rarity rule: a chase printing in foil, a card in both', () => {
    expect(lorcanaFinishes({rarity: 'Enchanted', foilTypes: ['Satin']})).toBeUndefined();
    expect(lorcanaFinishes({rarity: 'Common', foilTypes: ['None', 'Cold']})).toBeUndefined();
  });

  it('names both versions where the rarity rule would give one, and the normal one alone', () => {
    expect(lorcanaFinishes({rarity: 'Iconic', foilTypes: ['None', 'Cold']})).toEqual([
      'normal',
      'foil',
    ]);
    expect(lorcanaFinishes({rarity: 'Rare', foilTypes: ['None']})).toEqual(['normal']);
  });

  it("never reads a promo's, which only the catalog gives", () => {
    expect(lorcanaFinishes({rarity: 'Special', foilTypes: ['None']})).toBeUndefined();
  });

  it.each([undefined, []])(
    'gives no field when foilTypes is %j, as for an external reveal',
    (foilTypes) => {
      expect(lorcanaFinishes({rarity: 'Super Rare', foilTypes})).toBeUndefined();
    },
  );
});

describe('isFinishes', () => {
  it.each([[['normal']], [['foil']], [['normal', 'foil']]])('accepts %j', (finishes) => {
    expect(isFinishes(finishes)).toBe(true);
  });

  it.each([[['foil', 'normal']], [[]], [['Normal']], ['foil'], [undefined]])(
    'refuses %j',
    (finishes) => {
      expect(isFinishes(finishes)).toBe(false);
    },
  );
});

describe('placeFinishes', () => {
  it("makes the versions the entry's last key, wherever they were", () => {
    const entry = placeFinishes({id: 1, finishes: ['normal'], rarity: 'Rare', images: {}}, [
      'foil',
    ]);

    expect(Object.keys(entry)).toEqual(['id', 'rarity', 'images', 'finishes']);
    expect(entry.finishes).toEqual(['foil']);
  });

  it('leaves an entry given none without the field', () => {
    expect(placeFinishes({id: 1, finishes: ['foil']}, undefined)).toEqual({id: 1});
  });
});

describe('finishesById and givenFinishes', () => {
  const card = (finishes) => ({
    id: 2842,
    fullName: 'Mr. Incredible - Super Strong',
    variants: [{id: 3571, number: 243, ...(finishes && {finishes})}],
  });
  const label = (entry, of) => `${entry.id} ${of.fullName}`;

  it('collects the versions every card and printing holds, by id', () => {
    expect(finishesById([card(['foil'])])).toEqual(new Map([['3571', ['foil']]]));
  });

  it('lists the versions a run gave, and none it kept', () => {
    const given = [{label: '3571 Mr. Incredible - Super Strong', finishes: ['foil']}];
    expect(givenFinishes(new Map(), [card(['foil'])], label)).toEqual(given);
    expect(givenFinishes(finishesById([card(['foil'])]), [card(['foil'])], label)).toEqual([]);
  });
});

describe('finishesReport', () => {
  it('counts the printings given versions, and names each', () => {
    expect(
      finishesReport([
        {label: '3573 #247 Super Rare Violet Parr', finishes: ['foil']},
        {label: '80051 61/P3 Maleficent', finishes: ['normal']},
        {label: '2163 #221 Iconic Pongo', finishes: ['normal', 'foil']},
      ]),
    ).toEqual([
      'Versions given (finishes, #880): 3',
      '  3573 #247 Super Rare Violet Parr: foil only',
      '  80051 61/P3 Maleficent: normal only',
      '  2163 #221 Iconic Pongo: both',
    ]);
  });

  it('says so when a run gave none', () => {
    expect(finishesReport([])).toEqual(['Versions given (finishes, #880): none']);
  });
});
