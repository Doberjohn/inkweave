import {useState} from 'react';
import type {Ink} from 'inkweave-synergy-engine';
import {offersDualOnly, type CardFilterOptions} from '../loader';
import {artPresetOf, type FilterButtonOptions} from '../filterOptions';
import type {CardTypeFilter, BrowseSortOrder} from '../../../shared/constants';
import {BROWSE_SORT_OPTIONS, COLORS, FONTS, FONT_SIZES, RADIUS, SPACING, searchFieldStyle} from '../../../shared/constants';
import {Chip} from '../../../shared/components/Chip';
import {FiltersButton} from '../../../shared/components/FiltersButton';
import {SearchIcon} from '../../../shared/components/SearchIcon';
import {CostFilterGroup} from '../../../shared/components/CostFilterGroup';
import {InkFilterGroup} from '../../../shared/components/InkFilterGroup';
import {InkwellFilterGroup} from '../../../shared/components/InkwellFilterGroup';
import {SortSelect} from '../../../shared/components/SortSelect';
import {useHover, useInlineCostFilters} from '../../../shared/hooks';
import type {ChipData} from '../../../shared/types';
import {BROWSE_GUTTER, SIDE_PANEL_WIDTH} from './BrowseSidePanel';

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
  /**
   * The sort's options: Browse's own unless the page passes others. Collection mode
   * names the default for what it does in one set's binder (`BINDER_SORT_OPTIONS`).
   */
  sortOptions?: typeof BROWSE_SORT_OPTIONS;
  isMobile: boolean;
  /**
   * Optional slot at the toolbar's far end (owner, 2026-10-08; it sat beside Filters
   * before): the pool being looked at, all cards or my collection. With it, the sort
   * moves beside Filters. Living in the toolbar, rather than a row of its own, is what
   * keeps it from costing the height-driven binder any card size.
   */
  modeSwitch?: React.ReactNode;
  /**
   * Browse's docked side panel holds every filter (desktop, owner 2026-10-07), so
   * the inline ink, cost and inkwell icons give way, the Filters button toggles the
   * panel instead of opening the dialog, and the toolbar lines up with the page below
   * it (see DockedToolbar). `panelOpen`: open, the Filters button is filled and the
   * panel shows the active filters itself, so the chip row would only repeat them;
   * closed, the button is the ghost outline and the chips are the only sign of them.
   */
  docked?: {panelOpen: boolean};
  /** Optional slot rendered after the filters button (e.g., role filter chips) */
  extraChips?: React.ReactNode;
  /**
   * Search slot props. When both are provided (desktop only), an inline search
   * input renders after the Filters button and filters the grid in place.
   */
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  /** Limits the inline ink, cost and inkwell icons to these values; left out, all show. */
  buttonOptions?: FilterButtonOptions;
}

// =====================================================================
// Module-level helpers — each absorbs decision points so the
// public BrowseToolbar function stays low-CC.
// =====================================================================

interface ChipBuildArgs {
  /** The ink and inkwell icons are not in the toolbar: mobile, or the docked panel holds them. */
  iconsHidden: boolean;
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
// state stays visible. Ink + inkwell icons hide on mobile and when the panel is
// docked; the cost icons also hide on narrow desktop (showCost === false), so cost
// gets a chip there too.
function buildHiddenIconChips(args: ChipBuildArgs): ChipData[] {
  const chips: ChipData[] = [];
  if (args.iconsHidden) {
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
  const costTucked = args.iconsHidden || !args.showCost;
  if (costTucked && args.costFilters.length > 0) {
    const sorted = [...args.costFilters].sort((a, b) => a - b);
    chips.push({
      id: 'cost',
      label: `${sorted.length === 1 ? 'Cost' : 'Costs'}: ${sorted.join(', ')}`,
      onDismiss: args.onClearCosts,
    });
  }
  if (args.iconsHidden && args.filters.inkwell) {
    chips.push({
      id: `inkwell:${args.filters.inkwell}`,
      label: args.filters.inkwell === 'inkable' ? 'Inkable' : 'Uninkable',
      onDismiss: () => args.onFiltersChange({...args.filters, inkwell: undefined}),
    });
  }
  return chips;
}

/** A chip that may not exist, as a list of zero or one. */
const present = (chip: ChipData | null): ChipData[] => (chip ? [chip] : []);

/**
 * One chip per picked keyword, classification or rarity (several since the chip
 * pickers, owner 2026-10-08); dismissing one drops just that value, and the
 * last one clears the option.
 */
function buildListValueChips(
  filters: CardFilterOptions,
  onFiltersChange: (f: CardFilterOptions) => void,
  key: 'keywords' | 'classifications' | 'rarities',
): ChipData[] {
  const values = filters[key] ?? [];
  return values.map((value) => {
    const rest = values.filter((v) => v !== value);
    return {
      id: `${key}:${value}`,
      label: value,
      onDismiss: () => onFiltersChange({...filters, [key]: rest.length > 0 ? rest : undefined}),
    };
  });
}

/** One chip per picked set ("Set 11"); dismissing one keeps the rest. */
function buildSetChips(filters: CardFilterOptions, onFiltersChange: (f: CardFilterOptions) => void): ChipData[] {
  const codes = filters.setCodes ?? [];
  return codes.map((code) => {
    const rest = codes.filter((c) => c !== code);
    return {
      id: `set:${code}`,
      label: `Set ${code}`,
      onDismiss: () => onFiltersChange({...filters, setCodes: rest.length > 0 ? rest : undefined}),
    };
  });
}

/**
 * The Dual-ink cards switch changes what the selected inks MEAN, so it needs a
 * chip wherever its switch is out of sight: the closed panel, and tablets, which
 * have no switch at all and only reach the mode through a link. Only while the
 * selection offers the mode (`offersDualOnly`), the only time it filters anything.
 */
function buildInkModeChip(args: ChipBuildArgs): ChipData | null {
  if (args.filters.inkMatch !== 'dual' || !offersDualOnly(args.inkFilters.length)) return null;
  return {
    id: 'inkmatch:dual',
    label: 'Dual-ink cards',
    onDismiss: () => args.onFiltersChange({...args.filters, inkMatch: undefined}),
  };
}

/**
 * The picked rarities: a chip each, or ONE named for the art preset they amount to (owner,
 * 2026-10-15), "Standard cards" rather than five. Dismissing it clears them all.
 */
function buildRarityChips(filters: CardFilterOptions, onFiltersChange: (f: CardFilterOptions) => void): ChipData[] {
  const preset = artPresetOf(filters.rarities ?? []);
  if (!preset) return buildListValueChips(filters, onFiltersChange, 'rarities');
  return [{id: `rarities:${preset.value}`, label: preset.label, onDismiss: () => onFiltersChange({...filters, rarities: undefined})}];
}

function buildActiveChips(args: ChipBuildArgs): ChipData[] {
  const typeChips = args.typeFilters.map((type) => ({
    id: `type:${type}`,
    label: type,
    onDismiss: () => args.onToggleType(type),
  }));
  // The ink mode right after the ink chips it modifies; then the panel's order.
  return [
    ...buildHiddenIconChips(args),
    ...present(buildInkModeChip(args)),
    ...typeChips,
    ...buildRarityChips(args.filters, args.onFiltersChange),
    ...buildListValueChips(args.filters, args.onFiltersChange, 'keywords'),
    ...buildListValueChips(args.filters, args.onFiltersChange, 'classifications'),
    ...buildSetChips(args.filters, args.onFiltersChange),
  ];
}

function getToolbarStyle(isMobile: boolean): React.CSSProperties {
  const sidePad = isMobile ? SPACING.lg : BROWSE_GUTTER;
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

/**
 * The search field (owner, 2026-10-15: option B of `public/mockups/search-bar.html`):
 * raised like the sort beside it (`searchFieldStyle`), 16px text, 36px tall as before.
 */
function getToolbarSearchInputStyle(state: {focused: boolean; hovered: boolean}): React.CSSProperties {
  return {
    ...searchFieldStyle(state),
    width: '100%',
    height: 36,
    padding: `0 ${SPACING.md}px 0 40px`,
    borderRadius: `${RADIUS.lg}px`,
    color: COLORS.text,
    fontSize: `${FONT_SIZES.xl}px`,
    fontFamily: FONTS.body,
    boxSizing: 'border-box',
    outline: 'none',
  };
}

function getToolbarSearchWrapperStyle(fill: boolean): React.CSSProperties {
  // Fixed-width, no-shrink: the search box holds a stable 300px so it reads as a
  // consistent control next to Filters, and the active-filter chip row (flex:1)
  // wraps below it under pressure instead of squeezing the input. Docked, it fills
  // the room its slot gives it instead. position:'relative' anchors the search icon.
  return fill ? {position: 'relative', width: '100%'} : {position: 'relative', width: 300, flexShrink: 0};
}

function ToolbarSearch({query, onChange, fill}: {query: string; onChange: (q: string) => void; fill: boolean}) {
  const [focused, setFocused] = useState(false);
  const {hovered, hoverProps} = useHover();
  return (
    <div style={getToolbarSearchWrapperStyle(fill)}>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 13,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          pointerEvents: 'none',
        }}>
        <SearchIcon size={18} color={COLORS.searchPlaceholder} />
      </span>
      <input
        type="text"
        aria-label="Search cards"
        placeholder="Search cards..."
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...hoverProps}
        data-testid="browse-search"
        style={getToolbarSearchInputStyle({focused, hovered})}
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
  options: FilterButtonOptions | undefined;
}

function DesktopFilterIcons({
  inkFilters,
  costFilters,
  inkwell,
  onToggleInk,
  onToggleCost,
  onInkwellChange,
  showCost,
  options,
}: DesktopFilterIconsProps) {
  return (
    <>
      <InkFilterGroup inkFilters={inkFilters} onToggleInk={onToggleInk} inks={options?.inks} />
      <div aria-hidden="true" style={DIVIDER_STYLE} />
      {showCost && (
        <>
          <CostFilterGroup
            costFilters={costFilters}
            onToggleCost={onToggleCost}
            costs={options?.costs}
            uninkable={inkwell === 'uninkable'}
          />
          <div aria-hidden="true" style={DIVIDER_STYLE} />
        </>
      )}
      <InkwellFilterGroup
        activeValue={inkwell}
        onToggle={onInkwellChange}
        values={options?.inkwell}
      />
    </>
  );
}

/**
 * Which parts show, decided here so the component stays a layout shell. Docked
 * (Browse's desktop side panel) the panel holds every filter: the inline icons
 * go, the hidden ones need chips, and the chip row only shows while the panel is
 * CLOSED, since open it already displays the same filters.
 */
function toolbarParts(isMobile: boolean, docked: BrowseToolbarProps['docked']) {
  const iconsHidden = isMobile || docked !== undefined;
  return {iconsHidden, inlineIcons: !iconsHidden, chipRow: !docked?.panelOpen};
}

/** The inline search, desktop only and only where the page wires one up. */
function ToolbarSearchSlot({isMobile, query, onChange, fill = false}: {
  isMobile: boolean;
  query?: string;
  onChange?: (query: string) => void;
  /** Fill its slot (the docked toolbar) rather than hold a fixed width. */
  fill?: boolean;
}) {
  if (isMobile) return null;
  if (query === undefined) return null;
  return onChange ? <ToolbarSearch query={query} onChange={onChange} fill={fill} /> : null;
}

/** The toolbar's controls, built once and placed by the docked or the flowing layout. */
interface ToolbarSlots {
  filters: React.ReactNode;
  sort: React.ReactNode;
  search: React.ReactNode;
  chips: React.ReactNode;
  modeSwitch?: React.ReactNode;
}

/**
 * Docked (Browse on desktop, owner 2026-10-08): the toolbar lines up with the page below it.
 * Filters and the sort together span the side panel's width; the search starts where the
 * cards do, one gutter past the panel, and runs to Collection at the far end. The chips,
 * shown while the panel is closed, get a row of their own underneath, so the search keeps
 * its width. The geometry holds with the panel closed too: only the cards move.
 */
function DockedToolbar({filters, sort, search, chips, modeSwitch}: ToolbarSlots) {
  return (
    <div
      data-testid="browse-toolbar"
      style={{padding: `${SPACING.md}px ${BROWSE_GUTTER}px`, position: 'relative', zIndex: 1}}>
      <div style={{display: 'flex', alignItems: 'center'}}>
        <div style={{width: SIDE_PANEL_WIDTH, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10}}>
          {filters}
          {sort}
        </div>
        <div style={{flex: 1, minWidth: 0, marginLeft: BROWSE_GUTTER}}>{search}</div>
        {modeSwitch && <div style={{marginLeft: 10, flexShrink: 0}}>{modeSwitch}</div>}
      </div>
      {chips && <div style={{marginTop: SPACING.sm}}>{chips}</div>}
    </div>
  );
}

/**
 * The flowing toolbar (tablet and phone, and the playstyle page): its controls wrap as
 * room runs out. Browse's mode switch takes the far end and puts the sort beside Filters
 * (owner, 2026-10-08); without one, the sort keeps the far end.
 */
function FlowToolbar({
  isMobile,
  filters,
  sort,
  search,
  chips,
  modeSwitch,
  icons,
  extraChips,
}: ToolbarSlots & {isMobile: boolean; icons: React.ReactNode; extraChips: React.ReactNode}) {
  return (
    <div data-testid="browse-toolbar" style={getToolbarStyle(isMobile)}>
      {filters}
      {modeSwitch ? sort : null}
      {search}
      {extraChips}
      {chips}
      <div style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10}}>
        {icons}
        {modeSwitch || sort}
      </div>
    </div>
  );
}

/**
 * Docked, Filters and the sort share the panel's width in both modes: the sort takes
 * what Filters leaves. Elsewhere it keeps its own width.
 */
const DOCKED_SORT_STYLE: React.CSSProperties = {flex: 1, minWidth: 0};

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
  sortOptions = BROWSE_SORT_OPTIONS,
  isMobile,
  modeSwitch,
  extraChips,
  searchQuery,
  onSearchChange,
  buttonOptions,
  docked,
}: BrowseToolbarProps) {
  // Cost icons stay inline only on wide desktops; below that they tuck into the
  // Filters dialog and surface as a chip instead (see buildHiddenIconChips).
  const showCost = useInlineCostFilters();
  const parts = toolbarParts(isMobile, docked);
  const chips = buildActiveChips({
    iconsHidden: parts.iconsHidden,
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

  const slots: ToolbarSlots = {
    filters: (
      <FiltersButton
        onClick={onFiltersClick}
        activeCount={activeFilterCount}
        isMobile={isMobile}
        expanded={docked?.panelOpen}
        // Docked, filled while the panel is open; a dialog trigger stays filled.
        active={docked?.panelOpen ?? true}
      />
    ),
    sort: (
      <SortSelect
        options={sortOptions}
        value={sortOrder}
        onChange={onSortChange}
        ariaLabel="Sort cards"
        isMobile={isMobile}
        style={docked ? DOCKED_SORT_STYLE : undefined}
      />
    ),
    search: (
      <ToolbarSearchSlot isMobile={isMobile} query={searchQuery} onChange={onSearchChange} fill={docked !== undefined} />
    ),
    chips: parts.chipRow && chips.length > 0 ? <ActiveChipsRow chips={chips} isMobile={isMobile} /> : null,
    modeSwitch,
  };
  if (docked) return <DockedToolbar {...slots} />;

  const icons = parts.inlineIcons ? (
    <DesktopFilterIcons
      inkFilters={inkFilters}
      costFilters={costFilters}
      inkwell={filters.inkwell}
      onToggleInk={onToggleInk}
      onToggleCost={onToggleCost}
      onInkwellChange={(v) => onFiltersChange({...filters, inkwell: v})}
      showCost={showCost}
      options={buttonOptions}
    />
  ) : null;
  return <FlowToolbar {...slots} isMobile={isMobile} icons={icons} extraChips={extraChips} />;
}
