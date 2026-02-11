import {useCallback, useMemo} from 'react';
import {useNavigate} from 'react-router-dom';
import {CardList} from '../features/cards';
import {searchCardsByName, filterCards, sortBySetThenNumber, type CardFilterOptions} from '../features/cards/loader';
import {CompactHeader, ErrorBoundary} from '../shared/components';
import {COLORS, FONTS, LAYOUT} from '../shared/constants';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useResponsive} from '../shared/hooks';
import {useFilterParams} from '../shared/hooks/useFilterParams';

export function BrowsePage() {
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {cards, isLoading, totalCards, uniqueKeywords, uniqueClassifications, sets} =
    useCardDataContext();
  const {searchQuery, setSearchQuery, inkFilter, setInkFilter, filters, setFilters, clearAllFilters} =
    useFilterParams();

  const combinedFilters = useMemo<CardFilterOptions>(
    () => (inkFilter !== 'all' ? {...filters, ink: inkFilter} : filters),
    [filters, inkFilter],
  );

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
        inkFilter={inkFilter}
        filters={filters}
        uniqueKeywords={uniqueKeywords}
        uniqueClassifications={uniqueClassifications}
        sets={sets}
        onSearchChange={setSearchQuery}
        onInkFilterChange={setInkFilter}
        onFiltersChange={setFilters}
        onCardSelect={selectCard}
        isMobile={isMobile}
        onBack={isMobile ? goHome : undefined}
      />
    </ErrorBoundary>
  );

  if (isMobile) {
    return <div style={{minHeight: '100vh', fontFamily: FONTS.body}}>{cardList}</div>;
  }

  return (
    <div
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
    </div>
  );
}
