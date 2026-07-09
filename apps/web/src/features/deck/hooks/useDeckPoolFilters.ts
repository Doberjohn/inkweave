// Local (non-URL) filter state for the deck-builder card pool, plus the pure
// filter/sort pipeline it feeds. It mirrors useFilterParams' return shape so
// BrowseToolbar and FilterDialog accept it verbatim — but the state lives in
// component state, never the URL: pool filtering is ephemeral UI and must not
// collide with the (shareable) deck URL. useFilterParams' clearAllFilters wipes
// the WHOLE query string, which is exactly why it can't be reused here.

import {useState} from 'react';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {
  searchCardsByName,
  filterCards,
  applySortOrder,
  type CardFilterOptions,
} from '../../cards/loader';
import type {CardTypeFilter, BrowseSortOrder} from '../../../shared/constants';
import type {UseFilterParamsReturn} from '../../../shared/hooks/useFilterParams';

/** Toggle an item in an array: remove if present, append if absent. */
function toggleItem<T>(items: T[], item: T): T[] {
  return items.includes(item) ? items.filter((i) => i !== item) : [...items, item];
}

export function useDeckPoolFilters(): UseFilterParamsReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [inkFilters, setInkFilters] = useState<Ink[]>([]);
  const [typeFilters, setTypeFilters] = useState<CardTypeFilter[]>([]);
  const [costFilters, setCostFilters] = useState<number[]>([]);
  const [filters, setFilters] = useState<CardFilterOptions>({});
  const [sortOrder, setSortOrder] = useState<BrowseSortOrder>('newest');

  const activeFilterCount =
    inkFilters.length +
    typeFilters.length +
    costFilters.length +
    [filters.keywords?.length, filters.classifications?.length, filters.setCode, filters.inkwell].filter(
      Boolean,
    ).length;

  return {
    searchQuery,
    setSearchQuery,
    inkFilters,
    toggleInk: (ink) => setInkFilters((prev) => toggleItem(prev, ink)),
    typeFilters,
    toggleType: (type) => setTypeFilters((prev) => toggleItem(prev, type)),
    costFilters,
    toggleCost: (cost) => setCostFilters((prev) => toggleItem(prev, cost)),
    clearCosts: () => setCostFilters([]),
    filters,
    setFilters,
    replaceFilters: (inks, types, costs, opts) => {
      setInkFilters(inks);
      setTypeFilters(types);
      setCostFilters(costs);
      setFilters(opts);
    },
    clearAllFilters: () => {
      setSearchQuery('');
      setInkFilters([]);
      setTypeFilters([]);
      setCostFilters([]);
      setFilters({});
    },
    activeFilterCount,
    sortOrder,
    setSortOrder,
  };
}

/** Filter state shape consumed by {@link applyPoolFilters}. */
export interface PoolFilterState {
  searchQuery: string;
  inkFilters: Ink[];
  typeFilters: CardTypeFilter[];
  costFilters: number[];
  filters: CardFilterOptions;
  sortOrder: BrowseSortOrder;
}

/** Merge the inline facets (ink/type/cost) into the dialog-driven CardFilterOptions. */
function buildCombinedFilters(
  base: CardFilterOptions,
  inks: Ink[],
  types: CardTypeFilter[],
  costs: number[],
): CardFilterOptions {
  const combined: CardFilterOptions = {...base};
  if (inks.length > 0) combined.ink = inks;
  if (types.length > 0) combined.type = types;
  if (costs.length > 0) combined.costs = costs;
  return combined;
}

/**
 * Pure: apply the pool's search + filters + sort to the card list. Same pipeline
 * BrowsePage uses, so pool results match Browse exactly.
 */
export function applyPoolFilters(cards: LorcanaCard[], state: PoolFilterState): LorcanaCard[] {
  const combined = buildCombinedFilters(
    state.filters,
    state.inkFilters,
    state.typeFilters,
    state.costFilters,
  );
  let result = cards;
  if (state.searchQuery.trim()) result = searchCardsByName(result, state.searchQuery);
  if (Object.keys(combined).length > 0) result = filterCards(result, combined);
  return applySortOrder(result, state.sortOrder);
}
