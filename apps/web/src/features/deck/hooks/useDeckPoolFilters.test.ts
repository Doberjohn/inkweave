import {describe, it, expect} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useDeckPoolFilters, applyPoolFilters, type PoolFilterState} from './useDeckPoolFilters';
import {createCard} from '../../../shared/test-utils';

describe('useDeckPoolFilters', () => {
  it('toggles an ink on and off', () => {
    const {result} = renderHook(() => useDeckPoolFilters());
    act(() => result.current.toggleInk('Amber'));
    expect(result.current.inkFilters).toEqual(['Amber']);
    act(() => result.current.toggleInk('Amber'));
    expect(result.current.inkFilters).toEqual([]);
  });

  it('counts active facets across ink, type and cost', () => {
    const {result} = renderHook(() => useDeckPoolFilters());
    act(() => {
      result.current.toggleInk('Amber');
      result.current.toggleType('Action');
      result.current.toggleCost(3);
    });
    expect(result.current.activeFilterCount).toBe(3);
  });

  it('clearAllFilters resets search, facets and count', () => {
    const {result} = renderHook(() => useDeckPoolFilters());
    act(() => {
      result.current.setSearchQuery('elsa');
      result.current.toggleInk('Amber');
    });
    act(() => result.current.clearAllFilters());
    expect(result.current.searchQuery).toBe('');
    expect(result.current.inkFilters).toEqual([]);
    expect(result.current.activeFilterCount).toBe(0);
  });
});

describe('applyPoolFilters', () => {
  const cards = [
    createCard({id: 'a', name: 'Elsa', fullName: 'Elsa - Snow Queen', ink: 'Sapphire', cost: 5}),
    createCard({id: 'b', name: 'Stitch', fullName: 'Stitch - Rock Star', ink: 'Ruby', cost: 3}),
    createCard({id: 'c', name: 'Anna', fullName: 'Anna - Heir to Arendelle', ink: 'Amber', cost: 2}),
  ];
  const base: PoolFilterState = {
    searchQuery: '',
    inkFilters: [],
    typeFilters: [],
    costFilters: [],
    filters: {},
    sortOrder: 'newest',
  };

  it('filters by ink', () => {
    const out = applyPoolFilters(cards, {...base, inkFilters: ['Ruby']});
    expect(out.map((c) => c.id)).toEqual(['b']);
  });

  it('searches by name', () => {
    const out = applyPoolFilters(cards, {...base, searchQuery: 'elsa'});
    expect(out.map((c) => c.id)).toEqual(['a']);
  });

  it('returns every card when no filters are set', () => {
    expect(applyPoolFilters(cards, base)).toHaveLength(3);
  });
});
