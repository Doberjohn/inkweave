import {useCallback, useMemo, useState} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {SynergyResults, CardDetailPanel, MobileCardDetail} from '../features/synergies';
import {sharedEngine} from '../features/synergies/engine';
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

export function CardPage() {
  const {cardId} = useParams<{cardId: string}>();
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {cards, isLoading, getCardById} = useCardDataContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

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
  }, []);

  const handleBackToAll = useCallback(() => {
    setExpandedGroup(null);
    setActiveGroupFilter(null);
  }, []);

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
          />
        </ErrorBoundary>
      </div>
    </main>
  );
}
