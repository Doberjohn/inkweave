import {useTransition} from 'react';
import {useSearchParams} from 'react-router-dom';
import type {Ink} from '../../features/cards';
import {countFilterOptions, offersDualOnly, type CardFilterOptions} from '../../features/cards/loader';
import type {CardTypeFilter, BrowseSortOrder} from '../constants';
import {BROWSE_SORT_OPTIONS} from '../constants';
import type {InkwellValue} from '../components/InkwellIcon';
import {trackEvent} from '../lib/analytics';

const VALID_INKS = new Set<string>(['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel']);
const VALID_TYPES = new Set<string>(['Character', 'Action', 'Song', 'Item', 'Location']);

function isValidInk(value: string): value is Ink {
  return VALID_INKS.has(value);
}

function isValidType(value: string): value is CardTypeFilter {
  return VALID_TYPES.has(value);
}

const VALID_INKWELL = new Set<string>(['inkable', 'uninkable']);

function isValidInkwell(value: string): value is InkwellValue {
  return VALID_INKWELL.has(value);
}

const VALID_COSTS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
const VALID_SORTS = new Set<string>(BROWSE_SORT_OPTIONS.map((o) => o.value));

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

/**
 * A comma-separated list param, as `ink` and `type` already are: keyword,
 * classification and set hold several values since the chips and set logos
 * (owner, 2026-10-08). An old single-value link still reads, as a list of one.
 * Undefined when empty.
 */
function parseList(raw: string | null): string[] | undefined {
  const values = raw ? raw.split(',').filter(Boolean) : [];
  return values.length > 0 ? values : undefined;
}

/**
 * The set filter's param. Exported for collection mode, which keeps no set filter: it
 * opens the set one names and drops it, since its set is chosen in the collection panel.
 */
export const SET_PARAM = 'set';

/**
 * Every CardFilterOptions field the URL carries: its param, how to read it, and how
 * to write it (an empty value deletes the param). One table for both directions, so a
 * new option cannot be read without being written, or the other way round.
 */
const OPTION_PARAMS: readonly {
  param: string;
  read: (raw: string | null) => Partial<CardFilterOptions>;
  write: (options: CardFilterOptions) => string | undefined;
}[] = [
  {param: 'keyword', read: (raw) => ({keywords: parseList(raw)}), write: (o) => o.keywords?.join(',')},
  {param: 'classification', read: (raw) => ({classifications: parseList(raw)}), write: (o) => o.classifications?.join(',')},
  {param: SET_PARAM, read: (raw) => ({setCodes: parseList(raw)}), write: (o) => o.setCodes?.join(',')},
  {param: 'rarity', read: (raw) => ({rarities: parseList(raw)}), write: (o) => o.rarities?.join(',')},
  {param: 'inkwell', read: (raw) => ({inkwell: raw && isValidInkwell(raw) ? raw : undefined}), write: (o) => o.inkwell},
  {param: 'inkmatch', read: (raw) => ({inkMatch: raw === 'dual' ? 'dual' : undefined}), write: (o) => o.inkMatch},
];

/** Serialize CardFilterOptions into their URL params. */
function serializeFilterOptions(params: URLSearchParams, opts: CardFilterOptions): void {
  for (const {param, write} of OPTION_PARAMS) setOrDelete(params, param, write(opts) ?? '');
}

/** CardFilterOptions from the URL, holding only the options it carries: an empty URL reads as `{}`. */
function parseFilterOptions(params: URLSearchParams): CardFilterOptions {
  const options = Object.assign({}, ...OPTION_PARAMS.map((field) => field.read(params.get(field.param))));
  return Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined));
}

/**
 * Switch the Dual-ink cards mode off once the ink selection no longer offers it
 * (none, or three or more inks), the moment its switch disappears. Run after
 * EVERY write, so no path (a third ink, clearing them, the dialog's Apply) can
 * strand it out of sight: left in the URL it would come back on, unasked, for the
 * next selection. The filter itself ignores it there too; this keeps the URL
 * honest.
 */
function dropDualOnlyWhenNotOffered(params: URLSearchParams): void {
  const inkCount = new Set(parseCommaSeparated(params.get('ink'), isValidInk)).size;
  if (!offersDualOnly(inkCount)) params.delete('inkmatch');
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
  clearCosts: () => void;
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

  const inkFilters: Ink[] = parseCommaSeparated(searchParams.get('ink'), isValidInk);

  const typeFilters: CardTypeFilter[] = parseCommaSeparated(searchParams.get('type'), isValidType);

  const costFilters: number[] = parseCostParam(searchParams.get('cost'));

  const filters = parseFilterOptions(searchParams);

  const sortOrder: BrowseSortOrder = (() => {
    const raw = searchParams.get('sort');
    return raw && VALID_SORTS.has(raw) ? (raw as BrowseSortOrder) : 'newest';
  })();

  // Every picked value counts, as each ink and type already does (see countFilterOptions).
  const activeFilterCount = inkFilters.length + typeFilters.length + costFilters.length + countFilterOptions(filters);

  // Mark all filter/sort updates as non-urgent so filter buttons stay responsive
  // while the card grid re-renders with the new filters in the background.
  const [, startTransition] = useTransition();

  // Write helpers (all use replace to avoid history pollution)
  const updateParams = (updater: (params: URLSearchParams) => void) => {
    startTransition(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          updater(next);
          dropDualOnlyWhenNotOffered(next);
          return next;
        },
        {replace: true},
      );
    });
  };

  const setSearchQuery = (query: string) => {
    updateParams((p) => {
      if (query) p.set('q', query);
      else p.delete('q');
    });
  };

  const toggleInk = (ink: Ink) => {
    trackEvent('filter_applied', {facet: 'ink', value: ink, action: inkFilters.includes(ink) ? 'remove' : 'add'});
    updateParams((p) => {
      const current = parseCommaSeparated(p.get('ink'), isValidInk);
      const next = current.includes(ink) ? current.filter((i) => i !== ink) : [...current, ink];
      if (next.length > 0) p.set('ink', next.join(','));
      else p.delete('ink');
    });
  };

  const toggleType = (type: CardTypeFilter) => {
    trackEvent('filter_applied', {facet: 'type', value: type, action: typeFilters.includes(type) ? 'remove' : 'add'});
    updateParams((p) => {
      const current = parseCommaSeparated(p.get('type'), isValidType);
      const next = current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type];
      if (next.length > 0) p.set('type', next.join(','));
      else p.delete('type');
    });
  };

  const toggleCost = (cost: number) => {
    trackEvent('filter_applied', {facet: 'cost', value: String(cost), action: costFilters.includes(cost) ? 'remove' : 'add'});
    updateParams((p) => {
      const current = parseCostParam(p.get('cost'));
      const next = current.includes(cost)
        ? current.filter((c) => c !== cost)
        : [...current, cost];
      if (next.length > 0) p.set('cost', next.join(','));
      else p.delete('cost');
    });
  };

  // Clear every selected cost in one atomic param update. A loop of toggleCost
  // would be unreliable: each functional setSearchParams reads the current
  // committed params, so synchronous calls all see the same state.
  const clearCosts = () => {
    updateParams((p) => p.delete('cost'));
  };

  const setFilters = (newFilters: CardFilterOptions) => {
    updateParams((p) => serializeFilterOptions(p, newFilters));
  };

  const replaceFilters = (
    inks: Ink[],
    types: CardTypeFilter[],
    costs: number[],
    opts: CardFilterOptions,
  ) => {
    updateParams((p) => {
      setOrDelete(p, 'ink', inks.join(','));
      setOrDelete(p, 'type', types.join(','));
      setOrDelete(p, 'cost', costs.join(','));
      serializeFilterOptions(p, opts);
    });
  };

  const setSortOrder = (order: BrowseSortOrder) => {
    if (order !== sortOrder) {
      trackEvent('sort_changed', {sortOrder: order, previousSort: sortOrder});
    }
    updateParams((p) => {
      if (order === 'newest') p.delete('sort');
      else p.set('sort', order);
    });
  };

  const clearAllFilters = () => {
    startTransition(() => {
      setSearchParams({}, {replace: true});
    });
  };

  return {
    searchQuery,
    setSearchQuery,
    inkFilters,
    toggleInk,
    typeFilters,
    toggleType,
    costFilters,
    toggleCost,
    clearCosts,
    filters,
    setFilters,
    replaceFilters,
    clearAllFilters,
    activeFilterCount,
    sortOrder,
    setSortOrder,
  };
}
