import type {Ink} from 'inkweave-synergy-engine';
import {
  cardMatchesType,
  matchesClassifications,
  matchesInk,
  matchesInkwell,
  matchesKeywords,
  matchesRarity,
  matchesSet,
  offersDualOnly,
  type CardFilterOptions,
} from '../../cards/loader';
import type {CardTypeFilter} from '../../../shared/constants';
import type {SynergyMatchDisplay} from '../types';
import {getStrengthTier} from './scoreUtils';
import type {StrengthTierLabel} from './scoreUtils';

/** Strength tier labels used for filtering synergy results (Perfect folds into Strong). */
export type StrengthTierFilter = Exclude<StrengthTierLabel, 'Perfect'>;

/** Exhaustive mapping from display tier to filter tier. Compiler-checked: adding a new tier forces an update. */
const TIER_TO_FILTER: Record<StrengthTierLabel, StrengthTierFilter> = {
  Perfect: 'Strong',
  Strong: 'Strong',
  Moderate: 'Moderate',
  Weak: 'Weak',
};

/** All filter dimensions available in the synergy expanded view. */
export interface SynergyFilterState {
  inkFilters: Ink[];
  typeFilters: CardTypeFilter[];
  costFilters: number[];
  filters: CardFilterOptions;
  strengthFilters: StrengthTierFilter[];
}

/** Default empty filter state. Frozen to prevent accidental mutation of the shared reference. */
export const EMPTY_SYNERGY_FILTERS: SynergyFilterState = Object.freeze({
  inkFilters: [] as Ink[],
  typeFilters: [] as CardTypeFilter[],
  costFilters: [] as number[],
  filters: {} as CardFilterOptions,
  strengthFilters: [] as StrengthTierFilter[],
});

/**
 * Check whether a synergy score falls into any of the selected strength tiers.
 * Perfect (≥9.5) is folded into the Strong tier for filtering,
 * so selecting "Strong" also includes Perfect results.
 */
function matchesStrengthFilter(score: number, strengthFilters: StrengthTierFilter[]): boolean {
  const tier = getStrengthTier(score);
  return strengthFilters.includes(TIER_TO_FILTER[tier.label]);
}

type SynergyPredicate = (match: SynergyMatchDisplay, state: SynergyFilterState) => boolean;

/**
 * Ink and inkwell: BROWSE'S OWN RULES (`matchesInk`, `matchesInkwell`), so a card
 * page's synergies and the Browse grid answer the same selection identically. This
 * used to check the primary ink only, so a dual-ink card showed under one of its
 * inks and not the other, and it never read inkwell at all, though the drawer
 * offered it.
 */
function matchesSynergyInks({card}: SynergyMatchDisplay, {inkFilters, filters}: SynergyFilterState): boolean {
  return matchesInk(card, {ink: inkFilters, inkMatch: filters.inkMatch}) && matchesInkwell(card, filters);
}

/** Type: Browse's own rule (`cardMatchesType`), so Action means the actions that are not Songs. */
function matchesSynergyType({card}: SynergyMatchDisplay, {typeFilters}: SynergyFilterState): boolean {
  return typeFilters.length === 0 || typeFilters.some((type) => cardMatchesType(card, type));
}

// Discrete selection; cost 9 means "9 or higher" (matches browse behavior).
function matchesSynergyCost({card}: SynergyMatchDisplay, {costFilters}: SynergyFilterState): boolean {
  return costFilters.length === 0 || costFilters.some((c) => (c >= 9 ? card.cost >= 9 : card.cost === c));
}

function matchesSynergyStrength({score}: SynergyMatchDisplay, {strengthFilters}: SynergyFilterState): boolean {
  return strengthFilters.length === 0 || matchesStrengthFilter(score, strengthFilters);
}

/**
 * Rarity, keywords and classifications: Browse's rules too (owner, 2026-10-08):
 * any picked rarity, and every picked keyword and classification. Keywords and
 * classifications read only the first pick while the filter offered one at a
 * time, a dropdown.
 */
function matchesSynergyTraits({card}: SynergyMatchDisplay, {filters}: SynergyFilterState): boolean {
  return matchesRarity(card, filters) && matchesKeywords(card, filters) && matchesClassifications(card, filters);
}

// Any picked set: Browse's rule.
function matchesSynergySet({card}: SynergyMatchDisplay, {filters}: SynergyFilterState): boolean {
  return matchesSet(card, filters);
}

const SYNERGY_PREDICATES: SynergyPredicate[] = [
  matchesSynergyInks,
  matchesSynergyType,
  matchesSynergyCost,
  matchesSynergyStrength,
  matchesSynergyTraits,
  matchesSynergySet,
];

/** Whether any dimension restricts anything, so an idle filter returns the input untouched. */
function hasAnySynergyFilter({inkFilters, typeFilters, costFilters, filters, strengthFilters}: SynergyFilterState) {
  return [
    inkFilters.length,
    typeFilters.length,
    costFilters.length,
    strengthFilters.length,
    filters.keywords?.length,
    filters.classifications?.length,
    filters.setCodes?.length,
    filters.rarities?.length,
    filters.inkwell,
  ].some(Boolean);
}

/**
 * The state with the Dual-ink cards mode switched off when its ink selection no longer
 * offers it (none, or three or more inks), the synergy twin of Browse's URL
 * cleanup in `useFilterParams`. Left on out of sight, it would come back on,
 * unasked, for the next selection that offers it. Unchanged state is returned
 * as is, so an idle write is not a new object.
 */
export function withoutStaleDualOnly(state: SynergyFilterState): SynergyFilterState {
  if (!state.filters.inkMatch || offersDualOnly(new Set(state.inkFilters).size)) return state;
  return {...state, filters: {...state.filters, inkMatch: undefined}};
}

/**
 * Filter synergy matches by card attributes and strength tier.
 *
 * Dimensions are AND'd (all must pass). Within one, values are OR'd, except ink,
 * which follows Browse's rule (see `matchesSynergyInks`). An empty filter array
 * for any dimension means "no restriction" (pass all).
 */
export function filterSynergyCards(
  synergies: SynergyMatchDisplay[],
  state: SynergyFilterState,
): SynergyMatchDisplay[] {
  if (!hasAnySynergyFilter(state)) return synergies;
  return synergies.filter((match) => SYNERGY_PREDICATES.every((matches) => matches(match, state)));
}
