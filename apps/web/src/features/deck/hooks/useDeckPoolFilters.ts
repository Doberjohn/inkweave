// Local (non-URL) filter state for the deck-builder card pool, plus the pure
// filter/sort pipeline it feeds. It mirrors useFilterParams' return shape so
// BrowseToolbar and FilterDialog accept it verbatim — but the state lives in
// component state, never the URL: pool filtering is ephemeral UI and must not
// collide with the (shareable) deck URL. useFilterParams' clearAllFilters wipes
// the WHOLE query string, which is exactly why it can't be reused here.

import {useState} from 'react';
import {getInks} from 'inkweave-synergy-engine';
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

/**
 * Merge the inline facets (type/cost) into the dialog-driven CardFilterOptions.
 * Ink is deliberately NOT delegated here — the pool applies its own AND-style ink
 * gate in {@link applyPoolFilters}, unlike Browse's shared either-ink matching.
 */
function buildCombinedFilters(
  base: CardFilterOptions,
  types: CardTypeFilter[],
  costs: number[],
): CardFilterOptions {
  const combined: CardFilterOptions = {...base};
  if (types.length > 0) combined.type = types;
  if (costs.length > 0) combined.costs = costs;
  return combined;
}

/**
 * Pure: apply the pool's search + filters + sort to the card list. Same pipeline
 * BrowsePage uses, so pool results match Browse exactly.
 */
export function applyPoolFilters(cards: LorcanaCard[], state: PoolFilterState): LorcanaCard[] {
  const combined = buildCombinedFilters(state.filters, state.typeFilters, state.costFilters);
  let result = cards;
  if (state.searchQuery.trim()) result = searchCardsByName(result, state.searchQuery);
  if (Object.keys(combined).length > 0) result = filterCards(result, combined);
  // Pool ink gate deviates from Browse's shared either-ink OR semantics: a legal
  // deck holds exactly two inks, so once BOTH are chosen a dual-ink card must fit
  // entirely inside them (an outside ink would be an illegal third). Browse's
  // matchesInk can't express this, so gate ink locally rather than delegating it.
  if (state.inkFilters.length > 0) {
    const selected = state.inkFilters;
    result = result.filter((card) => {
      const inks = getInks(card);
      // Two inks chosen = the deck's inks are decided, so a card must fit ENTIRELY
      // inside them (a dual with an outside ink would be a third ink).
      // One ink chosen = the second slot is still open, so a dual containing it is legal.
      return selected.length >= 2
        ? inks.every((i) => selected.includes(i))
        : inks.some((i) => selected.includes(i));
    });
  }
  return applySortOrder(result, state.sortOrder);
}
