import {useCallback, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {BrowseCardGrid, BrowseToolbar, CardTile} from '../features/cards';
import {
  searchCardsByName,
  filterCards,
  sortBySetThenNumber,
  sortCardsByName,
  sortCardsByCost,
  type CardFilterOptions,
} from '../features/cards/loader';
import {
  CompactHeader,
  ErrorBoundary,
  EtherealBackground,
  FilterDrawer,
  FilterModal,
} from '../shared/components';
import {COLORS, FONTS, FONT_SIZES, LAYOUT, RADIUS, SPACING} from '../shared/constants';
import type {BrowseSortOrder} from '../shared/constants';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useResponsive, useFilterParams} from '../shared/hooks';

function applySortOrder(
  cards: import('inkweave-synergy-engine').LorcanaCard[],
  order: BrowseSortOrder,
) {
  switch (order) {
    case 'newest':
      return sortBySetThenNumber(cards);
    case 'name-asc':
      return sortCardsByName(cards, 'asc');
    case 'name-desc':
      return sortCardsByName(cards, 'desc');
    case 'cost-asc':
      return sortCardsByCost(cards, 'asc');
    case 'cost-desc':
      return sortCardsByCost(cards, 'desc');
  }
}

export function BrowsePage() {
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {cards, isLoading, totalCards, uniqueKeywords, uniqueClassifications, sets} =
    useCardDataContext();
  const {
    searchQuery,
    setSearchQuery,
    inkFilters,
    toggleInk,
    typeFilters,
    toggleType,
    costFilters,
    toggleCost,
    filters,
    setFilters,
    replaceFilters,
    clearAllFilters,
    activeFilterCount,
    sortOrder,
    setSortOrder,
  } = useFilterParams();
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const combinedFilters = useMemo<CardFilterOptions>(() => {
    const combined = {...filters};
    if (inkFilters.length > 0) combined.ink = inkFilters;
    if (typeFilters.length > 0) combined.type = typeFilters;
    if (costFilters.length > 0) combined.costs = costFilters;
    return combined;
  }, [filters, inkFilters, typeFilters, costFilters]);

  const sortedCards = useMemo(() => {
    let result = cards;
    if (searchQuery.trim()) result = searchCardsByName(result, searchQuery);
    if (Object.keys(combinedFilters).length > 0) result = filterCards(result, combinedFilters);
    return applySortOrder(result, sortOrder);
  }, [cards, searchQuery, combinedFilters, sortOrder]);

  const goHome = useCallback(() => {
    clearAllFilters();
    navigate('/');
  }, [clearAllFilters, navigate]);

  const selectCard = useCallback((card: {id: string}) => navigate(`/card/${card.id}`), [navigate]);

  const toolbarProps = {
    resultCount: sortedCards.length,
    totalCount: totalCards,
    onFiltersClick: isMobile ? () => setShowFilterDrawer(true) : () => setShowFilterModal(true),
    activeFilterCount,
    inkFilters,
    typeFilters,
    costFilters,
    filters,
    onToggleInk: toggleInk,
    onToggleType: toggleType,
    onToggleCost: toggleCost,
    onFiltersChange: setFilters,
    onClearAll: clearAllFilters,
    sortOrder,
    onSortChange: setSortOrder,
  } as const;

  // Mobile layout
  if (isMobile) {
    const displayedCards = sortedCards.slice(0, LAYOUT.maxDisplayedCards);
    return (
      <main
        style={{
          minHeight: '100vh',
          background: COLORS.background,
          fontFamily: FONTS.body,
          position: 'relative',
        }}>
        <EtherealBackground />
        <CompactHeader
          onLogoClick={goHome}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isMobile
        />
        <div style={{position: 'relative', zIndex: 1}}>
          {/* Page title */}
          <h1
            style={{
              padding: `${SPACING.lg}px ${SPACING.lg}px 0`,
              fontSize: `${FONT_SIZES.xl}px`,
              fontWeight: 700,
              color: COLORS.text,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
            Browse Cards
          </h1>
          {/* Toolbar */}
          <BrowseToolbar {...toolbarProps} isMobile />
          {/* Sort row — full-width on mobile */}
          <div
            style={{
              width: '100%',
              padding: `${SPACING.sm}px ${SPACING.lg}px 0`,
              position: 'relative',
              zIndex: 1,
            }}>
            <select
              aria-label="Sort cards"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as BrowseSortOrder)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: `${RADIUS.md}px`,
                border: `1px solid ${COLORS.surfaceBorder}`,
                background: COLORS.sortBg,
                color: COLORS.text,
                fontFamily: FONTS.body,
                fontSize: `${FONT_SIZES.base}px`,
                cursor: 'pointer',
                outline: 'none',
              }}>
              <option value="newest">Newest first</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="cost-asc">Cost: Low → High</option>
              <option value="cost-desc">Cost: High → Low</option>
            </select>
          </div>
          {/* Card grid */}
          <ErrorBoundary>
            {isLoading ? (
              <div style={{display: 'flex', justifyContent: 'center', padding: 64}}>
                <div style={{color: COLORS.textMuted}}>Loading...</div>
              </div>
            ) : displayedCards.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: 64,
                  color: COLORS.textMuted,
                  fontSize: `${FONT_SIZES.xl}px`,
                }}>
                No cards match your filters.
              </div>
            ) : (
              <div style={{padding: `${SPACING.md}px ${SPACING.lg}px 48px`}}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 10,
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                  }}>
                  {displayedCards.map((card) => (
                    <CardTile
                      key={card.id}
                      card={card}
                      isSelected={false}
                      onSelect={selectCard}
                      variant="minimal"
                      useThumbnail
                      borderRadius={10}
                    />
                  ))}
                </div>
              </div>
            )}
          </ErrorBoundary>
        </div>
        <FilterDrawer
          isOpen={showFilterDrawer}
          onClose={() => setShowFilterDrawer(false)}
          onApply={replaceFilters}
          inkFilters={inkFilters}
          typeFilters={typeFilters}
          costFilters={costFilters}
          filters={filters}
          uniqueKeywords={uniqueKeywords}
          uniqueClassifications={uniqueClassifications}
          sets={sets}
        />
      </main>
    );
  }

  // Desktop layout
  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}>
      <EtherealBackground />
      <CompactHeader
        onLogoClick={goHome}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div
        style={{
          flex: 1,
          minHeight: `calc(100vh - ${LAYOUT.compactHeaderHeight}px)`,
          position: 'relative',
          zIndex: 1,
        }}>
        {/* Page title */}
        <h1
          style={{
            padding: `${SPACING.xxl}px 32px 0`,
            fontSize: `${FONT_SIZES.xl}px`,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
          Browse Cards
        </h1>
        {/* Toolbar */}
        <BrowseToolbar {...toolbarProps} isMobile={false} />
        <ErrorBoundary>
          <BrowseCardGrid cards={sortedCards} isLoading={isLoading} onCardSelect={selectCard} />
        </ErrorBoundary>
      </div>
      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={replaceFilters}
        inkFilters={inkFilters}
        typeFilters={typeFilters}
        costFilters={costFilters}
        filters={filters}
        uniqueKeywords={uniqueKeywords}
        uniqueClassifications={uniqueClassifications}
        sets={sets}
      />
    </main>
  );
}
