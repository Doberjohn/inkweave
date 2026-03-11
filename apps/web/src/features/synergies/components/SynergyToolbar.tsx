import {useState, useCallback, useMemo} from 'react';
import type {SetStateAction} from 'react';
import type {Ink} from 'inkweave-synergy-engine';
import type {SetInfo} from '../../cards';
import type {CardFilterOptions} from '../../cards/loader';
import type {CardTypeFilter, SynergySortOrder} from '../../../shared/constants';
import type {SynergyFilterState, StrengthTierFilter} from '../utils/filterSynergyCards';
import {EMPTY_SYNERGY_FILTERS} from '../utils/filterSynergyCards';
import {SYNERGY_SORT_OPTIONS, COLORS, FONTS, FONT_SIZES, SPACING} from '../../../shared/constants';
import {FilterModal} from '../../../shared/components/FilterModal';
import {FilterDrawer} from '../../../shared/components/FilterDrawer';
import {FilterChip} from '../../../shared/components/FilterChip';
import {FiltersButton} from '../../../shared/components/FiltersButton';
import {InkFilterGroup} from '../../../shared/components/InkFilterGroup';
import {SortSelect} from '../../../shared/components/SortSelect';
import type {ChipData} from '../../../shared/types';

interface SynergyToolbarProps {
  /** Current filter state */
  filterState: SynergyFilterState;
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
  onFilterChange,
  sortOrder,
  onSortChange,
  isMobile,
  uniqueKeywords,
  uniqueClassifications,
  sets,
}: SynergyToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [clearHover, setClearHover] = useState(false);
  const [hoveredTier, setHoveredTier] = useState<string | null>(null);

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
  // Desktop shows ink icons inline, so skip ink chips there
  // Uses functional updaters in onDismiss to avoid stale closure bugs under rapid interaction.
  const chips: ChipData[] = useMemo(() => {
    const result: ChipData[] = [];
    if (isMobile) {
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
  }, [isMobile, inkFilters, typeFilters, costFilters, filters, onFilterChange]);

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

  const toggleInk = useCallback(
    (ink: Ink) => {
      onFilterChange((prev) => ({
        ...prev,
        inkFilters: prev.inkFilters.includes(ink)
          ? prev.inkFilters.filter((i) => i !== ink)
          : [...prev.inkFilters, ink],
      }));
    },
    [onFilterChange],
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
        <FiltersButton
          onClick={() => setFilterOpen(true)}
          activeCount={activeFilterCount}
          isMobile={isMobile}
        />

        {/* Strength tier toggle chips */}
        <div style={{display: 'flex', gap: 6, ...(isMobile ? {flexShrink: 0} : {})}}>
          {STRENGTH_TIERS.map((tier) => {
            const active = strengthFilters.includes(tier);
            const isHovered = hoveredTier === `strength-${tier}`;
            return (
              <button
                key={tier}
                onClick={() => toggleStrength(tier)}
                onMouseEnter={() => setHoveredTier(`strength-${tier}`)}
                onMouseLeave={() => setHoveredTier(null)}
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
                      ? 'rgba(255, 185, 0, 0.06)'
                      : 'transparent',
                  border: `1px solid ${
                    active
                      ? 'rgba(212, 175, 55, 0.25)'
                      : isHovered
                        ? 'rgba(255, 185, 0, 0.25)'
                        : COLORS.surfaceBorder
                  }`,
                  color: active || isHovered ? COLORS.primary500 : COLORS.textMuted,
                  fontFamily: FONTS.body,
                  fontSize: `${FONT_SIZES.base}px`,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow:
                    active || isHovered
                      ? '0 0 12px rgba(255, 185, 0, 0.15), inset 0 0 8px rgba(255, 185, 0, 0.05)'
                      : 'none',
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
            {chips.map((chip) => (
              <FilterChip
                key={chip.id}
                label={chip.label}
                onDismiss={chip.onDismiss}
                isMobile={isMobile}
              />
            ))}
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

        {/* Right side: ink filters (desktop) + sort */}
        {!isMobile && (
          <div
            style={{
              marginLeft: hasChips ? undefined : 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
            <InkFilterGroup inkFilters={inkFilters} onToggleInk={toggleInk} />
            <SortSelect
              options={SYNERGY_SORT_OPTIONS}
              value={sortOrder}
              onChange={onSortChange}
              ariaLabel="Sort synergies"
            />
          </div>
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
