import {useState, useCallback, useMemo} from 'react';
import type {SetStateAction} from 'react';
import type {Ink} from 'lorcana-synergy-engine';
import type {SetInfo} from '../../cards';
import type {CardFilterOptions} from '../../cards/loader';
import type {CardTypeFilter} from '../../../shared/constants';
import type {SynergyFilterState, StrengthTierFilter} from '../utils/filterSynergyCards';
import {EMPTY_SYNERGY_FILTERS} from '../utils/filterSynergyCards';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../../shared/constants';
import {FilterModal} from '../../../shared/components/FilterModal';
import {FilterDrawer} from '../../../shared/components/FilterDrawer';
import {FilterIcon} from '../../../shared/components/FilterIcon';
import type {ChipData} from '../../../shared/types';

/** Sort orders for synergy cards in expanded view. */
export type SynergySortOrder =
  | 'cost-asc'
  | 'cost-desc'
  | 'strength-desc'
  | 'strength-asc'
  | 'name-asc'
  | 'name-desc';

const SORT_OPTIONS = [
  {value: 'cost-asc', label: 'Cost: Low \u2192 High'},
  {value: 'cost-desc', label: 'Cost: High \u2192 Low'},
  {value: 'strength-desc', label: 'Score: High \u2192 Low'},
  {value: 'strength-asc', label: 'Score: Low \u2192 High'},
  {value: 'name-asc', label: 'Name A\u2013Z'},
  {value: 'name-desc', label: 'Name Z\u2013A'},
] satisfies {value: SynergySortOrder; label: string}[];

interface SynergyToolbarProps {
  /** Current filter state */
  filterState: SynergyFilterState;
  /** Number of cards after filtering */
  resultCount: number;
  /** Total cards in the group (before filtering) */
  totalCount: number;
  /** Callbacks for filter changes — supports functional updater to avoid stale closures */
  onFilterChange: (update: SetStateAction<SynergyFilterState>) => void;
  /** Sort state */
  sortOrder: SynergySortOrder;
  onSortChange: (order: SynergySortOrder) => void;
  /** Responsive flag */
  isMobile: boolean;
  /** Card data for filter modal options */
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  sets: SetInfo[];
}

const STRENGTH_TIERS: StrengthTierFilter[] = ['Strong', 'Moderate', 'Weak'];

export function SynergyToolbar({
  filterState,
  resultCount,
  totalCount,
  onFilterChange,
  sortOrder,
  onSortChange,
  isMobile,
  uniqueKeywords,
  uniqueClassifications,
  sets,
}: SynergyToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [filtersHover, setFiltersHover] = useState(false);
  const [clearHover, setClearHover] = useState(false);
  const [sortHover, setSortHover] = useState(false);
  const [sortFocus, setSortFocus] = useState(false);
  const [hoveredChip, setHoveredChip] = useState<string | null>(null);

  const {inkFilters, typeFilters, costFilters, filters, strengthFilters} = filterState;

  // Count active modal filters only (strength is controlled via inline toggles, not the modal)
  const activeFilterCount = useMemo(
    () =>
      inkFilters.length +
      typeFilters.length +
      costFilters.length +
      [filters.keywords?.length, filters.classifications?.length, filters.setCode].filter(Boolean)
        .length,
    [inkFilters, typeFilters, costFilters, filters],
  );

  // Build chip list from active filters (strength excluded — it has its own toggle row)
  // Uses functional updaters in onDismiss to avoid stale closure bugs under rapid interaction.
  const chips: ChipData[] = useMemo(() => {
    const result: ChipData[] = [];
    for (const ink of inkFilters) {
      result.push({
        id: `ink:${ink}`,
        label: ink,
        onDismiss: () =>
          onFilterChange((prev) => ({
            ...prev,
            inkFilters: prev.inkFilters.filter((i) => i !== ink),
          })),
      });
    }
    for (const type of typeFilters) {
      result.push({
        id: `type:${type}`,
        label: type,
        onDismiss: () =>
          onFilterChange((prev) => ({
            ...prev,
            typeFilters: prev.typeFilters.filter((t) => t !== type),
          })),
      });
    }
    for (const cost of costFilters) {
      result.push({
        id: `cost:${cost}`,
        label: `Cost ${cost}`,
        onDismiss: () =>
          onFilterChange((prev) => ({
            ...prev,
            costFilters: prev.costFilters.filter((c) => c !== cost),
          })),
      });
    }
    if (filters.keywords?.length) {
      result.push({
        id: `keyword:${filters.keywords[0]}`,
        label: filters.keywords[0],
        onDismiss: () =>
          onFilterChange((prev) => ({...prev, filters: {...prev.filters, keywords: undefined}})),
      });
    }
    if (filters.classifications?.length) {
      result.push({
        id: `classification:${filters.classifications[0]}`,
        label: filters.classifications[0],
        onDismiss: () =>
          onFilterChange((prev) => ({
            ...prev,
            filters: {...prev.filters, classifications: undefined},
          })),
      });
    }
    if (filters.setCode) {
      result.push({
        id: `set:${filters.setCode}`,
        label: `Set ${filters.setCode}`,
        onDismiss: () =>
          onFilterChange((prev) => ({...prev, filters: {...prev.filters, setCode: undefined}})),
      });
    }
    return result;
  }, [inkFilters, typeFilters, costFilters, filters, onFilterChange]);

  const hasChips = chips.length > 0;

  const handleApplyFilters = useCallback(
    (inks: Ink[], types: CardTypeFilter[], costs: number[], opts: CardFilterOptions) => {
      onFilterChange((prev) => ({
        ...prev,
        inkFilters: inks,
        typeFilters: types,
        costFilters: costs,
        filters: opts,
      }));
    },
    [onFilterChange],
  );

  const handleClearAll = useCallback(() => {
    onFilterChange(EMPTY_SYNERGY_FILTERS);
  }, [onFilterChange]);

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onSortChange(e.target.value as SynergySortOrder);
    },
    [onSortChange],
  );

  const toggleStrength = useCallback(
    (tier: StrengthTierFilter) => {
      // Single-select: clicking the active tier deselects, clicking another switches
      onFilterChange((prev) => ({
        ...prev,
        strengthFilters: prev.strengthFilters.includes(tier) ? [] : [tier],
      }));
    },
    [onFilterChange],
  );

  const sortBorderColor = sortFocus
    ? 'rgba(212, 175, 55, 0.4)'
    : sortHover
      ? COLORS.gray300
      : COLORS.surfaceBorder;

  const FilterPanel = isMobile ? FilterDrawer : FilterModal;

  return (
    <>
      <div
        data-testid="synergy-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? SPACING.sm : 10,
          flexWrap: 'wrap',
          marginBottom: `${SPACING.lg}px`,
        }}>
        {/* Filters button */}
        <button
          onClick={() => setFilterOpen(true)}
          onMouseEnter={() => setFiltersHover(true)}
          onMouseLeave={() => setFiltersHover(false)}
          aria-label="Filters"
          style={{
            height: 34,
            padding: isMobile ? '0 12px' : '0 14px',
            border: 'none',
            background: COLORS.filterGradient,
            color: COLORS.filterText,
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.base}px`,
            fontWeight: 500,
            borderRadius: `${RADIUS.lg}px`,
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: isMobile
              ? '0px 6px 10px 0px rgba(254, 154, 0, 0.15)'
              : '0px 8px 12px 0px rgba(254, 154, 0, 0.15), 0px 3px 5px 0px rgba(254, 154, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            opacity: filtersHover ? 0.9 : 1,
            transition: 'opacity 0.15s',
          }}>
          <FilterIcon />
          Filters
          {activeFilterCount > 0 && (
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.3)',
                color: '#ffffff',
                fontSize: `${FONT_SIZES.xs}px`,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Divider */}
        <span style={{width: 1, height: 20, background: COLORS.surfaceBorder, flexShrink: 0}} />

        {/* Result count */}
        <span
          data-testid="synergy-result-count"
          style={{
            fontSize: `${FONT_SIZES.base}px`,
            fontWeight: 600,
            color: COLORS.textMuted,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}>
          <strong style={{color: COLORS.text, fontWeight: 700}}>{resultCount}</strong>{' '}
          {resultCount === totalCount ? 'cards' : `of ${totalCount} cards`}
        </span>

        {/* Strength tier toggle chips */}
        <div style={{display: 'flex', gap: 6, ...(isMobile ? {flexShrink: 0} : {})}}>
          {STRENGTH_TIERS.map((tier) => {
            const active = strengthFilters.includes(tier);
            const isHovered = hoveredChip === `strength-${tier}`;
            return (
              <button
                key={tier}
                onClick={() => toggleStrength(tier)}
                onMouseEnter={() => setHoveredChip(`strength-${tier}`)}
                onMouseLeave={() => setHoveredChip(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: isMobile ? '5px 10px' : '5px 12px',
                  borderRadius: 20,
                  background: active
                    ? isHovered
                      ? 'rgba(212, 175, 55, 0.18)'
                      : 'rgba(212, 175, 55, 0.1)'
                    : isHovered
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'transparent',
                  border: `1px solid ${active ? 'rgba(212, 175, 55, 0.25)' : COLORS.surfaceBorder}`,
                  color: active ? COLORS.primary500 : COLORS.textMuted,
                  fontFamily: FONTS.body,
                  fontSize: `${FONT_SIZES.base}px`,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  ...(isMobile ? {minHeight: 44} : {}),
                }}>
                {tier}
              </button>
            );
          })}
        </div>

        {/* Active filter chips */}
        {hasChips && (
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              ...(isMobile ? {flexBasis: '100%'} : {flex: 1}),
            }}>
            {chips.map((chip) => {
              const isHovered = hoveredChip === chip.id;
              return (
                <button
                  key={chip.id}
                  onClick={chip.onDismiss}
                  onMouseEnter={() => setHoveredChip(chip.id)}
                  onMouseLeave={() => setHoveredChip(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? 5 : 6,
                    padding: isMobile ? '5px 8px 5px 10px' : '5px 10px 5px 12px',
                    borderRadius: 20,
                    background: isHovered ? 'rgba(212, 175, 55, 0.18)' : 'rgba(212, 175, 55, 0.1)',
                    border: `1px solid ${isHovered ? 'rgba(212, 175, 55, 0.4)' : 'rgba(212, 175, 55, 0.25)'}`,
                    color: COLORS.primary500,
                    fontFamily: FONTS.body,
                    fontSize: `${FONT_SIZES.base}px`,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}>
                  {chip.label}
                  <span
                    style={{
                      fontSize: `${FONT_SIZES.base}px`,
                      color: isHovered ? COLORS.text : COLORS.textMuted,
                      fontWeight: 600,
                      lineHeight: 1,
                    }}>
                    ×
                  </span>
                </button>
              );
            })}
            <button
              onClick={handleClearAll}
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

        {/* Sort — desktop only */}
        {!isMobile && (
          <select
            aria-label="Sort synergies"
            value={sortOrder}
            onChange={handleSortChange}
            onMouseEnter={() => setSortHover(true)}
            onMouseLeave={() => setSortHover(false)}
            onFocus={() => setSortFocus(true)}
            onBlur={() => setSortFocus(false)}
            style={{
              marginLeft: hasChips ? undefined : 'auto',
              padding: '5px 10px',
              borderRadius: `${RADIUS.md}px`,
              border: `1px solid ${sortBorderColor}`,
              background: COLORS.sortBg,
              color: COLORS.text,
              fontFamily: FONTS.body,
              fontSize: `${FONT_SIZES.base}px`,
              cursor: 'pointer',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}>
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Filter modal/drawer */}
      <FilterPanel
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={handleApplyFilters}
        inkFilters={inkFilters}
        typeFilters={typeFilters}
        costFilters={costFilters}
        filters={filters}
        uniqueKeywords={uniqueKeywords}
        uniqueClassifications={uniqueClassifications}
        sets={sets}
      />
    </>
  );
}
