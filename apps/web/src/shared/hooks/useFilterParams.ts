import {useMemo, useCallback} from 'react';
import {useSearchParams} from 'react-router-dom';
import type {Ink} from '../../features/cards';
import type {CardFilterOptions} from '../../features/cards/loader';
import type {CardTypeFilter, BrowseSortOrder} from '../constants';

const VALID_INKS = new Set<string>(['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel']);
const VALID_TYPES = new Set<string>(['Character', 'Action', 'Song', 'Item', 'Location']);

function isValidInk(value: string): value is Ink {
  return VALID_INKS.has(value);
}

function isValidType(value: string): value is CardTypeFilter {
  return VALID_TYPES.has(value);
}

const VALID_COSTS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
const VALID_SORTS = new Set<string>(['newest', 'name-asc', 'name-desc', 'cost-asc', 'cost-desc']);

function isValidCost(value: string): boolean {
  const n = Number(value);
  return VALID_COSTS.has(n);
}

function parseCostParam(raw: string | null): number[] {
  if (!raw) return [];
  return raw.split(',').filter(isValidCost).map(Number);
}

/** Set a URL param if the value is non-empty, otherwise delete it. */
function setOrDelete(params: URLSearchParams, key: string, value: string): void {
  if (value) params.set(key, value);
  else params.delete(key);
}

/** Serialize CardFilterOptions into URL params (keyword, classification, set). */
function serializeFilterOptions(params: URLSearchParams, opts: CardFilterOptions): void {
  params.delete('keyword');
  params.delete('classification');
  params.delete('set');
  if (opts.keywords?.length) params.set('keyword', opts.keywords[0]);
  if (opts.classifications?.length) params.set('classification', opts.classifications[0]);
  if (opts.setCode) params.set('set', opts.setCode);
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
  replaceFilters: (
    inks: Ink[],
    types: CardTypeFilter[],
    costs: number[],
    opts: CardFilterOptions,
  ) => void;
  clearAllFilters: () => void;
  activeFilterCount: number;
  sortOrder: BrowseSortOrder;
  setSortOrder: (order: BrowseSortOrder) => void;
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

  const sortOrder: BrowseSortOrder = useMemo(() => {
    const raw = searchParams.get('sort');
    return raw && VALID_SORTS.has(raw) ? (raw as BrowseSortOrder) : 'newest';
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
        const next = current.includes(cost)
          ? current.filter((c) => c !== cost)
          : [...current, cost];
        if (next.length > 0) p.set('cost', next.join(','));
        else p.delete('cost');
      });
    },
    [updateParams],
  );

  const setFilters = useCallback(
    (newFilters: CardFilterOptions) => {
      updateParams((p) => serializeFilterOptions(p, newFilters));
    },
    [updateParams],
  );

  const replaceFilters = useCallback(
    (inks: Ink[], types: CardTypeFilter[], costs: number[], opts: CardFilterOptions) => {
      updateParams((p) => {
        setOrDelete(p, 'ink', inks.join(','));
        setOrDelete(p, 'type', types.join(','));
        setOrDelete(p, 'cost', costs.join(','));
        serializeFilterOptions(p, opts);
      });
    },
    [updateParams],
  );

  const setSortOrder = useCallback(
    (order: BrowseSortOrder) => {
      updateParams((p) => {
        if (order === 'newest') p.delete('sort');
        else p.set('sort', order);
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
    replaceFilters,
    clearAllFilters,
    activeFilterCount,
    sortOrder,
    setSortOrder,
  };
}
