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

// =====================================================================
// Module-level helpers — each absorbs decision points so the
// public BrowseToolbar function stays low-CC.
// =====================================================================

interface ChipBuildArgs {
  isMobile: boolean;
  inkFilters: Ink[];
  typeFilters: CardTypeFilter[];
  costFilters: number[];
  filters: CardFilterOptions;
  onToggleInk: (ink: Ink) => void;
  onToggleType: (type: CardTypeFilter) => void;
  onToggleCost: (cost: number) => void;
  onFiltersChange: (filters: CardFilterOptions) => void;
}

function buildMobileOnlyChips(args: ChipBuildArgs): ChipData[] {
  if (!args.isMobile) return [];
  const chips: ChipData[] = [
    ...args.inkFilters.map((ink) => ({
      id: `ink:${ink}`,
      label: ink,
      onDismiss: () => args.onToggleInk(ink),
    })),
    ...args.costFilters.map((cost) => ({
      id: `cost:${cost}`,
      label: `Cost ${cost}`,
      onDismiss: () => args.onToggleCost(cost),
    })),
  ];
  if (args.filters.inkwell) {
    chips.push({
      id: `inkwell:${args.filters.inkwell}`,
      label: args.filters.inkwell === 'inkable' ? 'Inkable' : 'Uninkable',
      onDismiss: () => args.onFiltersChange({...args.filters, inkwell: undefined}),
    });
  }
  return chips;
}

function buildSingleValueChip(
  filters: CardFilterOptions,
  onFiltersChange: (f: CardFilterOptions) => void,
  key: 'keywords' | 'classifications',
): ChipData | null {
  const value = filters[key]?.[0];
  if (!value) return null;
  return {
    id: `${key}:${value}`,
    label: value,
    onDismiss: () => onFiltersChange({...filters, [key]: undefined}),
  };
}

function buildSetChip(
  filters: CardFilterOptions,
  onFiltersChange: (f: CardFilterOptions) => void,
): ChipData | null {
  if (!filters.setCode) return null;
  return {
    id: `set:${filters.setCode}`,
    label: `Set ${filters.setCode}`,
    onDismiss: () => onFiltersChange({...filters, setCode: undefined}),
  };
}

function buildActiveChips(args: ChipBuildArgs): ChipData[] {
  const typeChips = args.typeFilters.map((type) => ({
    id: `type:${type}`,
    label: type,
    onDismiss: () => args.onToggleType(type),
  }));
  const optionalChips = [
    buildSingleValueChip(args.filters, args.onFiltersChange, 'keywords'),
    buildSingleValueChip(args.filters, args.onFiltersChange, 'classifications'),
    buildSetChip(args.filters, args.onFiltersChange),
  ].filter((c): c is ChipData => c !== null);
  return [...buildMobileOnlyChips(args), ...typeChips, ...optionalChips];
}

function getToolbarStyle(isMobile: boolean): React.CSSProperties {
  const sidePad = isMobile ? SPACING.lg : 32;
  return {
    padding: `${SPACING.md}px ${sidePad}px ${SPACING.md}px`,
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? SPACING.sm : 10,
    flexWrap: 'wrap',
    position: 'relative',
    zIndex: 1,
  };
}

const DIVIDER_STYLE: React.CSSProperties = {
  width: 1,
  height: 24,
  backgroundColor: COLORS.primary500,
  opacity: 0.2,
  flexShrink: 0,
};

// =====================================================================
// Subcomponents — each owns a small concern.
// =====================================================================

function ClearAllButton({onClick}: {onClick: () => void}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'none',
        border: 'none',
        color: hover ? COLORS.text : COLORS.textMuted,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        cursor: 'pointer',
        padding: 0,
        textDecoration: hover ? 'underline' : 'none',
        transition: 'color 0.15s',
      }}>
      Clear all
    </button>
  );
}

interface ActiveChipsRowProps {
  chips: ChipData[];
  isMobile: boolean;
  onClearAll: () => void;
}

function ActiveChipsRow({chips, isMobile, onClearAll}: ActiveChipsRowProps) {
  return (
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
      <ClearAllButton onClick={onClearAll} />
    </div>
  );
}

interface DesktopFilterIconsProps {
  inkFilters: Ink[];
  costFilters: number[];
  inkwell: CardFilterOptions['inkwell'];
  onToggleInk: (ink: Ink) => void;
  onToggleCost: (cost: number) => void;
  onInkwellChange: (v: CardFilterOptions['inkwell']) => void;
}

function DesktopFilterIcons({
  inkFilters,
  costFilters,
  inkwell,
  onToggleInk,
  onToggleCost,
  onInkwellChange,
}: DesktopFilterIconsProps) {
  return (
    <>
      <InkFilterGroup inkFilters={inkFilters} onToggleInk={onToggleInk} />
      <div aria-hidden="true" style={DIVIDER_STYLE} />
      <CostFilterGroup costFilters={costFilters} onToggleCost={onToggleCost} />
      <div aria-hidden="true" style={DIVIDER_STYLE} />
      <InkwellFilterGroup activeValue={inkwell} onToggle={onInkwellChange} />
    </>
  );
}

// =====================================================================
// Public component — layout shell that delegates to subcomponents.
// =====================================================================

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
  const chips = buildActiveChips({
    isMobile,
    inkFilters,
    typeFilters,
    costFilters,
    filters,
    onToggleInk,
    onToggleType,
    onToggleCost,
    onFiltersChange,
  });

  return (
    <div data-testid="browse-toolbar" style={getToolbarStyle(isMobile)}>
      <FiltersButton
        onClick={onFiltersClick}
        activeCount={activeFilterCount}
        isMobile={isMobile}
      />
      {extraChips}
      {chips.length > 0 && (
        <ActiveChipsRow chips={chips} isMobile={isMobile} onClearAll={onClearAll} />
      )}
      <div style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10}}>
        {!isMobile && (
          <DesktopFilterIcons
            inkFilters={inkFilters}
            costFilters={costFilters}
            inkwell={filters.inkwell}
            onToggleInk={onToggleInk}
            onToggleCost={onToggleCost}
            onInkwellChange={(v) => onFiltersChange({...filters, inkwell: v})}
          />
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
