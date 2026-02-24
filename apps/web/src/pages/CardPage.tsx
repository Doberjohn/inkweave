import {useCallback, useMemo, useState} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {SynergyResults, CardDetailPanel, MobileCardDetail} from '../features/synergies';
import {sharedEngine} from '../features/synergies/engine';
import {
  CompactHeader,
  ErrorBoundary,
  EtherealBackground,
  FilterModal,
  LoadingSpinner,
} from '../shared/components';
import {COLORS, FONTS, LAYOUT} from '../shared/constants';
import {useResponsive} from '../shared/hooks';
import {useFilterParams} from '../shared/hooks/useFilterParams';
import {useCardDataContext} from '../shared/contexts/CardDataContext';

const centeredPage = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: FONTS.body,
} as const;

export function CardPage() {
  const {cardId} = useParams<{cardId: string}>();
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {cards, isLoading, getCardById, uniqueKeywords, uniqueClassifications, sets} =
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
    clearAllFilters,
    activeFilterCount,
  } = useFilterParams();
  const [showFilterModal, setShowFilterModal] = useState(false);

  const selectedCard = cardId ? (getCardById(cardId) ?? null) : null;

  const synergies = useMemo(() => {
    if (!selectedCard || cards.length === 0) return [];
    try {
      return sharedEngine.findSynergies(selectedCard, cards);
    } catch (err) {
      console.error(`Synergy computation failed for card ${selectedCard.id}:`, err);
      return [];
    }
  }, [selectedCard, cards]);

  const totalSynergyCount = useMemo(
    () => synergies.reduce((sum, group) => sum + group.synergies.length, 0),
    [synergies],
  );

  const goHome = useCallback(() => navigate('/'), [navigate]);
  const selectCard = useCallback((card: {id: string}) => navigate(`/card/${card.id}`), [navigate]);

  if (isLoading) {
    return (
      <div style={centeredPage}>
        <LoadingSpinner />
      </div>
    );
  }

  if (!selectedCard) {
    return (
      <div style={{...centeredPage, flexDirection: 'column', gap: '16px'}}>
        <h2 style={{color: COLORS.text, margin: 0}}>Card not found</h2>
        <p style={{color: COLORS.textMuted, margin: 0}}>
          The card you&apos;re looking for doesn&apos;t exist.
        </p>
        <button
          onClick={goHome}
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
          Go Home
        </button>
      </div>
    );
  }

  if (isMobile) {
    return (
      <ErrorBoundary>
        <MobileCardDetail
          card={selectedCard}
          synergies={synergies}
          totalSynergyCount={totalSynergyCount}
          onBack={goHome}
        />
      </ErrorBoundary>
    );
  }

  // Desktop: 2-column layout (CardDetail+Breakdown | SynergyResults)
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
        showBackArrow
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        cards={cards}
        onCardSelect={selectCard}
        onFiltersClick={() => setShowFilterModal(true)}
        activeFilterCount={activeFilterCount}
      />
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: `calc(100vh - ${LAYOUT.compactHeaderHeight}px)`,
          position: 'relative',
          zIndex: 1,
        }}>
        <CardDetailPanel
          card={selectedCard}
          synergies={synergies}
          totalSynergyCount={totalSynergyCount}
        />
        <ErrorBoundary>
          <SynergyResults
            selectedCard={selectedCard}
            synergies={synergies}
            totalSynergyCount={totalSynergyCount}
            onClearSelection={goHome}
          />
        </ErrorBoundary>
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
