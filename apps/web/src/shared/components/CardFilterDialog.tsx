import type {ReactNode} from 'react';
import {FilterDialog} from 'inkweave-ui/components/FilterDialog';
import {FilterContent} from 'inkweave-ui/lorcana/FilterContent';
import type {Ink, SetInfo} from '../../features/cards';
import type {CardFilterOptions} from '../../features/cards';
import {FILTER_VOCABULARY, type FilterButtonOptions} from '../../features/cards/filterOptions';
import type {CardTypeFilter} from '../constants';
import {useDraftFilters} from '../hooks/useDraftFilters';
import type {FilterDraft} from '../hooks/useFilterParams';
import {useInlineCostFilters} from '../hooks';

/** The props every card filter dialog takes, the desktop modal and the phone drawer alike. */
export interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (
    inks: Ink[],
    types: CardTypeFilter[],
    costs: number[],
    filters: CardFilterOptions,
  ) => void;
  inkFilters: Ink[];
  typeFilters: CardTypeFilter[];
  costFilters: number[];
  filters: CardFilterOptions;
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  /** The pool's rarities, in rarity order (`getUniqueRarities`). */
  uniqueRarities: string[];
  sets: SetInfo[];
  /**
   * Limits the ink, cost, type and inkwell buttons to these values (a playstyle's card
   * pool). Left out, every value shows.
   */
  buttonOptions?: FilterButtonOptions;
  /** Offer the Set filter (the default); collection mode turns it off (inkweave-ui's `FilterContentProps`). */
  showSetFilter?: boolean;
  /** Offer the art presets under the rarities; Browse does (inkweave-ui's `FilterContentProps`). */
  showArtPresets?: boolean;
}

interface CardFilterDialogProps extends FilterPanelProps {
  /** Responsive variant. Controls layout and animation. */
  variant: 'modal' | 'drawer';
  /**
   * Whether the page's toolbar carries the cost and inkwell buttons inline, so the
   * desktop modal can leave them out. Defaults to Browse's toolbar: inkwell always,
   * cost on wide screens. A toolbar without them (the synergy toolbar) passes
   * `false` for each, or those filters are unreachable on desktop.
   */
  toolbarCarries?: {cost: boolean; inkwell: boolean};
  /** The title, in place of "Filters (n)": a phone binder's sheet is "Binder" (#969). */
  title?: string;
  /** Drawn above the filters: the Binder sheet's Show and sort (#969). */
  prelude?: ReactNode;
  /**
   * What the caller drafts beside the filters, which Clear all puts back too (the Binder sheet's
   * Show, #969): while `count` is above 0, Clear all shows, and pressing it also calls `onClear`.
   * Without a `title`, the count also joins the one in "Filters (n)". One prop, so a count never
   * comes without the clear that takes it away.
   */
  extra?: {count: number; onClear: () => void};
  /**
   * Drawn under the filters, out of their scroll: collection mode's Save as a binder. Handed the
   * draft, so what it says follows each pick, and an Apply that also closes, for a press that
   * puts the draft on the page first.
   */
  foot?: (draft: FilterDraft, applyAndClose: () => void) => ReactNode;
}

/**
 * The card filters in inkweave-ui's FilterDialog shell: a draft of the page's filters
 * that Apply hands over and any other close drops, and the app's words for FilterContent.
 */
export function CardFilterDialog({
  isOpen,
  onClose,
  onApply,
  variant,
  inkFilters,
  typeFilters,
  costFilters,
  filters,
  toolbarCarries = {cost: true, inkwell: true},
  title,
  prelude,
  extra,
  foot,
  ...content
}: CardFilterDialogProps) {
  const draft = useDraftFilters({isOpen, inkFilters, typeFilters, costFilters, filters});
  // Cost rides inline only on wide screens, and only in a toolbar that has it.
  const showInlineCost = useInlineCostFilters() && toolbarCarries.cost;

  const clearAll = () => {
    draft.clearAll();
    extra?.onClear();
  };
  const apply = () => onApply(draft.draftInks, draft.draftTypes, draft.draftCosts, draft.draftFilters);
  const drafted: FilterDraft = {inks: draft.draftInks, types: draft.draftTypes, costs: draft.draftCosts, opts: draft.draftFilters};

  return (
    <FilterDialog
      isOpen={isOpen}
      onClose={onClose}
      onApply={apply}
      onClearAll={clearAll}
      activeCount={draft.activeFilterCount + (extra?.count ?? 0)}
      title={title}
      variant={variant}
      foot={foot?.(drafted, () => {
        apply();
        onClose();
      })}>
      {prelude}
      <FilterContent
        {...content}
        inkFilters={draft.draftInks}
        typeFilters={draft.draftTypes}
        costFilters={draft.draftCosts}
        filters={draft.draftFilters}
        onToggleInk={draft.toggleInk}
        onToggleType={draft.toggleType}
        onToggleCost={draft.toggleCost}
        onFiltersChange={draft.updateFilters}
        variant={variant === 'modal' ? 'desktop' : 'mobile'}
        showInlineCost={showInlineCost}
        showInlineInkwell={toolbarCarries.inkwell}
        vocabulary={FILTER_VOCABULARY}
      />
    </FilterDialog>
  );
}
