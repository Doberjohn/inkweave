import {useMemo, useCallback} from 'react';
import {useSearchParams} from 'react-router-dom';
import type {Ink} from '../../features/cards';
import type {CardFilterOptions} from '../../features/cards/loader';

const VALID_INKS = new Set<string>(['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel']);

function isValidInk(value: string): value is Ink {
  return VALID_INKS.has(value);
}

export interface UseFilterParamsReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  inkFilter: Ink | 'all';
  setInkFilter: (ink: Ink | 'all') => void;
  filters: CardFilterOptions;
  setFilters: (filters: CardFilterOptions) => void;
  clearAllFilters: () => void;
  activeFilterCount: number;
}

export function useFilterParams(): UseFilterParamsReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read filter state from URL params
  const searchQuery = searchParams.get('q') ?? '';

  const inkFilter: Ink | 'all' = useMemo(() => {
    const ink = searchParams.get('ink');
    return ink && isValidInk(ink) ? ink : 'all';
  }, [searchParams]);

  const filters: CardFilterOptions = useMemo(() => {
    const f: CardFilterOptions = {};
    const type = searchParams.get('type');
    if (type) f.type = type as CardFilterOptions['type'];
    const minCost = searchParams.get('minCost');
    if (minCost) f.minCost = parseInt(minCost, 10);
    const maxCost = searchParams.get('maxCost');
    if (maxCost) f.maxCost = parseInt(maxCost, 10);
    const keyword = searchParams.get('keyword');
    if (keyword) f.keywords = [keyword];
    const classification = searchParams.get('classification');
    if (classification) f.classifications = [classification];
    const set = searchParams.get('set');
    if (set) f.setCode = set;
    return f;
  }, [searchParams]);

  const activeFilterCount = useMemo(
    () =>
      [
        inkFilter !== 'all',
        filters.type,
        filters.minCost !== undefined,
        filters.maxCost !== undefined,
        filters.keywords?.length,
        filters.classifications?.length,
        filters.setCode,
      ].filter(Boolean).length,
    [inkFilter, filters],
  );

  // Write helpers — all use replace to avoid history pollution
  const updateParams = useCallback(
    (updater: (params: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          updater(next);
          return next;
        },
        {replace: true},
      );
    },
    [setSearchParams],
  );

  const setSearchQuery = useCallback(
    (query: string) => {
      updateParams((p) => {
        if (query) p.set('q', query);
        else p.delete('q');
      });
    },
    [updateParams],
  );

  const setInkFilter = useCallback(
    (ink: Ink | 'all') => {
      updateParams((p) => {
        if (ink !== 'all') p.set('ink', ink);
        else p.delete('ink');
      });
    },
    [updateParams],
  );

  const setFilters = useCallback(
    (newFilters: CardFilterOptions) => {
      updateParams((p) => {
        // Clear all filter params first
        p.delete('type');
        p.delete('minCost');
        p.delete('maxCost');
        p.delete('keyword');
        p.delete('classification');
        p.delete('set');
        // Set new values
        if (newFilters.type) p.set('type', newFilters.type);
        if (newFilters.minCost !== undefined) p.set('minCost', String(newFilters.minCost));
        if (newFilters.maxCost !== undefined) p.set('maxCost', String(newFilters.maxCost));
        if (newFilters.keywords?.length) p.set('keyword', newFilters.keywords[0]);
        if (newFilters.classifications?.length) p.set('classification', newFilters.classifications[0]);
        if (newFilters.setCode) p.set('set', newFilters.setCode);
      });
    },
    [updateParams],
  );

  const clearAllFilters = useCallback(() => {
    setSearchParams({}, {replace: true});
  }, [setSearchParams]);

  return {
    searchQuery,
    setSearchQuery,
    inkFilter,
    setInkFilter,
    filters,
    setFilters,
    clearAllFilters,
    activeFilterCount,
  };
}
