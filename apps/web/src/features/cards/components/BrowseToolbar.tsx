import {useState} from 'react';
import type {Ink} from 'inkweave-synergy-engine';
import type {CardFilterOptions} from '../loader';
import type {CardTypeFilter, BrowseSortOrder} from '../../../shared/constants';
import {BROWSE_SORT_OPTIONS, COLORS, EASING, FONTS, FONT_SIZES, GOLD_GLOW, RADIUS, SPACING} from '../../../shared/constants';
import {Chip} from '../../../shared/components/Chip';
import {FiltersButton} from '../../../shared/components/FiltersButton';
import {SearchIcon} from '../../../shared/components/SearchIcon';
import {CostFilterGroup} from '../../../shared/components/CostFilterGroup';
import {InkFilterGroup} from '../../../shared/components/InkFilterGroup';
import {InkwellFilterGroup} from '../../../shared/components/InkwellFilterGroup';
import {SortSelect} from '../../../shared/components/SortSelect';
import {useInlineCostFilters} from '../../../shared/hooks';
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
  /** Clears all selected costs at once (used by the combined cost chip's dismiss). */
  onClearCosts: () => void;
  onFiltersChange: (filters: CardFilterOptions) => void;
  sortOrder: BrowseSortOrder;
  onSortChange: (order: BrowseSortOrder) => void;
  isMobile: boolean;
  /** Optional slot rendered after the filters button (e.g., role filter chips) */
  extraChips?: React.ReactNode;
  /**
   * Search slot props. When both are provided (desktop only), an inline search
   * input renders after the Filters button and filters the grid in place.
   */
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

// =====================================================================
// Module-level helpers — each absorbs decision points so the
// public BrowseToolbar function stays low-CC.
// =====================================================================

interface ChipBuildArgs {
  isMobile: boolean;
  /** Whether the inline cost-filter icons are visible (false → cost shown as chips). */
  showCost: boolean;
  inkFilters: Ink[];
  typeFilters: CardTypeFilter[];
  costFilters: number[];
  filters: CardFilterOptions;
  onToggleInk: (ink: Ink) => void;
  onToggleType: (type: CardTypeFilter) => void;
  onToggleCost: (cost: number) => void;
  onClearCosts: () => void;
  onFiltersChange: (filters: CardFilterOptions) => void;
}

// Active filters whose inline icons are hidden need a dismissible chip so the
// state stays visible. Ink + inkwell icons only hide on mobile; the cost icons
// also hide on narrow desktop (showCost === false), so cost gets a chip there too.
function buildHiddenIconChips(args: ChipBuildArgs): ChipData[] {
  const chips: ChipData[] = [];
  if (args.isMobile) {
    chips.push(
      ...args.inkFilters.map((ink) => ({
        id: `ink:${ink}`,
        label: ink,
        onDismiss: () => args.onToggleInk(ink),
      })),
    );
  }
  // A single combined chip for every selected cost (e.g. "Costs: 3, 5"); its
  // dismiss clears them all at once. Cost icons are hidden on mobile and on
  // narrow desktop (!showCost), so the chip stands in for them there.
  const costTucked = args.isMobile || !args.showCost;
  if (costTucked && args.costFilters.length > 0) {
    const sorted = [...args.costFilters].sort((a, b) => a - b);
    chips.push({
      id: 'cost',
      label: `${sorted.length === 1 ? 'Cost' : 'Costs'}: ${sorted.join(', ')}`,
      onDismiss: args.onClearCosts,
    });
  }
  if (args.isMobile && args.filters.inkwell) {
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
  return [...buildHiddenIconChips(args), ...typeChips, ...optionalChips];
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

// Carried over from CompactHeader's old HeaderSearch: gold focus ring + border.
function getToolbarSearchInputStyle(focused: boolean): React.CSSProperties {
  return {
    width: '100%',
    height: 36,
    padding: '0 12px 0 36px',
    borderRadius: `${RADIUS.lg}px`,
    border: `1px solid ${focused ? GOLD_GLOW.activeBorder : COLORS.searchBorder}`,
    background: COLORS.searchBg,
    color: COLORS.text,
    fontSize: `${FONT_SIZES.lg}px`,
    fontFamily: FONTS.body,
    boxSizing: 'border-box',
    outline: 'none',
    boxShadow: focused ? GOLD_GLOW.focusRing : 'none',
    transition: `border-color 0.25s ${EASING.snappy}, box-shadow 0.25s ${EASING.snappy}`,
  };
}

function getToolbarSearchWrapperStyle(): React.CSSProperties {
  // Row filler: flex-basis 0 (via flex:1) keeps the search out of the flex-wrap
  // line-break math entirely, so it can never push the icon groups to a second
  // row; it then grows into exactly the leftover space (wider screens = wider
  // search). minWidth:0 overrides the implicit min-content floor for the same
  // reason. When active-filter chips render, their row (flex:1) splits the
  // leftover space with the search. position:'relative' anchors the search icon.
  return {position: 'relative', flex: 1, minWidth: 0};
}

function ToolbarSearch({query, onChange}: {query: string; onChange: (q: string) => void}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={getToolbarSearchWrapperStyle()}>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          pointerEvents: 'none',
        }}>
        <SearchIcon size={16} color={COLORS.searchIcon} />
      </span>
      <input
        type="text"
        aria-label="Search cards"
        placeholder="Search cards..."
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        data-testid="browse-search"
        style={getToolbarSearchInputStyle(focused)}
      />
    </div>
  );
}

interface ActiveChipsRowProps {
  chips: ChipData[];
  isMobile: boolean;
}

function ActiveChipsRow({chips, isMobile}: ActiveChipsRowProps) {
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
  /** When false, the cost group is tucked into the Filters dialog (narrow desktop). */
  showCost: boolean;
}

function DesktopFilterIcons({
  inkFilters,
  costFilters,
  inkwell,
  onToggleInk,
  onToggleCost,
  onInkwellChange,
  showCost,
}: DesktopFilterIconsProps) {
  return (
    <>
      <InkFilterGroup inkFilters={inkFilters} onToggleInk={onToggleInk} />
      <div aria-hidden="true" style={DIVIDER_STYLE} />
      {showCost && (
        <>
          <CostFilterGroup costFilters={costFilters} onToggleCost={onToggleCost} />
          <div aria-hidden="true" style={DIVIDER_STYLE} />
        </>
      )}
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
  onClearCosts,
  onFiltersChange,
  sortOrder,
  onSortChange,
  isMobile,
  extraChips,
  searchQuery,
  onSearchChange,
}: BrowseToolbarProps) {
  // Cost icons stay inline only on wide desktops; below that they tuck into the
  // Filters dialog and surface as a chip instead (see buildHiddenIconChips).
  const showCost = useInlineCostFilters();
  const chips = buildActiveChips({
    isMobile,
    showCost,
    inkFilters,
    typeFilters,
    costFilters,
    filters,
    onToggleInk,
    onToggleType,
    onToggleCost,
    onClearCosts,
    onFiltersChange,
  });

  return (
    <div data-testid="browse-toolbar" style={getToolbarStyle(isMobile)}>
      <FiltersButton
        onClick={onFiltersClick}
        activeCount={activeFilterCount}
        isMobile={isMobile}
      />
      {!isMobile && searchQuery !== undefined && onSearchChange !== undefined && (
        <ToolbarSearch query={searchQuery} onChange={onSearchChange} />
      )}
      {extraChips}
      {chips.length > 0 && <ActiveChipsRow chips={chips} isMobile={isMobile} />}
      <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
        {!isMobile && (
          <DesktopFilterIcons
            inkFilters={inkFilters}
            costFilters={costFilters}
            inkwell={filters.inkwell}
            onToggleInk={onToggleInk}
            onToggleCost={onToggleCost}
            onInkwellChange={(v) => onFiltersChange({...filters, inkwell: v})}
            showCost={showCost}
          />
        )}
        <SortSelect
          options={BROWSE_SORT_OPTIONS}
          value={sortOrder}
          onChange={onSortChange}
          ariaLabel="Sort cards"
          isMobile={isMobile}
        />
      </div>
    </div>
  );
}
