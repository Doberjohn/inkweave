import {describe, it, expect} from 'vitest';
import {filterSynergyCards, EMPTY_SYNERGY_FILTERS} from '../filterSynergyCards';
import type {SynergyFilterState} from '../filterSynergyCards';
import type {SynergyMatchDisplay} from '../../types';
import type {LorcanaCard} from 'lorcana-synergy-engine';

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

  it('should OR multiple ink values', () => {
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
    // Score 8 = Strong, Score 10 = Build-around (folds into Strong)
    expect(result.map((s) => s.card.fullName)).toEqual(['Amber Char', 'Amber Location']);
  });

  it('should fold Build-around into Strong tier filter', () => {
    const result = filterSynergyCards(synergies, withFilters({strengthFilters: ['Strong']}));
    const scores = result.map((s) => s.score);
    expect(scores).toContain(10); // Build-around included
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
    const result = filterSynergyCards(synergies, withFilters({filters: {setCode: 'TFC'}}));
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

  it('should handle cards with undefined keywords defensively', () => {
    const withUndef = [mockSynergy({keywords: undefined})];
    const result = filterSynergyCards(withUndef, withFilters({filters: {keywords: ['test']}}));
    expect(result).toEqual([]);
  });
});
