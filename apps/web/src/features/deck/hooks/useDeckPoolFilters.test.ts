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

  describe('dual-ink pool gate', () => {
    const monoAmethyst = createCard({id: 'am', ink: 'Amethyst'});
    const monoRuby = createCard({id: 'ru', ink: 'Ruby'});
    const monoEmerald = createCard({id: 'em', ink: 'Emerald'});
    const amethystRuby = createCard({id: 'ar', ink: 'Amethyst', ink2: 'Ruby'});
    const amethystSapphire = createCard({id: 'as', ink: 'Amethyst', ink2: 'Sapphire'});
    const pool = [monoAmethyst, monoRuby, monoEmerald, amethystRuby, amethystSapphire];

    it('includes a mono card of a selected ink when two inks are chosen', () => {
      const out = applyPoolFilters(pool, {...base, inkFilters: ['Amethyst', 'Ruby']});
      expect(out.map((c) => c.id)).toContain('am');
      expect(out.map((c) => c.id)).toContain('ru');
    });

    it('includes a dual card that fits entirely inside the two selected inks', () => {
      const out = applyPoolFilters(pool, {...base, inkFilters: ['Amethyst', 'Ruby']});
      expect(out.map((c) => c.id)).toContain('ar');
    });

    it('excludes a dual card whose second ink is outside the two selected inks', () => {
      const out = applyPoolFilters(pool, {...base, inkFilters: ['Amethyst', 'Ruby']});
      expect(out.map((c) => c.id)).not.toContain('as');
    });

    it('excludes a mono card of an unselected ink when two inks are chosen', () => {
      const out = applyPoolFilters(pool, {...base, inkFilters: ['Amethyst', 'Ruby']});
      expect(out.map((c) => c.id)).not.toContain('em');
    });

    it('includes a dual card containing the single selected ink (second slot still open)', () => {
      const out = applyPoolFilters(pool, {...base, inkFilters: ['Amethyst']});
      expect(out.map((c) => c.id)).toContain('as');
    });

    it('includes a mono card of the single selected ink', () => {
      const out = applyPoolFilters(pool, {...base, inkFilters: ['Amethyst']});
      expect(out.map((c) => c.id)).toContain('am');
    });

    it('excludes a mono card of another ink when a single ink is chosen', () => {
      const out = applyPoolFilters(pool, {...base, inkFilters: ['Amethyst']});
      expect(out.map((c) => c.id)).not.toContain('ru');
    });
  });

  it('searches by name', () => {
    const out = applyPoolFilters(cards, {...base, searchQuery: 'elsa'});
    expect(out.map((c) => c.id)).toEqual(['a']);
  });

  it('returns every card when no filters are set', () => {
    expect(applyPoolFilters(cards, base)).toHaveLength(3);
  });
});
