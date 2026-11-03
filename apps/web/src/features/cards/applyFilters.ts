import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {Ink} from './types';
import {filterCards, searchCardsByName, type CardFilterOptions} from './loader';
import type {CardTypeFilter} from '../../shared/constants';

/**
 * The page's filter options with its ink, type and cost picks folded in: the one set of options
 * `applyFilters` runs. Browse's listing and a binder's rules both build theirs here, so
 * a binder holds exactly what the same filters hold on the page.
 */
export function buildCombinedFilters(
  base: CardFilterOptions,
  inkFilters: Ink[],
  typeFilters: CardTypeFilter[],
  costFilters: number[],
): CardFilterOptions {
  const combined: CardFilterOptions = {...base};
  if (inkFilters.length > 0) combined.ink = inkFilters;
  if (typeFilters.length > 0) combined.type = typeFilters;
  if (costFilters.length > 0) combined.costs = costFilters;
  return combined;
}

/** The cards a search and the combined filters let through, in the order given. */
export function applyFilters(cards: LorcanaCard[], searchQuery: string, combinedFilters: CardFilterOptions): LorcanaCard[] {
  let result = cards;
  if (searchQuery.trim()) result = searchCardsByName(result, searchQuery);
  if (Object.keys(combinedFilters).length > 0) result = filterCards(result, combinedFilters);
  return result;
}
