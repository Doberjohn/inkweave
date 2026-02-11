import {useState} from 'react';
import {Analytics} from '@vercel/analytics/react';
import {SpeedInsights} from '@vercel/speed-insights/react';
import {CardList, FeaturedCards, CardPreviewProvider, CardPreviewPopover} from './features/cards';
import {
  useSynergyFinder,
  SynergyResults,
  SynergyBreakdown,
  CardDetailPanel,
} from './features/synergies';
import {
  CompactHeader,
  HeroSection,
  EtherealBackground,
  FilterModal,
  ErrorBoundary,
} from './shared/components';
import {COLORS, FONTS, FONT_SIZES, LAYOUT} from './shared/constants';
import {useResponsive} from './shared/hooks';

function SynergyFinderApp() {
  const {
    cards,
    filteredCards,
    totalCards,
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
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [browsing, setBrowsing] = useState(false);

  // Mobile linear flow: 'home' → 'cards' (browsing) → 'synergies' (card selected)
  const [mobileView, setMobileView] = useState<'home' | 'cards' | 'synergies'>('home');

  const clearAllFilters = () => {
    setInkFilter('all');
    setFilters({});
    setSearchQuery('');
  };

  const filterProps = {
    inkFilter,
    filters,
    uniqueKeywords,
    uniqueClassifications,
    sets,
    onInkFilterChange: setInkFilter,
    onFiltersChange: setFilters,
    onClearAll: clearAllFilters,
  };

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

  // Mobile layout — linear flow (no bottom nav)
  if (isMobile) {
    return (
      <div
        style={{
          minHeight: '100vh',
          fontFamily: FONTS.body,
          position: 'relative',
          ...(mobileView === 'home' && !selectedCard
            ? {display: 'flex', flexDirection: 'column' as const, alignItems: 'center'}
            : {}),
        }}>
        {/* Mobile Home — Hero + Featured Cards */}
        {mobileView === 'home' && !selectedCard && (
          <>
            <EtherealBackground isMobile />
            <HeroSection
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSearchSubmit={() => {
                if (searchQuery.trim().length > 0) {
                  setMobileView('cards');
                }
              }}
              isMobile
            />
            <FeaturedCards
              cards={cards}
              onCardSelect={(card) => {
                selectCard(card);
                setMobileView('synergies');
              }}
              isMobile
            />

            {/* See all cards link */}
            <button
              onClick={() => setMobileView('cards')}
              style={{
                background: 'none',
                border: 'none',
                color: COLORS.primary,
                fontSize: `${FONT_SIZES.md}px`,
                cursor: 'pointer',
                padding: '0 0 48px',
                position: 'relative',
                zIndex: 1,
                letterSpacing: '1px',
              }}>
              See all cards →
            </button>
          </>
        )}

        {/* Mobile Cards — browsing/filtering */}
        {mobileView === 'cards' && !selectedCard && (
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
                setMobileView('synergies');
              }}
              isMobile
              onBack={() => {
                setMobileView('home');
                setSearchQuery('');
              }}
            />
          </ErrorBoundary>
        )}

        {/* Mobile Synergies — card selected */}
        {(mobileView === 'synergies' || selectedCard) && (
          <ErrorBoundary>
            <SynergyResults
              selectedCard={selectedCard}
              synergies={synergies}
              totalSynergyCount={totalSynergyCount}
              onClearSelection={() => {
                clearSelection();
                setMobileView('home');
              }}
              isMobile
            />
          </ErrorBoundary>
        )}

      </div>
    );
  }

  // Desktop — Home state (no card selected, not browsing)
  if (!selectedCard && !browsing) {
    return (
      <div
        style={{
          minHeight: '100vh',
          fontFamily: FONTS.body,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <EtherealBackground />

        <HeroSection
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={() => {
            if (searchQuery.trim().length > 0) {
              setBrowsing(true);
            }
          }}
        />

        <FeaturedCards cards={cards} onCardSelect={selectCard} />

        {/* See all cards link */}
        <button
          onClick={() => setBrowsing(true)}
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.primary,
            fontSize: `${FONT_SIZES.lg}px`,
            cursor: 'pointer',
            padding: '24px 0 48px',
            position: 'relative',
            zIndex: 1,
            letterSpacing: '1px',
          }}>
          See all cards →
        </button>

      </div>
    );
  }

  // Desktop — Browsing state (searching/filtering, no card selected)
  if (!selectedCard && browsing) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: COLORS.background,
          fontFamily: FONTS.body,
          display: 'flex',
          flexDirection: 'column',
        }}>
        <CompactHeader
          totalCards={totalCards}
          onLogoClick={() => {
            setBrowsing(false);
            setSearchQuery('');
            clearAllFilters();
          }}
        />

        <div
          style={{
            display: 'flex',
            flex: 1,
            minHeight: `calc(100vh - ${LAYOUT.compactHeaderHeight}px)`,
          }}>
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
              onCardSelect={selectCard}
              onFiltersClick={() => setShowFilterModal(true)}
            />
          </ErrorBoundary>
        </div>

        <FilterModal
          isOpen={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          {...filterProps}
        />
      </div>
    );
  }

  // Desktop — Card-selected state (CompactHeader + 3-column layout)
  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        display: 'flex',
        flexDirection: 'column',
      }}>
      <CompactHeader totalCards={totalCards} onLogoClick={() => { clearSelection(); setBrowsing(false); }} />

      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: `calc(100vh - ${LAYOUT.compactHeaderHeight}px)`,
        }}>
        {/* Left: Card detail panel */}
        <CardDetailPanel card={selectedCard} onClear={() => { clearSelection(); setBrowsing(false); }} />

        {/* Center: Synergy grid */}
        <SynergyResults
          selectedCard={selectedCard}
          synergies={synergies}
          totalSynergyCount={totalSynergyCount}
          onClearSelection={clearSelection}
        />

        {/* Right: Synergy breakdown sidebar */}
        <SynergyBreakdown synergies={synergies} totalCount={totalSynergyCount} />
      </div>

      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        {...filterProps}
      />
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
