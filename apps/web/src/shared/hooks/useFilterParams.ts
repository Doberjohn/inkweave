import {useMemo, useCallback} from 'react';
import {useSearchParams} from 'react-router-dom';
import type {Ink} from '../../features/cards';
import type {CardFilterOptions} from '../../features/cards/loader';
import type {CardTypeFilter} from '../constants/theme';

const VALID_INKS = new Set<string>(['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel']);
const VALID_TYPES = new Set<string>(['Character', 'Action', 'Song', 'Item', 'Location']);

function isValidInk(value: string): value is Ink {
  return VALID_INKS.has(value);
}

function isValidType(value: string): value is CardTypeFilter {
  return VALID_TYPES.has(value);
}

const VALID_COSTS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);

function isValidCost(value: string): boolean {
  const n = Number(value);
  return VALID_COSTS.has(n);
}

function parseCostParam(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .filter(isValidCost)
    .map(Number);
}

/** Parse comma-separated values from a URL param, filtering by validator */
function parseCommaSeparated<T extends string>(
  raw: string | null,
  isValid: (v: string) => v is T,
): T[] {
  if (!raw) return [];
  return raw.split(',').filter(isValid);
}

export interface UseFilterParamsReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  inkFilters: Ink[];
  toggleInk: (ink: Ink) => void;
  typeFilters: CardTypeFilter[];
  toggleType: (type: CardTypeFilter) => void;
  costFilters: number[];
  toggleCost: (cost: number) => void;
  filters: CardFilterOptions;
  setFilters: (filters: CardFilterOptions) => void;
  clearAllFilters: () => void;
  activeFilterCount: number;
}

export function useFilterParams(): UseFilterParamsReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read filter state from URL params
  const searchQuery = searchParams.get('q') ?? '';

  const inkFilters: Ink[] = useMemo(
    () => parseCommaSeparated(searchParams.get('ink'), isValidInk),
    [searchParams],
  );

  const typeFilters: CardTypeFilter[] = useMemo(
    () => parseCommaSeparated(searchParams.get('type'), isValidType),
    [searchParams],
  );

  const costFilters: number[] = useMemo(
    () => parseCostParam(searchParams.get('cost')),
    [searchParams],
  );

  const filters: CardFilterOptions = useMemo(() => {
    const f: CardFilterOptions = {};
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
      inkFilters.length +
      typeFilters.length +
      costFilters.length +
      [filters.keywords?.length, filters.classifications?.length, filters.setCode].filter(Boolean)
        .length,
    [inkFilters, typeFilters, costFilters, filters],
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

  const toggleInk = useCallback(
    (ink: Ink) => {
      updateParams((p) => {
        const current = parseCommaSeparated(p.get('ink'), isValidInk);
        const next = current.includes(ink) ? current.filter((i) => i !== ink) : [...current, ink];
        if (next.length > 0) p.set('ink', next.join(','));
        else p.delete('ink');
      });
    },
    [updateParams],
  );

  const toggleType = useCallback(
    (type: CardTypeFilter) => {
      updateParams((p) => {
        const current = parseCommaSeparated(p.get('type'), isValidType);
        const next = current.includes(type)
          ? current.filter((t) => t !== type)
          : [...current, type];
        if (next.length > 0) p.set('type', next.join(','));
        else p.delete('type');
      });
    },
    [updateParams],
  );

  const toggleCost = useCallback(
    (cost: number) => {
      updateParams((p) => {
        const current = parseCostParam(p.get('cost'));
        const next = current.includes(cost) ? current.filter((c) => c !== cost) : [...current, cost];
        if (next.length > 0) p.set('cost', next.join(','));
        else p.delete('cost');
      });
    },
    [updateParams],
  );

  const setFilters = useCallback(
    (newFilters: CardFilterOptions) => {
      updateParams((p) => {
        // Clear non-ink/type/cost filter params
        p.delete('keyword');
        p.delete('classification');
        p.delete('set');
        // Set new values
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
    inkFilters,
    toggleInk,
    typeFilters,
    toggleType,
    costFilters,
    toggleCost,
    filters,
    setFilters,
    clearAllFilters,
    activeFilterCount,
  };
}
