import {useCallback, useState, useMemo} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {
  SynergyResults,
  CardDetailPanel,
  MobileCardDetail,
  SynergyDetailModal,
} from '../features/synergies';
import {usePrecomputedSynergies} from '../features/synergies/hooks';
import type {DetailedPairSynergy, LorcanaCard} from 'inkweave-synergy-engine';
import {
  CompactHeader,
  ErrorBoundary,
  EtherealBackground,
  LoadingSpinner,
} from '../shared/components';
import {COLORS, FONTS, LAYOUT} from '../shared/constants';
import {useResponsive} from '../shared/hooks';
import {useCardDataContext} from '../shared/contexts/CardDataContext';

const centeredPage = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: FONTS.body,
} as const;

function SynergyErrorBanner({error}: {error: Error}) {
  return (
    <div
      role="alert"
      style={{
        padding: '12px 16px',
        margin: '16px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '8px',
        color: '#f59090',
        fontSize: '13px',
      }}>
      Failed to load synergies: {error.message}
    </div>
  );
}

export function CardPage() {
  const {cardId} = useParams<{cardId: string}>();
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {cards, isLoading, getCardById} = useCardDataContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [detailPair, setDetailPair] = useState<DetailedPairSynergy | null>(null);
  // Keeps last non-null pair so exit animation can render stale data while fading out
  const [lastPair, setLastPair] = useState<DetailedPairSynergy | null>(null);
  const [prevCardId, setPrevCardId] = useState(cardId);

  const selectedCard = cardId ? (getCardById(cardId) ?? null) : null;

  // Reset synergy view state when navigating between cards
  if (cardId !== prevCardId) {
    setPrevCardId(cardId);
    setActiveGroupFilter(null);
    setExpandedGroup(null);
    setDetailPair(null);
  }

  const {
    synergies,
    error: synergiesError,
    getPairSynergies: getPrecomputedPair,
  } = usePrecomputedSynergies(selectedCard);

  const totalSynergyCount = useMemo(
    () => synergies.reduce((sum, group) => sum + group.synergies.length, 0),
    [synergies],
  );

  const goHome = useCallback(() => navigate('/'), [navigate]);
  const handleSearchSubmit = useCallback(() => {
    const q = searchQuery.trim();
    navigate(q ? `/browse?q=${encodeURIComponent(q)}` : '/browse');
  }, [navigate, searchQuery]);
  const selectCard = useCallback((card: {id: string}) => navigate(`/card/${card.id}`), [navigate]);
  const handleGroupClick = useCallback(
    (groupKey: string) => {
      if (expandedGroup) {
        // In show-all mode: clicking a breakdown row switches to that group
        setExpandedGroup(groupKey);
        setActiveGroupFilter(groupKey);
      } else {
        // Normal mode: toggle filter (same as chips)
        const newFilter = activeGroupFilter === groupKey ? null : groupKey;
        setActiveGroupFilter(newFilter);

        // Scroll to the group after filter applies
        if (newFilter) {
          requestAnimationFrame(() => {
            document
              .querySelector(`[data-group-key="${newFilter}"]`)
              ?.scrollIntoView({behavior: 'smooth', block: 'start'});
          });
        }
      }
    },
    [activeGroupFilter, expandedGroup],
  );

  const handleShowAll = useCallback((groupKey: string) => {
    setExpandedGroup(groupKey);
    setActiveGroupFilter(groupKey);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-expanded-group="${groupKey}"]`)
        ?.scrollIntoView({behavior: 'smooth', block: 'start'});
    });
  }, []);

  const handleBackToAll = useCallback(() => {
    setExpandedGroup(null);
    setActiveGroupFilter(null);
  }, []);

  const handleSynergyCardClick = useCallback(
    (clickedCard: LorcanaCard) => {
      const pair = getPrecomputedPair(clickedCard);
      if (!pair || pair.connections.length === 0) return;
      setDetailPair(pair);
      setLastPair(pair);
    },
    [getPrecomputedPair],
  );

  const handleCloseDetail = useCallback(() => setDetailPair(null), []);
  const handleViewSynergies = useCallback(
    (id: string) => {
      setDetailPair(null);
      navigate(`/card/${id}`);
    },
    [navigate],
  );

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
        <h1 style={{color: COLORS.text, margin: 0}}>Card not found</h1>
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
        {synergiesError && <SynergyErrorBanner error={synergiesError} />}
        <MobileCardDetail
          card={selectedCard}
          synergies={synergies}
          onBack={goHome}
          onSynergyCardClick={handleSynergyCardClick}
        />
        {lastPair && (
          <SynergyDetailModal
            isOpen={!!detailPair}
            onClose={handleCloseDetail}
            pair={lastPair}
            onViewSynergies={handleViewSynergies}
          />
        )}
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
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        cards={cards}
        onCardSelect={selectCard}
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
          onGroupClick={handleGroupClick}
          activeGroupKey={activeGroupFilter}
        />
        <ErrorBoundary>
          {synergiesError ? (
            <SynergyErrorBanner error={synergiesError} />
          ) : (
            <SynergyResults
              selectedCard={selectedCard}
              synergies={synergies}
              totalSynergyCount={totalSynergyCount}
              onClearSelection={goHome}
              activeGroupFilter={activeGroupFilter}
              onGroupFilterChange={setActiveGroupFilter}
              expandedGroup={expandedGroup}
              onShowAll={handleShowAll}
              onBackToAll={handleBackToAll}
              onSynergyCardClick={handleSynergyCardClick}
            />
          )}
        </ErrorBoundary>
      </div>
      {lastPair && (
        <ErrorBoundary>
          <SynergyDetailModal
            isOpen={!!detailPair}
            onClose={handleCloseDetail}
            pair={lastPair}
            onViewSynergies={handleViewSynergies}
          />
        </ErrorBoundary>
      )}
    </main>
  );
}
