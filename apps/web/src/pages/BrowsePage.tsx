import {useCallback, useEffect, useMemo, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {BrowseCardGrid, BrowseToolbar, CardTile} from '../features/cards';
import {
  searchCardsByName,
  filterCards,
  applySortOrder,
  type CardFilterOptions,
} from '../features/cards/loader';
import {
  CompactHeader,
  ErrorBoundary,
  EtherealBackground,
  FilterDrawer,
  FilterModal,
} from '../shared/components';
import {BROWSE_SORT_OPTIONS, COLORS, FONTS, FONT_SIZES, SPACING} from '../shared/constants';
import {SortSelect} from '../shared/components/SortSelect';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useResponsive, useFilterParams} from '../shared/hooks';

export function BrowsePage() {
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {
    cards,
    isLoading,
    error,
    retryLoad,
    totalCards,
    uniqueKeywords,
    uniqueClassifications,
    sets,
  } = useCardDataContext();
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
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-focus search when navigating with ?focus=search (desktop only; mobile uses bottom sheet)
  useEffect(() => {
    if (!isMobile && searchParams.get('focus') === 'search') {
      requestAnimationFrame(() => {
        const input = document.querySelector<HTMLInputElement>('[data-testid="browse-search"]');
        input?.focus();
      });
      searchParams.delete('focus');
      setSearchParams(searchParams, {replace: true});
    }
  }, [isMobile, searchParams, setSearchParams]);

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

  if (error) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
          fontFamily: FONTS.body,
          background: COLORS.background,
        }}>
        <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.xl}px`}}>
          Failed to load card data.
        </p>
        <button
          onClick={retryLoad}
          style={{
            padding: '8px 20px',
            background: COLORS.primary,
            color: COLORS.background,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: FONTS.body,
            fontWeight: 600,
          }}>
          Retry
        </button>
      </main>
    );
  }

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
    return (
      <main
        style={{
          minHeight: '100vh',
          background: COLORS.background,
          fontFamily: FONTS.body,
          position: 'relative',
        }}>
        <EtherealBackground />
        <CompactHeader onLogoClick={goHome} isMobile />
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
            <SortSelect
              options={BROWSE_SORT_OPTIONS}
              value={sortOrder}
              onChange={setSortOrder}
              ariaLabel="Sort cards"
              style={{width: '100%', padding: '8px 10px'}}
            />
          </div>
          {/* Card grid */}
          <ErrorBoundary>
            {isLoading ? (
              <div style={{display: 'flex', justifyContent: 'center', padding: 64}}>
                <div style={{color: COLORS.textMuted}}>Loading...</div>
              </div>
            ) : sortedCards.length === 0 ? (
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
                  {sortedCards.map((card) => (
                    <CardTile
                      key={card.id}
                      card={card}
                      isSelected={false}
                      onSelect={selectCard}
                      variant="minimal"
                      borderRadius={10}
                      useSmallImage
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
        height: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
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
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
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
            flexShrink: 0,
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
