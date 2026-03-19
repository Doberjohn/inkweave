import {useState} from 'react';
import type {Ink} from '../../features/cards';
import type {CardFilterOptions} from '../../features/cards/loader';
import type {CardTypeFilter} from '../constants';

interface UseDraftFiltersParams {
  /** When true, draft state resets to match committed props */
  isOpen: boolean;
  /** Committed filter state from URL params */
  inkFilters: Ink[];
  typeFilters: CardTypeFilter[];
  costFilters: number[];
  filters: CardFilterOptions;
}

/** Toggle an item in an array: remove if present, append if absent. */
function toggleItem<T>(items: T[], item: T): T[] {
  return items.includes(item) ? items.filter((i) => i !== item) : [...items, item];
}

/**
 * Manages local draft filter state for modal/drawer UIs.
 * Snapshots committed state when the modal opens; all toggles modify
 * draft state only. Call the returned values' parent `onApply` to commit.
 */
export function useDraftFilters({
  isOpen,
  inkFilters,
  typeFilters,
  costFilters,
  filters,
}: UseDraftFiltersParams) {
  const [draftInks, setDraftInks] = useState<Ink[]>(inkFilters);
  const [draftTypes, setDraftTypes] = useState<CardTypeFilter[]>(typeFilters);
  const [draftCosts, setDraftCosts] = useState<number[]>(costFilters);
  const [draftFilters, setDraftFilters] = useState<CardFilterOptions>(filters);

  // Snapshot committed state on the open transition (previous-value pattern per React docs)
  const [prevIsOpen, setPrevIsOpen] = useState(false);
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setDraftInks(inkFilters);
    setDraftTypes(typeFilters);
    setDraftCosts(costFilters);
    setDraftFilters(filters);
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  const toggleInk = (ink: Ink) => {
    setDraftInks((prev) => toggleItem(prev, ink));
  };

  const toggleType = (type: CardTypeFilter) => {
    setDraftTypes((prev) => toggleItem(prev, type));
  };

  const toggleCost = (cost: number) => {
    setDraftCosts((prev) => toggleItem(prev, cost));
  };

  const clearAll = () => {
    setDraftInks([]);
    setDraftTypes([]);
    setDraftCosts([]);
    setDraftFilters({});
  };

  const activeFilterCount =
    draftInks.length +
    draftTypes.length +
    draftCosts.length +
    [
      draftFilters.keywords?.length,
      draftFilters.classifications?.length,
      draftFilters.setCode,
    ].filter(Boolean).length;

  return {
    draftInks,
    draftTypes,
    draftCosts,
    draftFilters,
    activeFilterCount,
    toggleInk,
    toggleType,
    toggleCost,
    updateFilters: setDraftFilters,
    clearAll,
  };
}
