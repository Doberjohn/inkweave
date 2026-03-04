import type {Ink} from 'lorcana-synergy-engine';
import type {CardFilterOptions} from '../../cards/loader';
import type {CardTypeFilter} from '../../../shared/constants';
import type {SynergyMatchDisplay} from '../types';
import {getStrengthTier} from './scoreUtils';
import type {StrengthTierLabel} from './scoreUtils';

/** Strength tier labels used for filtering synergy results. */
export type StrengthTierFilter = 'Strong' | 'Moderate' | 'Weak';

/** Exhaustive mapping from display tier to filter tier. Compiler-checked — adding a new tier forces an update. */
const TIER_TO_FILTER: Record<StrengthTierLabel, StrengthTierFilter> = {
  'Build-around': 'Strong',
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

export const EMPTY_SYNERGY_FILTERS: SynergyFilterState = {
  inkFilters: [],
  typeFilters: [],
  costFilters: [],
  filters: {},
  strengthFilters: [],
};

/**
 * Check whether a synergy score falls into any of the selected strength tiers.
 * Build-around (≥9.5) is folded into the Strong tier for filtering —
 * selecting "Strong" also includes Build-around results.
 */
function matchesStrengthFilter(score: number, strengthFilters: StrengthTierFilter[]): boolean {
  const tier = getStrengthTier(score);
  return strengthFilters.includes(TIER_TO_FILTER[tier.label]);
}

/**
 * Filter synergy matches by card attributes and strength tier.
 *
 * Dimensions are AND'd (all must pass); values within a dimension are OR'd.
 * An empty filter array for any dimension means "no restriction" (pass all).
 */
export function filterSynergyCards(
  synergies: SynergyMatchDisplay[],
  state: SynergyFilterState,
): SynergyMatchDisplay[] {
  const {inkFilters, typeFilters, costFilters, filters, strengthFilters} = state;

  // Short-circuit: no filters active
  const hasAnyFilter =
    inkFilters.length > 0 ||
    typeFilters.length > 0 ||
    costFilters.length > 0 ||
    strengthFilters.length > 0 ||
    Boolean(filters.keywords?.length) ||
    Boolean(filters.classifications?.length) ||
    Boolean(filters.setCode);
  if (!hasAnyFilter) return synergies;

  return synergies.filter(({card, score}) => {
    // Ink: card's primary ink must be in selected set
    if (inkFilters.length > 0 && !inkFilters.includes(card.ink)) return false;

    // Type: handle Song pseudo-type (Action with isSong flag)
    if (typeFilters.length > 0) {
      const matchesType = typeFilters.some((t) => {
        if (t === 'Song') return card.isSong === true;
        return card.type === t;
      });
      if (!matchesType) return false;
    }

    // Cost: discrete selection; cost 9 means "9 or higher" (matches browse behavior)
    if (costFilters.length > 0) {
      const matchesCost = costFilters.some((c) => (c >= 9 ? card.cost >= 9 : card.cost === c));
      if (!matchesCost) return false;
    }

    // Strength tier
    if (strengthFilters.length > 0 && !matchesStrengthFilter(score, strengthFilters)) return false;

    // Keyword: first selected only (case-insensitive substring)
    if (filters.keywords?.length) {
      const kw = filters.keywords[0].toLowerCase();
      const hasKeyword = card.keywords?.some((k) => k.toLowerCase().includes(kw));
      if (!hasKeyword) return false;
    }

    // Classification: first selected only (case-insensitive exact match)
    if (filters.classifications?.length) {
      const cls = filters.classifications[0].toLowerCase();
      const hasClass = card.classifications?.some((c) => c.toLowerCase() === cls);
      if (!hasClass) return false;
    }

    // Set
    if (filters.setCode && card.setCode !== filters.setCode) return false;

    return true;
  });
}
