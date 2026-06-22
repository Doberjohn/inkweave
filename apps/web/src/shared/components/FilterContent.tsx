import type {Ink, SetInfo} from '../../features/cards';
import type {CardFilterOptions} from '../../features/cards';
import type {CardTypeFilter} from '../constants';
import type {InkwellValue} from './InkwellIcon';
import {CARD_TYPE_FILTERS, COST_BUTTONS, COLORS, SELECT_STYLE_MD} from '../constants';
import {CostIcon} from './CostIcon';
import {FilterButton} from './FilterButton';
import {FilterSection} from './FilterSection';
import {InkFilterGroup} from './InkFilterGroup';
import {InkwellIcon} from './InkwellIcon';

/** Shared props for FilterModal (desktop) and FilterDrawer (mobile). */
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
  sets: SetInfo[];
}

interface FilterContentProps {
  inkFilters: Ink[];
  typeFilters: CardTypeFilter[];
  costFilters: number[];
  filters: CardFilterOptions;
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  sets: SetInfo[];
  onToggleInk: (ink: Ink) => void;
  onToggleType: (type: CardTypeFilter) => void;
  onToggleCost: (cost: number) => void;
  onFiltersChange: (filters: CardFilterOptions) => void;
  /** Layout variant controls icon sizing and flex layout per section */
  variant: 'desktop' | 'mobile';
  /**
   * Whether the cost icons are shown inline in the toolbar. When false (narrow
   * desktop), the modal renders the Ink Cost section so cost stays reachable.
   * Ignored on mobile (cost always shows there). Defaults to true.
   */
  showInlineCost?: boolean;
}

interface SelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  label: string;
  ariaLabel: string;
  value: string;
  placeholder: string;
  options: SelectOption[];
  /** Receives the raw selected value, or '' when the placeholder is chosen. */
  onChange: (value: string) => void;
}

// A filter value is "empty" (and should be deleted rather than stored) when it's
// unset, a blank string, or an empty array. Encapsulated so the branch logic in
// updateFilter stays a single named predicate instead of a complex conditional.
function isEmptyFilterValue(value: unknown): boolean {
  return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

// Module-level value transforms keep their ternaries out of FilterContent's CC.
// Keywords/classifications store a single-element array; an empty pick clears them.
function singleOrUndefined(value: string): string[] | undefined {
  return value ? [value] : undefined;
}

// Set stores a bare code; an empty pick clears it.
function stringOrUndefined(value: string): string | undefined {
  return value || undefined;
}

// Plain string lists (keywords, classifications) map value === label.
function toOptions(values: string[]): SelectOption[] {
  return values.map((value) => ({value, label: value}));
}

// Sets show their display name but filter by code.
function setsToOptions(sets: SetInfo[]): SelectOption[] {
  return sets.map((s) => ({value: s.code, label: s.name}));
}

// Cost shows in the panel on mobile, and on desktop only when its toolbar icons
// are tucked away (narrow desktop). Hoisted out of the component to keep its CC down.
function shouldShowCostSection(isDesktop: boolean, showInlineCost: boolean): boolean {
  return !isDesktop || !showInlineCost;
}

// Each section below is its own module-level component so its .map()/ternary
// branches don't count toward FilterContent's cyclomatic complexity. FilterContent
// is left as a thin composition shell. Mirrors the original CostFilterSection.

// Extracted into its own component so the cost-button .map() branch doesn't count
// toward FilterContent's (already large) cyclomatic complexity.
function CostFilterSection({
  costFilters,
  onToggleCost,
}: {
  costFilters: number[];
  onToggleCost: (cost: number) => void;
}) {
  return (
    <FilterSection label="Ink Cost">
      <div
        role="group"
        aria-label="Ink cost filters"
        style={{display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center'}}>
        {COST_BUTTONS.map((cost) => (
          <FilterButton
            key={cost}
            size="sm"
            active={costFilters.includes(cost)}
            onClick={() => onToggleCost(cost)}
            activeColor={COLORS.primary}
            activeBgColor={COLORS.primary200}
            inactiveColor="transparent"
            inactiveTextColor="transparent"
            aria-label={`Cost ${cost}${cost === 9 ? '+' : ''}`}>
            <CostIcon cost={cost} size={34} />
          </FilterButton>
        ))}
      </div>
    </FilterSection>
  );
}

// Mobile-only: desktop renders ink icons inline in the toolbar instead.
function InkFilterSection({
  inkFilters,
  onToggleInk,
}: {
  inkFilters: Ink[];
  onToggleInk: (ink: Ink) => void;
}) {
  return (
    <FilterSection label="Ink">
      <InkFilterGroup
        inkFilters={inkFilters}
        onToggleInk={onToggleInk}
        size="sm"
        iconSize={30}
        style={{
          flexWrap: 'nowrap',
          justifyContent: 'space-evenly',
        }}
      />
    </FilterSection>
  );
}

// Mobile-only: desktop renders the inkable/uninkable toggles inline in the toolbar.
function InkwellFilterSection({
  filters,
  onFiltersChange,
}: {
  filters: CardFilterOptions;
  onFiltersChange: (filters: CardFilterOptions) => void;
}) {
  return (
    <FilterSection label="Inkwell">
      <div
        role="group"
        aria-label="Inkwell filters"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-evenly',
        }}>
        {(['inkable', 'uninkable'] as InkwellValue[]).map((value) => (
          <FilterButton
            key={value}
            size="md"
            active={filters.inkwell === value}
            onClick={() =>
              onFiltersChange({
                ...filters,
                inkwell: filters.inkwell === value ? undefined : value,
              })
            }
            activeColor={COLORS.primary500}
            activeBgColor={COLORS.primary200}>
            <span style={{display: 'flex', alignItems: 'center', gap: 6}}>
              <InkwellIcon value={value} size={18} />
              {value === 'inkable' ? 'Inkable' : 'Uninkable'}
            </span>
          </FilterButton>
        ))}
      </div>
    </FilterSection>
  );
}

// Card Type toggles. Label and layout differ slightly between variants.
function CardTypeFilterSection({
  typeFilters,
  onToggleType,
  isDesktop,
}: {
  typeFilters: CardTypeFilter[];
  onToggleType: (type: CardTypeFilter) => void;
  isDesktop: boolean;
}) {
  return (
    <FilterSection label={isDesktop ? 'Card Type' : 'Type'}>
      <div
        role="group"
        aria-label="Card type filters"
        style={{
          display: 'flex',
          gap: isDesktop ? '8px' : undefined,
          flexWrap: 'wrap',
          justifyContent: isDesktop ? undefined : 'space-evenly',
        }}>
        {CARD_TYPE_FILTERS.map((type) => (
          <FilterButton
            key={type}
            size="md"
            active={typeFilters.includes(type)}
            onClick={() => onToggleType(type)}
            activeColor={COLORS.primary500}
            activeBgColor={COLORS.primary200}>
            {type}
          </FilterButton>
        ))}
      </div>
    </FilterSection>
  );
}

// Single-select dropdown shared by the Keywords, Classification, and Set sections.
// They differ only in label/aria/placeholder/options/onChange, all passed as props.
function FilterSelect({label, ariaLabel, value, placeholder, options, onChange}: FilterSelectProps) {
  return (
    <FilterSection label={label}>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{...SELECT_STYLE_MD, width: '100%'}}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FilterSection>
  );
}

/**
 * Shared filter sections rendered identically in FilterModal (desktop) and
 * FilterDrawer (mobile). Only layout tuning differs between variants.
 */
export function FilterContent({
  inkFilters,
  typeFilters,
  costFilters,
  filters,
  uniqueKeywords,
  uniqueClassifications,
  sets,
  onToggleInk,
  onToggleType,
  onToggleCost,
  onFiltersChange,
  variant,
  showInlineCost = true,
}: FilterContentProps) {
  const updateFilter = <K extends keyof CardFilterOptions>(key: K, value: CardFilterOptions[K]) => {
    const newFilters = {...filters};
    if (isEmptyFilterValue(value)) {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    onFiltersChange(newFilters);
  };

  const isDesktop = variant === 'desktop';
  const showCostSection = shouldShowCostSection(isDesktop, showInlineCost);

  return (
    <>
      {/* Ink Color (desktop has these inline in the toolbar) */}
      {!isDesktop && <InkFilterSection inkFilters={inkFilters} onToggleInk={onToggleInk} />}

      {/* Ink Cost (inline in the toolbar on wide desktop; shown here otherwise) */}
      {showCostSection && (
        <CostFilterSection costFilters={costFilters} onToggleCost={onToggleCost} />
      )}

      {/* Inkwell (desktop has these inline in the toolbar) */}
      {!isDesktop && (
        <InkwellFilterSection filters={filters} onFiltersChange={onFiltersChange} />
      )}

      {/* Card Type Filter */}
      <CardTypeFilterSection
        typeFilters={typeFilters}
        onToggleType={onToggleType}
        isDesktop={isDesktop}
      />

      {/* Keywords */}
      <FilterSelect
        label={isDesktop ? 'Keywords' : 'Keyword'}
        ariaLabel="Filter by keyword"
        value={filters.keywords?.[0] ?? ''}
        placeholder="Any keyword"
        options={toOptions(uniqueKeywords)}
        onChange={(v) => updateFilter('keywords', singleOrUndefined(v))}
      />

      {/* Classification */}
      <FilterSelect
        label="Classification"
        ariaLabel="Filter by classification"
        value={filters.classifications?.[0] ?? ''}
        placeholder="Any classification"
        options={toOptions(uniqueClassifications)}
        onChange={(v) => updateFilter('classifications', singleOrUndefined(v))}
      />

      {/* Set */}
      <FilterSelect
        label="Set"
        ariaLabel="Filter by set"
        value={filters.setCode ?? ''}
        placeholder="Any set"
        options={setsToOptions(sets)}
        onChange={(v) => updateFilter('setCode', stringOrUndefined(v))}
      />
    </>
  );
}
