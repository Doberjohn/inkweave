import {useCallback, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {CardList} from '../features/cards';
import {searchCardsByName, filterCards, sortBySetThenNumber, type CardFilterOptions} from '../features/cards/loader';
import {CompactHeader, ErrorBoundary, FilterModal} from '../shared/components';
import {COLORS, FONTS, LAYOUT} from '../shared/constants';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useResponsive} from '../shared/hooks';
import {useFilterParams} from '../shared/hooks/useFilterParams';

export function BrowsePage() {
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {cards, isLoading, totalCards, uniqueKeywords, uniqueClassifications, sets} =
    useCardDataContext();
  const {searchQuery, setSearchQuery, inkFilters, toggleInk, typeFilters, toggleType, costFilters, toggleCost, filters, setFilters, clearAllFilters, activeFilterCount} =
    useFilterParams();
  const [showFilterModal, setShowFilterModal] = useState(false);

  const combinedFilters = useMemo<CardFilterOptions>(() => {
    const combined = {...filters};
    if (inkFilters.length > 0) combined.ink = inkFilters;
    if (typeFilters.length > 0) combined.type = typeFilters;
    if (costFilters.length > 0) combined.costs = costFilters;
    return combined;
  }, [filters, inkFilters, typeFilters, costFilters]);

  const filteredCards = useMemo(() => {
    let result = cards;
    if (searchQuery.trim()) result = searchCardsByName(result, searchQuery);
    if (Object.keys(combinedFilters).length > 0) result = filterCards(result, combinedFilters);
    return sortBySetThenNumber(result);
  }, [cards, searchQuery, combinedFilters]);

  const goHome = useCallback(() => {
    clearAllFilters();
    navigate('/');
  }, [clearAllFilters, navigate]);

  const selectCard = useCallback(
    (card: {id: string}) => navigate(`/card/${card.id}`),
    [navigate],
  );

  const cardList = (
    <ErrorBoundary>
      <CardList
        cards={filteredCards}
        isLoading={isLoading}
        selectedCard={null}
        searchQuery={searchQuery}
        inkFilters={inkFilters}
        typeFilters={typeFilters}
        costFilters={costFilters}
        filters={filters}
        uniqueKeywords={uniqueKeywords}
        uniqueClassifications={uniqueClassifications}
        sets={sets}
        onSearchChange={setSearchQuery}
        onToggleInk={toggleInk}
        onToggleType={toggleType}
        onToggleCost={toggleCost}
        onFiltersChange={setFilters}
        onCardSelect={selectCard}
        onClearAll={clearAllFilters}
        activeFilterCount={activeFilterCount}
        isMobile={isMobile}
        onBack={isMobile ? goHome : undefined}
        onFiltersClick={!isMobile ? () => setShowFilterModal(true) : undefined}
      />
    </ErrorBoundary>
  );

  if (isMobile) {
    return <main style={{minHeight: '100vh', fontFamily: FONTS.body}}>{cardList}</main>;
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        display: 'flex',
        flexDirection: 'column',
      }}>
      <CompactHeader totalCards={totalCards} onLogoClick={goHome} />
      <div style={{display: 'flex', flex: 1, minHeight: `calc(100vh - ${LAYOUT.compactHeaderHeight}px)`}}>
        {cardList}
      </div>
      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        inkFilters={inkFilters}
        typeFilters={typeFilters}
        costFilters={costFilters}
        filters={filters}
        activeFilterCount={activeFilterCount}
        uniqueKeywords={uniqueKeywords}
        uniqueClassifications={uniqueClassifications}
        sets={sets}
        onToggleInk={toggleInk}
        onToggleType={toggleType}
        onToggleCost={toggleCost}
        onFiltersChange={setFilters}
        onClearAll={clearAllFilters}
      />
    </main>
  );
}
