import {useState} from 'react';
import type {Ink} from 'inkweave-synergy-engine';
import type {CardFilterOptions} from '../loader';
import type {CardTypeFilter, BrowseSortOrder} from '../../../shared/constants';
import {BROWSE_SORT_OPTIONS, COLORS, FONTS, FONT_SIZES, SPACING} from '../../../shared/constants';
import {Chip} from '../../../shared/components/Chip';
import {FiltersButton} from '../../../shared/components/FiltersButton';
import {CostFilterGroup} from '../../../shared/components/CostFilterGroup';
import {InkFilterGroup} from '../../../shared/components/InkFilterGroup';
import {InkwellFilterGroup} from '../../../shared/components/InkwellFilterGroup';
import {SortSelect} from '../../../shared/components/SortSelect';
import type {ChipData} from '../../../shared/types';

interface BrowseToolbarProps {
  onFiltersClick: () => void;
  activeFilterCount: number;
  inkFilters: Ink[];
  typeFilters: CardTypeFilter[];
  costFilters: number[];
  filters: CardFilterOptions;
  onToggleInk: (ink: Ink) => void;
  onToggleType: (type: CardTypeFilter) => void;
  onToggleCost: (cost: number) => void;
  onFiltersChange: (filters: CardFilterOptions) => void;
  onClearAll: () => void;
  sortOrder: BrowseSortOrder;
  onSortChange: (order: BrowseSortOrder) => void;
  isMobile: boolean;
  /** Optional slot rendered after the filters button (e.g., role filter chips) */
  extraChips?: React.ReactNode;
}

export function BrowseToolbar({
  onFiltersClick,
  activeFilterCount,
  inkFilters,
  typeFilters,
  costFilters,
  filters,
  onToggleInk,
  onToggleType,
  onToggleCost,
  onFiltersChange,
  onClearAll,
  sortOrder,
  onSortChange,
  isMobile,
  extraChips,
}: BrowseToolbarProps) {
  const [clearHover, setClearHover] = useState(false);

  // Build active filter chips from all filter sources
  // Desktop shows ink/cost/inkwell icons inline in toolbar, so skip chips for those
  const chips: ChipData[] = [];
  if (isMobile) {
    for (const ink of inkFilters)
      chips.push({id: `ink:${ink}`, label: ink, onDismiss: () => onToggleInk(ink)});
    for (const cost of costFilters)
      chips.push({id: `cost:${cost}`, label: `Cost ${cost}`, onDismiss: () => onToggleCost(cost)});
    if (filters.inkwell)
      chips.push({
        id: `inkwell:${filters.inkwell}`,
        label: filters.inkwell === 'inkable' ? 'Inkable' : 'Uninkable',
        onDismiss: () => onFiltersChange({...filters, inkwell: undefined}),
      });
  }
  for (const type of typeFilters)
    chips.push({id: `type:${type}`, label: type, onDismiss: () => onToggleType(type)});
  if (filters.keywords?.length)
    chips.push({
      id: `keyword:${filters.keywords[0]}`,
      label: filters.keywords[0],
      onDismiss: () => onFiltersChange({...filters, keywords: undefined}),
    });
  if (filters.classifications?.length)
    chips.push({
      id: `classification:${filters.classifications[0]}`,
      label: filters.classifications[0],
      onDismiss: () => onFiltersChange({...filters, classifications: undefined}),
    });
  if (filters.setCode)
    chips.push({
      id: `set:${filters.setCode}`,
      label: `Set ${filters.setCode}`,
      onDismiss: () => onFiltersChange({...filters, setCode: undefined}),
    });

  const hasChips = chips.length > 0;

  return (
    <div
      data-testid="browse-toolbar"
      style={{
        padding: isMobile ? `${SPACING.md}px ${SPACING.lg}px 0` : `${SPACING.md}px 32px 0`,
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? SPACING.sm : 10,
        flexWrap: 'wrap',
        position: 'relative',
        zIndex: 1,
      }}>
      <FiltersButton onClick={onFiltersClick} activeCount={activeFilterCount} isMobile={isMobile} />
      {extraChips}

      {/* Active filter chips */}
      {hasChips && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            ...(isMobile ? {flexBasis: '100%'} : {flex: 1}),
          }}>
          {chips.map((chip) => (
            <Chip
              key={chip.id}
              variant="dismiss"
              label={chip.label}
              onDismiss={chip.onDismiss}
              isMobile={isMobile}
            />
          ))}
          <button
            onClick={onClearAll}
            onMouseEnter={() => setClearHover(true)}
            onMouseLeave={() => setClearHover(false)}
            style={{
              background: 'none',
              border: 'none',
              color: clearHover ? COLORS.text : COLORS.textMuted,
              fontFamily: FONTS.body,
              fontSize: `${FONT_SIZES.base}px`,
              cursor: 'pointer',
              padding: 0,
              textDecoration: clearHover ? 'underline' : 'none',
              transition: 'color 0.15s',
            }}>
            Clear all
          </button>
        </div>
      )}

      {/* Right side: ink filters (desktop) + sort */}
      <div style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10}}>
        {!isMobile && (
          <>
            <InkFilterGroup inkFilters={inkFilters} onToggleInk={onToggleInk} />
            <div
              aria-hidden="true"
              style={{
                width: 1,
                height: 24,
                backgroundColor: COLORS.primary500,
                opacity: 0.2,
                flexShrink: 0,
              }}
            />
            <CostFilterGroup costFilters={costFilters} onToggleCost={onToggleCost} />
            <div
              aria-hidden="true"
              style={{
                width: 1,
                height: 24,
                backgroundColor: COLORS.primary500,
                opacity: 0.2,
                flexShrink: 0,
              }}
            />
            <InkwellFilterGroup
              activeValue={filters.inkwell}
              onToggle={(v) => onFiltersChange({...filters, inkwell: v})}
            />
          </>
        )}
        <SortSelect
          options={BROWSE_SORT_OPTIONS}
          value={sortOrder}
          onChange={onSortChange}
          ariaLabel="Sort cards"
        />
      </div>
    </div>
  );
}
