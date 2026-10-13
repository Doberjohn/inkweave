import {
  ALL_INKS,
  CARD_TYPE_FILTERS,
  COST_BUTTONS,
  type CardTypeFilter,
} from '../../shared/constants';
import {anyCardMatches, type CardFilterOptions, type SetInfo} from './loader';
import type {Ink, LorcanaCard} from './types';

export type InkwellFilter = NonNullable<CardFilterOptions['inkwell']>;

/** The values each filter button group shows: ink, cost, card type and inkwell. */
export interface FilterButtonOptions {
  inks: readonly Ink[];
  costs: readonly number[];
  types: readonly CardTypeFilter[];
  inkwell: readonly InkwellFilter[];
}

/** The lists behind the filter dialog's Keyword, Classification and Set dropdowns. */
export interface FilterSelectOptions {
  keywords: string[];
  classifications: string[];
  sets: SetInfo[];
}

/** Every filter option a page offers: the button groups plus the dropdowns. */
export interface FilterOptions extends FilterSelectOptions {
  buttons: FilterButtonOptions;
}

/** The filters a page has applied: the toolbar's toggles plus the dialog's other fields. */
export interface AppliedFilters {
  inks: Ink[];
  types: CardTypeFilter[];
  costs: number[];
  filters: CardFilterOptions;
}

export const ALL_FILTER_BUTTONS: FilterButtonOptions = {
  inks: ALL_INKS,
  costs: COST_BUTTONS,
  types: CARD_TYPE_FILTERS,
  inkwell: ['inkable', 'uninkable'],
};

// A value stays when it matches a card in the pool, or when it is already applied, so an
// active filter (from a shared link, say) never disappears from the control that clears it.
function keepOffered<T>(
  values: readonly T[],
  applied: readonly T[],
  matches: (value: T) => boolean,
): T[] {
  return values.filter((value) => applied.includes(value) || matches(value));
}

function listOf<T>(value: T | undefined): T[] {
  return value === undefined ? [] : [value];
}

/**
 * Narrows the filter options to the values a fixed card pool (a playstyle's cards) can
 * match, so no option on its own empties the grid. `all` holds the site-wide dropdown
 * lists the pool narrows. An empty pool means its cards are still loading: every option
 * stays, so the toolbar keeps its usual layout until they arrive.
 */
export function getPoolFilterOptions(
  cards: LorcanaCard[],
  applied: AppliedFilters,
  all: FilterSelectOptions,
): FilterOptions {
  if (cards.length === 0) return {...all, buttons: ALL_FILTER_BUTTONS};
  const matches = (options: CardFilterOptions) => anyCardMatches(cards, options);
  const {filters} = applied;
  const {inks, costs, types, inkwell} = ALL_FILTER_BUTTONS;
  return {
    buttons: {
      inks: keepOffered(inks, applied.inks, (ink) => matches({ink: [ink]})),
      costs: keepOffered(costs, applied.costs, (cost) => matches({costs: [cost]})),
      types: keepOffered(types, applied.types, (type) => matches({type: [type]})),
      inkwell: keepOffered(inkwell, listOf(filters.inkwell), (value) => matches({inkwell: value})),
    },
    keywords: keepOffered(all.keywords, filters.keywords ?? [], (keyword) =>
      matches({keywords: [keyword]}),
    ),
    classifications: keepOffered(all.classifications, filters.classifications ?? [], (c) =>
      matches({classifications: [c]}),
    ),
    sets: all.sets.filter((set) => set.code === filters.setCode || matches({setCode: set.code})),
  };
}
