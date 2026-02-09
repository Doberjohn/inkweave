import {useState, useMemo} from 'react';
import type {LorcanaCard, Ink} from '../types';
import type {CardFilterOptions, SetInfo} from '../loader';
import {CardTile} from './CardTile';
import {
  LoadingSpinner,
  FilterDrawer,
  FilterButton,
  FilterSection,
} from '../../../shared/components';
import {
  INK_COLORS,
  ALL_INKS,
  COLORS,
  FONT_SIZES,
  RADIUS,
  SPACING,
  LAYOUT,
  LAYOUT_MOBILE,
  CARD_TYPES,
  COST_OPTIONS,
  SELECT_STYLE_SM,
} from '../../../shared/constants';
import {isCardType} from '../utils';

interface CardListProps {
  cards: LorcanaCard[];
  isLoading: boolean;
  selectedCard: LorcanaCard | null;
  searchQuery: string;
  inkFilter: Ink | 'all';
  filters: CardFilterOptions;
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  sets: SetInfo[];
  onSearchChange: (query: string) => void;
  onInkFilterChange: (ink: Ink | 'all') => void;
  onFiltersChange: (filters: CardFilterOptions) => void;
  onCardSelect: (card: LorcanaCard) => void;
  isMobile?: boolean;
}

export function CardList({
  cards,
  isLoading,
  selectedCard,
  searchQuery,
  inkFilter,
  filters,
  uniqueKeywords,
  uniqueClassifications,
  sets,
  onSearchChange,
  onInkFilterChange,
  onFiltersChange,
  onCardSelect,
  isMobile = false,
}: CardListProps) {
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Memoize the sliced array to avoid creating new array on every render
  const displayedCards = useMemo(() => cards.slice(0, LAYOUT.maxDisplayedCards), [cards]);

  const selectedType = isCardType(filters.type) ? filters.type : undefined;
  const activeFilterCount = [
    inkFilter !== 'all',
    filters.type,
    filters.minCost !== undefined,
    filters.maxCost !== undefined,
    filters.keywords?.length,
    filters.classifications?.length,
    filters.setCode,
  ].filter(Boolean).length;

  const updateFilter = <K extends keyof CardFilterOptions>(key: K, value: CardFilterOptions[K]) => {
    const newFilters = {...filters};
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    onFiltersChange({});
    onInkFilterChange('all');
    onSearchChange('');
  };

  // Mobile layout
  if (isMobile) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: `calc(100vh - ${LAYOUT_MOBILE.headerHeight}px - ${LAYOUT_MOBILE.bottomNavHeight}px)`,
          background: COLORS.background,
        }}>
        {isLoading ? (
          <div style={{padding: `${SPACING.lg}px`}}>
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {/* Mobile Search Header */}
            <div
              style={{
                padding: `${SPACING.md}px ${SPACING.lg}px`,
                background: COLORS.background,
                borderBottom: `1px solid ${COLORS.gray200}`,
                position: 'sticky',
                top: 0,
                zIndex: 10,
              }}>
              <div style={{display: 'flex', gap: `${SPACING.md}px`}}>
                <input
                  type="text"
                  placeholder="Search cards..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: `${RADIUS.lg}px`,
                    border: `1px solid ${COLORS.surfaceBorder}`,
                    background: COLORS.surfaceAlt,
                    color: COLORS.text,
                    fontSize: '16px', // Prevent iOS zoom
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={() => setShowFilterDrawer(true)}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: `${RADIUS.lg}px`,
                    border: `1px solid ${COLORS.gray200}`,
                    background: activeFilterCount > 0 ? COLORS.primary100 : COLORS.surface,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    flexShrink: 0,
                  }}
                  aria-label={`Filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}>
                  <FilterIcon color={activeFilterCount > 0 ? COLORS.primary600 : COLORS.gray600} />
                  {activeFilterCount > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        background: COLORS.primary600,
                        color: COLORS.white,
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        fontSize: `${FONT_SIZES.xs}px`,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>
              <p
                style={{
                  fontSize: `${FONT_SIZES.sm}px`,
                  color: COLORS.gray400,
                  marginTop: `${SPACING.sm}px`,
                  marginBottom: 0,
                }}>
                {displayedCards.length} of {cards.length} cards
              </p>
            </div>

            {/* Card Grid */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: `${SPACING.md}px`,
              }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))',
                gap: '6px',
              }}>
                {displayedCards.map((card) => (
                  <CardTile
                    key={card.id}
                    card={card}
                    onClick={() => onCardSelect(card)}
                    isSelected={selectedCard?.id === card.id}
                  />
                ))}
              </div>
            </div>

            {/* Filter Drawer */}
            <FilterDrawer
              isOpen={showFilterDrawer}
              onClose={() => setShowFilterDrawer(false)}
              inkFilter={inkFilter}
              filters={filters}
              uniqueKeywords={uniqueKeywords}
              uniqueClassifications={uniqueClassifications}
              sets={sets}
              onInkFilterChange={onInkFilterChange}
              onFiltersChange={onFiltersChange}
              onClearAll={clearAllFilters}
            />
          </>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div
      style={{
        width: `${LAYOUT.sidebarWidth}px`,
        borderRight: `1px solid ${COLORS.gray200}`,
        background: COLORS.surface,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: `calc(100vh - ${LAYOUT.headerHeight}px)`,
      }}>
      {isLoading ? (
        <div style={{padding: `${SPACING.lg}px`}}>
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {/* Filter Panel - Fixed */}
          <div
            style={{padding: `${SPACING.lg}px`, paddingBottom: `${SPACING.sm}px`, flexShrink: 0}}>
            {/* Search */}
            <input
              type="text"
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: `${RADIUS.lg}px`,
                border: `1px solid ${COLORS.surfaceBorder}`,
                background: COLORS.surfaceAlt,
                color: COLORS.text,
                fontSize: `${FONT_SIZES.lg}px`,
                marginBottom: `${SPACING.md}px`,
                boxSizing: 'border-box',
              }}
            />

            {/* Ink Filter */}
            <FilterSection label="Ink" compact>
              <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap'}}>
                <FilterButton active={inkFilter === 'all'} onClick={() => onInkFilterChange('all')}>
                  All
                </FilterButton>
                {ALL_INKS.map((ink) => (
                  <FilterButton
                    key={ink}
                    active={inkFilter === ink}
                    onClick={() => onInkFilterChange(ink)}
                    activeColor={INK_COLORS[ink].border}
                    inactiveColor={INK_COLORS[ink].bg}
                    inactiveTextColor={INK_COLORS[ink].text}>
                    {ink}
                  </FilterButton>
                ))}
              </div>
            </FilterSection>

            {/* Card Type Filter */}
            <FilterSection label="Type" compact>
              <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap'}}>
                <FilterButton
                  active={!selectedType}
                  onClick={() => updateFilter('type', undefined)}>
                  All
                </FilterButton>
                {CARD_TYPES.map((type) => (
                  <FilterButton
                    key={type}
                    active={selectedType === type}
                    onClick={() => updateFilter('type', type)}>
                    {type}
                  </FilterButton>
                ))}
              </div>
            </FilterSection>

            {/* More Filters Toggle */}
            <button
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: COLORS.primary600,
                fontSize: `${FONT_SIZES.sm}px`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
              <span
                style={{
                  transform: showMoreFilters ? 'rotate(90deg)' : 'rotate(0)',
                  transition: 'transform 0.2s',
                }}>
                &#9654;
              </span>
              More filters {activeFilterCount > 0 && `(${activeFilterCount} active)`}
            </button>

            {/* Expanded Filters */}
            {showMoreFilters && (
              <div style={{marginTop: `${SPACING.md}px`}}>
                {/* Cost Range */}
                <FilterSection label="Cost" compact>
                  <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                    <select
                      value={filters.minCost ?? ''}
                      onChange={(e) =>
                        updateFilter('minCost', e.target.value ? Number(e.target.value) : undefined)
                      }
                      style={SELECT_STYLE_SM}>
                      <option value="">Min</option>
                      {COST_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <span style={{color: COLORS.gray400}}>-</span>
                    <select
                      value={filters.maxCost ?? ''}
                      onChange={(e) =>
                        updateFilter('maxCost', e.target.value ? Number(e.target.value) : undefined)
                      }
                      style={SELECT_STYLE_SM}>
                      <option value="">Max</option>
                      {COST_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </FilterSection>

                {/* Keywords */}
                <FilterSection label="Keyword" compact>
                  <select
                    value={filters.keywords?.[0] ?? ''}
                    onChange={(e) =>
                      updateFilter('keywords', e.target.value ? [e.target.value] : undefined)
                    }
                    style={{...SELECT_STYLE_SM, width: '100%'}}>
                    <option value="">Any keyword</option>
                    {uniqueKeywords.map((kw) => (
                      <option key={kw} value={kw}>
                        {kw}
                      </option>
                    ))}
                  </select>
                </FilterSection>

                {/* Classifications */}
                <FilterSection label="Classification" compact>
                  <select
                    value={filters.classifications?.[0] ?? ''}
                    onChange={(e) =>
                      updateFilter('classifications', e.target.value ? [e.target.value] : undefined)
                    }
                    style={{...SELECT_STYLE_SM, width: '100%'}}>
                    <option value="">Any classification</option>
                    {uniqueClassifications.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </FilterSection>

                {/* Set */}
                <FilterSection label="Set" compact>
                  <select
                    value={filters.setCode ?? ''}
                    onChange={(e) => updateFilter('setCode', e.target.value || undefined)}
                    style={{...SELECT_STYLE_SM, width: '100%'}}>
                    <option value="">Any set</option>
                    {sets.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </FilterSection>
              </div>
            )}

            {/* Clear Filters */}
            {(searchQuery || inkFilter !== 'all' || activeFilterCount > 0) && (
              <button
                onClick={clearAllFilters}
                style={{
                  marginTop: `${SPACING.sm}px`,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: COLORS.gray500,
                  fontSize: `${FONT_SIZES.sm}px`,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}>
                Clear all filters
              </button>
            )}

            {/* Card Count */}
            <p
              style={{
                fontSize: `${FONT_SIZES.md}px`,
                color: COLORS.gray400,
                marginTop: `${SPACING.md}px`,
                marginBottom: 0,
              }}>
              Showing {displayedCards.length} of {cards.length} cards
            </p>
          </div>

          {/* Card Grid - Scrollable */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: `${SPACING.sm}px ${SPACING.lg}px ${SPACING.lg}px`,
            }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))',
              gap: '6px',
            }}>
              {displayedCards.map((card) => (
                <CardTile
                  key={card.id}
                  card={card}
                  onClick={() => onCardSelect(card)}
                  isSelected={selectedCard?.id === card.id}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FilterIcon({color}: {color: string}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
