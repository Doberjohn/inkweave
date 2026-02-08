import {Analytics} from '@vercel/analytics/react';
import {SpeedInsights} from '@vercel/speed-insights/react';
import {CardList, CardPreviewProvider, CardPreviewPopover} from './features/cards';
import {useSynergyFinder, SynergyResults} from './features/synergies';
import {Header, MobileHeader, MobileNav, ErrorBoundary} from './shared/components';
import {COLORS, LAYOUT, LAYOUT_MOBILE} from './shared/constants';
import {useResponsive, useMobileView} from './shared/hooks';

function SynergyFinderApp() {
  const {
    filteredCards,
    isLoading,
    error,
    selectedCard,
    selectCard,
    clearSelection,
    synergies,
    totalSynergyCount,
    searchQuery,
    setSearchQuery,
    inkFilter,
    setInkFilter,
    filters,
    setFilters,
    uniqueKeywords,
    uniqueClassifications,
    sets,
    retryLoad,
  } = useSynergyFinder();

  const {isMobile} = useResponsive();
  const {activeView, setActiveView} = useMobileView();

  if (error) {
    return (
      <div style={{padding: '40px', textAlign: 'center'}}>
        <h2 style={{color: COLORS.error}}>Error loading cards</h2>
        <p style={{color: COLORS.gray600, marginBottom: '20px'}}>{error.message}</p>
        <button
          onClick={retryLoad}
          style={{
            padding: '10px 20px',
            background: COLORS.primary500,
            color: COLORS.white,
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 500,
          }}>
          Try Again
        </button>
      </div>
    );
  }

  // Mobile layout
  if (isMobile) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: `linear-gradient(135deg, ${COLORS.bgGradientStart} 0%, ${COLORS.bgGradientEnd} 100%)`,
          fontFamily: "'Avenir Next', 'Avenir', -apple-system, sans-serif",
          display: 'flex',
          flexDirection: 'column',
        }}>
        <MobileHeader />

        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingBottom: `${LAYOUT_MOBILE.bottomNavHeight}px`,
          }}>
          {activeView === 'cards' && (
            <ErrorBoundary>
              <CardList
                cards={filteredCards}
                isLoading={isLoading}
                selectedCard={selectedCard}
                searchQuery={searchQuery}
                inkFilter={inkFilter}
                filters={filters}
                uniqueKeywords={uniqueKeywords}
                uniqueClassifications={uniqueClassifications}
                sets={sets}
                onSearchChange={setSearchQuery}
                onInkFilterChange={setInkFilter}
                onFiltersChange={setFilters}
                onCardSelect={(card) => {
                  selectCard(card);
                  setActiveView('synergies');
                }}
                isMobile
              />
            </ErrorBoundary>
          )}

          {activeView === 'synergies' && (
            <ErrorBoundary>
              <SynergyResults
                selectedCard={selectedCard}
                synergies={synergies}
                totalSynergyCount={totalSynergyCount}
                onClearSelection={clearSelection}
                isMobile
              />
            </ErrorBoundary>
          )}

        </main>

        <MobileNav
          activeView={activeView}
          onViewChange={setActiveView}
        />
      </div>
    );
  }

  // Desktop layout
  return (
    <div
      style={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${COLORS.bgGradientStart} 0%, ${COLORS.bgGradientEnd} 100%)`,
        fontFamily: "'Avenir Next', 'Avenir', -apple-system, sans-serif",
      }}>
      <Header />

      <div style={{display: 'flex', minHeight: `calc(100vh - ${LAYOUT.headerHeight}px)`}}>
        <CardList
          cards={filteredCards}
          isLoading={isLoading}
          selectedCard={selectedCard}
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
        />

        <SynergyResults
          selectedCard={selectedCard}
          synergies={synergies}
          totalSynergyCount={totalSynergyCount}
          onClearSelection={clearSelection}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CardPreviewProvider>
        <SynergyFinderApp />
        <CardPreviewPopover />
      </CardPreviewProvider>
      <Analytics />
      <SpeedInsights />
    </ErrorBoundary>
  );
}
