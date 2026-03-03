import {useState, useCallback, useMemo, useEffect} from 'react';
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

  // Snapshot committed state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDraftInks(inkFilters);
      setDraftTypes(typeFilters);
      setDraftCosts(costFilters);
      setDraftFilters(filters);
    }
    // Only reset when isOpen transitions — not when committed props change mid-edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const toggleInk = useCallback((ink: Ink) => {
    setDraftInks((prev) => toggleItem(prev, ink));
  }, []);

  const toggleType = useCallback((type: CardTypeFilter) => {
    setDraftTypes((prev) => toggleItem(prev, type));
  }, []);

  const toggleCost = useCallback((cost: number) => {
    setDraftCosts((prev) => toggleItem(prev, cost));
  }, []);

  const clearAll = useCallback(() => {
    setDraftInks([]);
    setDraftTypes([]);
    setDraftCosts([]);
    setDraftFilters({});
  }, []);

  const activeFilterCount = useMemo(
    () =>
      draftInks.length +
      draftTypes.length +
      draftCosts.length +
      [
        draftFilters.keywords?.length,
        draftFilters.classifications?.length,
        draftFilters.setCode,
      ].filter(Boolean).length,
    [draftInks, draftTypes, draftCosts, draftFilters],
  );

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
