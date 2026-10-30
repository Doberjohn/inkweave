import {useState, type ComponentProps} from 'react';
import {CardFilterDialog, FilterSection, SortSelect} from '../../shared/components';
import type {FilterPanelProps} from '../../shared/components/CardFilterDialog';
import type {BrowseSortOrder} from '../../shared/constants';
import type {AlsoWrite, FilterDraft} from '../../shared/hooks/useFilterParams';
import {BINDER_SORT_OPTIONS, writeShowParam, type BinderShow} from './binderCards';
import {trackViewPick} from './binderEvents';
import {BinderShows, type CompareCounts} from './BinderShows';

/** The filter sheet's props the Binder sheet sets itself. */
type SheetOwn = 'variant' | 'onApply' | 'title' | 'prelude' | 'extra';

export interface BinderSheetProps extends Omit<ComponentProps<typeof CardFilterDialog>, SheetOwn> {
  /** What the binder shows, where the sheet's Show starts each time it opens. */
  show: BinderShow;
  /** A friend's binder's You need and They need, as the set panel shows them. */
  compare?: CompareCounts | null;
  /** The binder's sort, where the sheet's Sort starts. */
  sortOrder: BrowseSortOrder;
  /** The page's one URL write, of the filters, the sort and Show together (`applyDraft`). */
  onApply: (draft: FilterDraft, also: AlsoWrite) => void;
  /** A friend's binder's sheet, for `binder_view_changed`. */
  friend?: boolean;
}

/** Show and the sort as the sheet drafts them. */
interface SheetDrafts {
  show: BinderShow;
  setShow: (show: BinderShow) => void;
  sortOrder: BrowseSortOrder;
  setSortOrder: (order: BrowseSortOrder) => void;
}

/**
 * Show and the sort, drafted: taken when the sheet opens, as `useDraftFilters` takes the
 * filters', and written by Apply alone, so closing the sheet any other way drops them.
 */
function useSheetDrafts(isOpen: boolean, show: BinderShow, sortOrder: BrowseSortOrder): SheetDrafts {
  const [draftShow, setDraftShow] = useState(show);
  const [draftSort, setDraftSort] = useState(sortOrder);
  // The open transition, kept as React's docs keep a previous value.
  const [wasOpen, setWasOpen] = useState(false);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setDraftShow(show);
      setDraftSort(sortOrder);
    }
  }
  return {show: draftShow, setShow: setDraftShow, sortOrder: draftSort, setSortOrder: setDraftSort};
}

/** Above the filters: what the binder shows, and its sort. */
function SheetPrelude({show, setShow, sortOrder, setSortOrder, compare}: SheetDrafts & {compare?: CompareCounts | null}) {
  return (
    <>
      <FilterSection label="Show">
        <BinderShows show={show} onShowChange={setShow} compare={compare} />
      </FilterSection>
      <FilterSection label="Sort">
        <SortSelect
          options={BINDER_SORT_OPTIONS}
          value={sortOrder}
          onChange={setSortOrder}
          ariaLabel="Sort cards"
          style={{width: '100%'}}
        />
      </FilterSection>
    </>
  );
}

/**
 * A phone's Binder sheet (owner, 2026-10-25), which the binder row's Filters opens: the filter
 * sheet, titled Binder, with Show and the sort above the filters (the scope's numbers are on the
 * binder's inside cover, owner 2026-10-27). THE SHEET IS ONE CHANGE: Show and the sort wait for
 * Apply, as the filters do, and Apply writes all three in the page's one URL write, since two
 * writers in one tick can lose one of the two (`useBinderParams`). Clear all puts back All with
 * the filters; the sort is no filter, so it stays.
 */
export function BinderSheet({show, compare, sortOrder, onApply, friend = false, ...dialog}: BinderSheetProps) {
  const drafts = useSheetDrafts(dialog.isOpen, show, sortOrder);
  const apply: FilterPanelProps['onApply'] = (inks, types, costs, opts) => {
    trackViewPick('show', {value: drafts.show, was: show}, friend);
    onApply(
      {inks, types, costs, opts},
      {sortOrder: drafts.sortOrder, edit: (params) => writeShowParam(params, drafts.show)},
    );
  };
  return (
    <CardFilterDialog
      {...dialog}
      variant="drawer"
      title="Binder"
      prelude={<SheetPrelude {...drafts} compare={compare} />}
      extra={{count: drafts.show === 'all' ? 0 : 1, onClear: () => drafts.setShow('all')}}
      onApply={apply}
    />
  );
}
