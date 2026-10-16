import {describe, it, expect} from 'vitest';
import {getPoolFilterOptions, ALL_FILTER_BUTTONS, type AppliedFilters} from '../filterOptions';
import {createCard} from '../../../shared/test-utils';

const NONE_APPLIED: AppliedFilters = {inks: [], types: [], costs: [], filters: {}};

const ALL = {
  keywords: ['Evasive', 'Rush', 'Singer'],
  classifications: ['Hero', 'Villain'],
  rarities: ['Common', 'Rare', 'Enchanted'],
  sets: [
    {code: '9', name: 'Fabled', number: 9},
    {code: '10', name: 'Whispers in the Well', number: 10},
  ],
};

// An inkable Amber-Steel 2-cost Rare Hero with Evasive, and an uninkable Ruby 10-cost Common
// Song with Singer: no Action that isn't a Song, nothing from set 10, no Enchanted.
const POOL = [
  createCard({
    id: '1',
    ink: 'Amber',
    ink2: 'Steel',
    cost: 2,
    classifications: ['Hero'],
    keywords: ['Evasive'],
    rarity: 'Rare',
    setCode: '9',
  }),
  createCard({
    id: '2',
    ink: 'Ruby',
    cost: 10,
    type: 'Action',
    isSong: true,
    inkwell: false,
    keywords: ['Singer 5'],
    rarity: 'Common',
    setCode: '9',
  }),
];

describe('getPoolFilterOptions', () => {
  it("narrows the button groups to the values the pool's cards match", () => {
    const {buttons} = getPoolFilterOptions(POOL, NONE_APPLIED, ALL);

    expect(buttons.inks).toEqual(['Amber', 'Ruby', 'Steel']);
    expect(buttons.costs).toEqual([2, 9]);
    expect(buttons.types).toEqual(['Character', 'Song']);
    expect(buttons.inkwell).toEqual(['inkable', 'uninkable']);
  });

  it('narrows the keyword, classification, rarity and set lists by the same matching rules as the filters', () => {
    const options = getPoolFilterOptions(POOL, NONE_APPLIED, ALL);

    expect(options.keywords).toEqual(['Evasive', 'Singer']);
    expect(options.classifications).toEqual(['Hero']);
    expect(options.rarities).toEqual(['Common', 'Rare']);
    expect(options.sets.map((set) => set.code)).toEqual(['9']);
  });

  it('keeps applied values that match no card, so they stay clearable', () => {
    const applied: AppliedFilters = {
      inks: ['Sapphire'],
      types: ['Location'],
      costs: [7],
      filters: {keywords: ['Rush'], classifications: ['Villain'], rarities: ['Enchanted'], setCodes: ['10']},
    };
    const options = getPoolFilterOptions(POOL, applied, ALL);

    expect(options.buttons.inks).toContain('Sapphire');
    expect(options.buttons.types).toContain('Location');
    expect(options.buttons.costs).toContain(7);
    expect(options.keywords).toContain('Rush');
    expect(options.classifications).toContain('Villain');
    expect(options.rarities).toContain('Enchanted');
    expect(options.sets.map((set) => set.code)).toContain('10');
  });

  it('keeps every option for an empty pool (its cards are still loading)', () => {
    const options = getPoolFilterOptions([], NONE_APPLIED, ALL);

    expect(options).toEqual({...ALL, buttons: ALL_FILTER_BUTTONS});
  });
});
