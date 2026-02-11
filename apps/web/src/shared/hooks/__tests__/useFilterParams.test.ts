import {describe, it, expect} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {useFilterParams} from '../useFilterParams';
import type {ReactNode} from 'react';

/** Create a wrapper with MemoryRouter and optional initial URL entries */
function createWrapper(initialEntries: string[] = ['/']) {
  return function Wrapper({children}: {children: ReactNode}) {
    return MemoryRouter({initialEntries, children});
  };
}

describe('useFilterParams', () => {
  describe('URL parsing', () => {
    it('should parse ink param as array', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/?ink=Amber,Ruby']),
      });
      expect(result.current.inkFilters).toEqual(['Amber', 'Ruby']);
    });

    it('should parse single ink param', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/?ink=Sapphire']),
      });
      expect(result.current.inkFilters).toEqual(['Sapphire']);
    });

    it('should drop invalid inks from URL', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/?ink=Amber,InvalidColor,Ruby']),
      });
      expect(result.current.inkFilters).toEqual(['Amber', 'Ruby']);
    });

    it('should parse type param as array', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/?type=Character,Action']),
      });
      expect(result.current.typeFilters).toEqual(['Character', 'Action']);
    });

    it('should drop invalid types from URL', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/?type=Character,Spell']),
      });
      expect(result.current.typeFilters).toEqual(['Character']);
    });

    it('should parse cost param as number array', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/?cost=2,5,9']),
      });
      expect(result.current.costFilters).toEqual([2, 5, 9]);
    });

    it('should drop invalid costs from URL', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/?cost=1,abc,0,3']),
      });
      expect(result.current.costFilters).toEqual([1, 3]);
    });

    it('should return empty arrays when no params set', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/']),
      });
      expect(result.current.inkFilters).toEqual([]);
      expect(result.current.typeFilters).toEqual([]);
      expect(result.current.costFilters).toEqual([]);
      expect(result.current.searchQuery).toBe('');
    });

    it('should parse keyword, classification, and set params', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/?keyword=Singer&classification=Princess&set=5']),
      });
      expect(result.current.filters).toEqual({
        keywords: ['Singer'],
        classifications: ['Princess'],
        setCode: '5',
      });
    });
  });

  describe('activeFilterCount', () => {
    it('should count all active filters', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/?ink=Amber,Ruby&type=Character&cost=3,5&keyword=Singer']),
      });
      // 2 inks + 1 type + 2 costs + 1 keyword = 6
      expect(result.current.activeFilterCount).toBe(6);
    });

    it('should be zero with no filters', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/']),
      });
      expect(result.current.activeFilterCount).toBe(0);
    });
  });

  describe('toggle functions', () => {
    it('should add ink when toggling absent ink', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/']),
      });
      act(() => result.current.toggleInk('Amber'));
      expect(result.current.inkFilters).toEqual(['Amber']);
    });

    it('should remove ink when toggling present ink', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/?ink=Amber,Ruby']),
      });
      act(() => result.current.toggleInk('Amber'));
      expect(result.current.inkFilters).toEqual(['Ruby']);
    });

    it('should clear ink param when last ink is toggled off', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/?ink=Amber']),
      });
      act(() => result.current.toggleInk('Amber'));
      expect(result.current.inkFilters).toEqual([]);
    });

    it('should add type when toggling absent type', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/']),
      });
      act(() => result.current.toggleType('Character'));
      expect(result.current.typeFilters).toEqual(['Character']);
    });

    it('should remove type when toggling present type', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/?type=Character,Action']),
      });
      act(() => result.current.toggleType('Character'));
      expect(result.current.typeFilters).toEqual(['Action']);
    });

    it('should add cost when toggling absent cost', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/']),
      });
      act(() => result.current.toggleCost(5));
      expect(result.current.costFilters).toEqual([5]);
    });

    it('should remove cost when toggling present cost', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/?cost=3,5']),
      });
      act(() => result.current.toggleCost(3));
      expect(result.current.costFilters).toEqual([5]);
    });
  });

  describe('clearAllFilters', () => {
    it('should clear all params', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/?ink=Amber&type=Character&cost=3&keyword=Singer&q=elsa']),
      });
      act(() => result.current.clearAllFilters());
      expect(result.current.inkFilters).toEqual([]);
      expect(result.current.typeFilters).toEqual([]);
      expect(result.current.costFilters).toEqual([]);
      expect(result.current.searchQuery).toBe('');
      expect(result.current.activeFilterCount).toBe(0);
    });
  });

  describe('setFilters', () => {
    it('should set keyword, classification, and set params', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/']),
      });
      act(() =>
        result.current.setFilters({
          keywords: ['Evasive'],
          classifications: ['Hero'],
          setCode: '6',
        }),
      );
      expect(result.current.filters).toEqual({
        keywords: ['Evasive'],
        classifications: ['Hero'],
        setCode: '6',
      });
    });

    it('should preserve ink/type/cost params when setting filters', () => {
      const {result} = renderHook(() => useFilterParams(), {
        wrapper: createWrapper(['/?ink=Ruby&cost=2']),
      });
      act(() => result.current.setFilters({keywords: ['Ward']}));
      expect(result.current.inkFilters).toEqual(['Ruby']);
      expect(result.current.costFilters).toEqual([2]);
      expect(result.current.filters.keywords).toEqual(['Ward']);
    });
  });
});
