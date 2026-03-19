import {useEffect, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {BrowseCardGrid, BrowseToolbar} from '../features/cards';
import {
  searchCardsByName,
  filterCards,
  applySortOrder,
  type CardFilterOptions,
} from '../features/cards/loader';
import {CompactHeader, ErrorBoundary, EtherealBackground, FilterDialog} from '../shared/components';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../shared/constants';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useResponsive, useFilterParams} from '../shared/hooks';

export function BrowsePage() {
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {cards, isLoading, error, retryLoad, uniqueKeywords, uniqueClassifications, sets} =
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
  const [showFilters, setShowFilters] = useState(false);
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

  const combinedFilters: CardFilterOptions = (() => {
    const combined = {...filters};
    if (inkFilters.length > 0) combined.ink = inkFilters;
    if (typeFilters.length > 0) combined.type = typeFilters;
    if (costFilters.length > 0) combined.costs = costFilters;
    return combined;
  })();

  const sortedCards = (() => {
    let result = cards;
    if (searchQuery.trim()) result = searchCardsByName(result, searchQuery);
    if (Object.keys(combinedFilters).length > 0) result = filterCards(result, combinedFilters);
    return applySortOrder(result, sortOrder);
  })();

  const goHome = () => {
    clearAllFilters();
    navigate('/');
  };

  const selectCard = (card: {id: string}) => navigate(`/card/${card.id}`);

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
    onFiltersClick: () => setShowFilters(true),
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
          {/* Card grid */}
          <ErrorBoundary>
            <BrowseCardGrid
              cards={sortedCards}
              isLoading={isLoading}
              onCardSelect={selectCard}
              usePageScroll
              columns={3}
              gap={10}
              borderRadius={10}
              padding={`${SPACING.md}px ${SPACING.lg}px 48px`}
            />
          </ErrorBoundary>
        </div>
        <FilterDialog
          isOpen={showFilters}
          onClose={() => setShowFilters(false)}
          onApply={replaceFilters}
          variant="drawer"
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
      <FilterDialog
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={replaceFilters}
        variant="modal"
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
