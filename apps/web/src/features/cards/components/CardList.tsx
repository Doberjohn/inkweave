import {useState, useMemo} from 'react';
import type {LorcanaCard, Ink} from '../types';
import type {CardFilterOptions, SetInfo} from '../loader';
import {CardTile} from './CardTile';
import {LoadingSpinner, FilterDrawer} from '../../../shared/components';
import {COLORS, FONT_SIZES, RADIUS, SPACING, LAYOUT} from '../../../shared/constants';

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
  /** Back button handler for mobile linear flow */
  onBack?: () => void;
  /** Opens the filter modal (desktop browsing state) */
  onFiltersClick?: () => void;
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
  onBack,
  onFiltersClick,
}: CardListProps) {
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Memoize the sliced array to avoid creating new array on every render
  const displayedCards = useMemo(() => cards.slice(0, LAYOUT.maxDisplayedCards), [cards]);

  const activeFilterCount = [
    inkFilter !== 'all',
    filters.type,
    filters.minCost !== undefined,
    filters.maxCost !== undefined,
    filters.keywords?.length,
    filters.classifications?.length,
    filters.setCode,
  ].filter(Boolean).length;

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
          height: '100vh',
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
              <div style={{display: 'flex', gap: `${SPACING.md}px`, alignItems: 'center'}}>
                {onBack && (
                  <button
                    onClick={onBack}
                    aria-label="Back to home"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: COLORS.primary,
                      fontSize: `${FONT_SIZES.xl}px`,
                      cursor: 'pointer',
                      padding: `${SPACING.xs}px`,
                      flexShrink: 0,
                      lineHeight: 1,
                    }}>
                    ←
                  </button>
                )}
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
                    disablePreview
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
            {/* Search + Filters */}
            <div style={{display: 'flex', gap: `${SPACING.sm}px`, marginBottom: `${SPACING.md}px`}}>
              <input
                type="text"
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: `${RADIUS.lg}px`,
                  border: `1px solid ${COLORS.surfaceBorder}`,
                  background: COLORS.surfaceAlt,
                  color: COLORS.text,
                  fontSize: `${FONT_SIZES.lg}px`,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              {onFiltersClick && (
                <button
                  onClick={onFiltersClick}
                  aria-label={`Filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: `${RADIUS.lg}px`,
                    border: `1px solid ${COLORS.gray200}`,
                    background: activeFilterCount > 0 ? COLORS.primary100 : COLORS.surface,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    flexShrink: 0,
                  }}>
                  <FilterIcon color={activeFilterCount > 0 ? COLORS.primary600 : COLORS.gray600} />
                  {activeFilterCount > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        background: COLORS.primary600,
                        color: COLORS.white,
                        width: '18px',
                        height: '18px',
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
              )}
            </div>

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
