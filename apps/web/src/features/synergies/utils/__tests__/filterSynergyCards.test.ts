import {describe, it, expect} from 'vitest';
import {filterSynergyCards, EMPTY_SYNERGY_FILTERS, withoutStaleDualOnly} from '../filterSynergyCards';
import type {SynergyFilterState} from '../filterSynergyCards';
import type {SynergyMatchDisplay} from '../../types';
import type {LorcanaCard} from 'inkweave-synergy-engine';

/** Create a mock synergy match for testing. Partial card overrides supported. */
function mockSynergy(overrides: Partial<LorcanaCard> & {score?: number} = {}): SynergyMatchDisplay {
  const {score = 5, ...cardOverrides} = overrides;
  return {
    card: {
      fullName: 'Test Card',
      ink: 'Amber',
      type: 'Character',
      cost: 3,
      isSong: false,
      setCode: 'TFC',
      keywords: [],
      classifications: [],
      ...cardOverrides,
    } as LorcanaCard,
    score,
    explanation: 'Test explanation',
  };
}

/** Create filter state with partial overrides from EMPTY. */
function withFilters(overrides: Partial<SynergyFilterState>): SynergyFilterState {
  return {...EMPTY_SYNERGY_FILTERS, ...overrides};
}

describe('filterSynergyCards', () => {
  const synergies = [
    mockSynergy({fullName: 'Amber Char', ink: 'Amber', type: 'Character', cost: 2, score: 8}),
    mockSynergy({
      fullName: 'Ruby Action',
      ink: 'Ruby',
      type: 'Action',
      cost: 5,
      score: 5,
      isSong: true,
    }),
    mockSynergy({fullName: 'Emerald Item', ink: 'Emerald', type: 'Item', cost: 9, score: 2}),
    mockSynergy({fullName: 'Amber Location', ink: 'Amber', type: 'Location', cost: 10, score: 10}),
  ];

  it('should return all synergies when no filters are active', () => {
    expect(filterSynergyCards(synergies, EMPTY_SYNERGY_FILTERS)).toBe(synergies);
  });

  it('should filter by ink color', () => {
    const result = filterSynergyCards(synergies, withFilters({inkFilters: ['Amber']}));
    expect(result.map((s) => s.card.fullName)).toEqual(['Amber Char', 'Amber Location']);
  });

  it('should show the mono-ink cards of every selected ink', () => {
    const result = filterSynergyCards(synergies, withFilters({inkFilters: ['Amber', 'Ruby']}));
    expect(result).toHaveLength(3);
  });

  it('should filter by card type', () => {
    const result = filterSynergyCards(synergies, withFilters({typeFilters: ['Item']}));
    expect(result.map((s) => s.card.fullName)).toEqual(['Emerald Item']);
  });

  it('should handle Song pseudo-type separately from Action', () => {
    const result = filterSynergyCards(synergies, withFilters({typeFilters: ['Song']}));
    expect(result.map((s) => s.card.fullName)).toEqual(['Ruby Action']);
  });

  describe('Action and Song, as Browse reads them', () => {
    const withPlainAction = [...synergies, mockSynergy({fullName: 'Steel Action', ink: 'Steel', type: 'Action'})];

    it('keeps Songs out of Action', () => {
      const result = filterSynergyCards(withPlainAction, withFilters({typeFilters: ['Action']}));
      expect(result.map((s) => s.card.fullName)).toEqual(['Steel Action']);
    });

    it('keeps every action when Action and Song are both picked', () => {
      const result = filterSynergyCards(withPlainAction, withFilters({typeFilters: ['Action', 'Song']}));
      expect(result.map((s) => s.card.fullName)).toEqual(['Ruby Action', 'Steel Action']);
    });
  });

  it('should filter by cost with exact match', () => {
    const result = filterSynergyCards(synergies, withFilters({costFilters: [5]}));
    expect(result.map((s) => s.card.fullName)).toEqual(['Ruby Action']);
  });

  it('should treat cost 9 as "9 or higher"', () => {
    const result = filterSynergyCards(synergies, withFilters({costFilters: [9]}));
    expect(result.map((s) => s.card.fullName)).toEqual(['Emerald Item', 'Amber Location']);
  });

  it('should filter by strength tier', () => {
    const result = filterSynergyCards(synergies, withFilters({strengthFilters: ['Strong']}));
    // Score 8 = Strong, Score 10 = Perfect (folds into Strong)
    expect(result.map((s) => s.card.fullName)).toEqual(['Amber Char', 'Amber Location']);
  });

  it('should fold Perfect into Strong tier filter', () => {
    const result = filterSynergyCards(synergies, withFilters({strengthFilters: ['Strong']}));
    const scores = result.map((s) => s.score);
    expect(scores).toContain(10); // Perfect included
    expect(scores).toContain(8); // Strong included
  });

  it('should filter by keyword (case-insensitive substring)', () => {
    const withKeywords = [
      mockSynergy({keywords: ['Evasive', 'Singer']}),
      mockSynergy({fullName: 'No Keywords', keywords: []}),
    ];
    const result = filterSynergyCards(
      withKeywords,
      withFilters({filters: {keywords: ['evasive']}}),
    );
    expect(result).toHaveLength(1);
  });

  it('should filter by classification', () => {
    const withClass = [
      mockSynergy({classifications: ['Hero', 'Princess']}),
      mockSynergy({fullName: 'No Class', classifications: []}),
    ];
    const result = filterSynergyCards(
      withClass,
      withFilters({filters: {classifications: ['hero']}}),
    );
    expect(result).toHaveLength(1);
  });

  it('should filter by set code', () => {
    const result = filterSynergyCards(synergies, withFilters({filters: {setCodes: ['TFC']}}));
    expect(result).toHaveLength(4); // all have setCode 'TFC'
  });

  it('should AND multiple filter dimensions together', () => {
    // Amber alone matches 2 cards; cost 9 alone matches 2 cards; combined = only Amber Location
    const result = filterSynergyCards(
      synergies,
      withFilters({inkFilters: ['Amber'], costFilters: [9]}),
    );
    expect(result.map((s) => s.card.fullName)).toEqual(['Amber Location']);
  });

  it('should return empty array when no cards match', () => {
    const result = filterSynergyCards(synergies, withFilters({inkFilters: ['Sapphire']}));
    expect(result).toEqual([]);
  });

  it('should keep cards of any picked rarity', () => {
    const pool = [
      mockSynergy({fullName: 'Common', rarity: 'Common'}),
      mockSynergy({fullName: 'Rare', rarity: 'Rare'}),
      mockSynergy({fullName: 'Legendary', rarity: 'Legendary'}),
    ];
    const result = filterSynergyCards(pool, withFilters({filters: {rarities: ['Rare', 'Legendary']}}));
    expect(result.map((s) => s.card.fullName)).toEqual(['Rare', 'Legendary']);
  });

  it('should keep only cards carrying every picked keyword', () => {
    const pool = [
      mockSynergy({fullName: 'Evasive', keywords: ['Evasive']}),
      mockSynergy({fullName: 'Evasive Ward', keywords: ['Evasive', 'Ward']}),
    ];
    const result = filterSynergyCards(pool, withFilters({filters: {keywords: ['Evasive', 'Ward']}}));
    expect(result.map((s) => s.card.fullName)).toEqual(['Evasive Ward']);
  });

  it('should handle cards with undefined keywords defensively', () => {
    const withUndef = [mockSynergy({keywords: undefined})];
    const result = filterSynergyCards(withUndef, withFilters({filters: {keywords: ['test']}}));
    expect(result).toEqual([]);
  });

  // The SAME ink rule as Browse: a card page's synergies and the grid must answer
  // an ink selection identically.
  describe('ink rule shared with Browse', () => {
    const pool = [
      mockSynergy({fullName: 'Amber', ink: 'Amber'}),
      mockSynergy({fullName: 'Amber-Ruby', ink: 'Amber', ink2: 'Ruby'}),
      mockSynergy({fullName: 'Steel', ink: 'Steel'}),
    ];
    const names = (state: Partial<SynergyFilterState>) =>
      filterSynergyCards(pool, withFilters(state)).map((s) => s.card.fullName);

    it('shows a dual-ink card under either of its inks alone', () => {
      expect(names({inkFilters: ['Amber']})).toEqual(['Amber', 'Amber-Ruby']);
      // The old primary-ink check missed this one.
      expect(names({inkFilters: ['Ruby']})).toEqual(['Amber-Ruby']);
    });

    it('hides a dual-ink card from a pair that is not its own', () => {
      expect(names({inkFilters: ['Amber', 'Steel']})).toEqual(['Amber', 'Steel']);
    });

    it('narrows to dual-ink cards when the Dual-ink cards switch is on', () => {
      expect(names({inkFilters: ['Amber'], filters: {inkMatch: 'dual'}})).toEqual(['Amber-Ruby']);
    });
  });

  it('should switch the Dual-ink cards mode off once three inks no longer offer it', () => {
    const pair = withFilters({inkFilters: ['Amber', 'Steel'], filters: {inkMatch: 'dual'}});
    expect(withoutStaleDualOnly(pair)).toBe(pair);
    const three = withoutStaleDualOnly({...pair, inkFilters: ['Amber', 'Steel', 'Ruby']});
    expect(three.filters.inkMatch).toBeUndefined();
  });

  it('should filter by inkwell', () => {
    const pool = [
      mockSynergy({fullName: 'Inkable', inkwell: true}),
      mockSynergy({fullName: 'Uninkable', inkwell: false}),
    ];
    const result = filterSynergyCards(pool, withFilters({filters: {inkwell: 'uninkable'}}));
    expect(result.map((s) => s.card.fullName)).toEqual(['Uninkable']);
  });
});
