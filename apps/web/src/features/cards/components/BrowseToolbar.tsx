import {useState, useCallback} from 'react';
import type {Ink} from 'lorcana-synergy-engine';
import type {CardFilterOptions} from '../loader';
import type {CardTypeFilter, BrowseSortOrder} from '../../../shared/constants';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../../shared/constants';

interface BrowseToolbarProps {
  resultCount: number;
  totalCount: number;
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
}

/** Filter icon SVG — 3 horizontal lines of decreasing width */
function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12M4 8h8M6 12h4" stroke="#0f172b" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

interface ChipData {
  label: string;
  onDismiss: () => void;
}

export function BrowseToolbar({
  resultCount,
  totalCount,
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
}: BrowseToolbarProps) {
  const [filtersHover, setFiltersHover] = useState(false);
  const [clearHover, setClearHover] = useState(false);
  const [sortHover, setSortHover] = useState(false);
  const [sortFocus, setSortFocus] = useState(false);
  const [hoveredChip, setHoveredChip] = useState<string | null>(null);

  // Build active filter chips from all filter sources
  const chips: ChipData[] = [];
  for (const ink of inkFilters) chips.push({label: ink, onDismiss: () => onToggleInk(ink)});
  for (const type of typeFilters) chips.push({label: type, onDismiss: () => onToggleType(type)});
  for (const cost of costFilters)
    chips.push({label: `Cost ${cost}`, onDismiss: () => onToggleCost(cost)});
  if (filters.keywords?.length)
    chips.push({
      label: filters.keywords[0],
      onDismiss: () => onFiltersChange({...filters, keywords: undefined}),
    });
  if (filters.classifications?.length)
    chips.push({
      label: filters.classifications[0],
      onDismiss: () => onFiltersChange({...filters, classifications: undefined}),
    });
  if (filters.setCode)
    chips.push({
      label: `Set ${filters.setCode}`,
      onDismiss: () => onFiltersChange({...filters, setCode: undefined}),
    });

  const hasChips = chips.length > 0;

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onSortChange(e.target.value as BrowseSortOrder);
    },
    [onSortChange],
  );

  const sortBorderColor = sortFocus
    ? 'rgba(212, 175, 55, 0.4)'
    : sortHover
      ? COLORS.gray300
      : COLORS.surfaceBorder;

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
      {/* Filters button */}
      <button
        onClick={onFiltersClick}
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
      <span
        style={{
          width: 1,
          height: 20,
          background: COLORS.surfaceBorder,
          flexShrink: 0,
        }}
      />

      {/* Result count */}
      <span
        data-testid="result-count"
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
            const isHovered = hoveredChip === chip.label;
            return (
              <button
                key={chip.label}
                onClick={chip.onDismiss}
                onMouseEnter={() => setHoveredChip(chip.label)}
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

      {/* Sort — desktop only (mobile renders its own full-width sort row) */}
      {!isMobile && (
        <select
          aria-label="Sort cards"
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
          <option value="newest">Newest first</option>
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="cost-asc">Cost: Low → High</option>
          <option value="cost-desc">Cost: High → Low</option>
        </select>
      )}
    </div>
  );
}
