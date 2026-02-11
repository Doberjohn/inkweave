import {useCallback, useMemo} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {SynergyResults, SynergyBreakdown, CardDetailPanel} from '../features/synergies';
import {sharedEngine} from '../features/synergies/engine';
import {CompactHeader, ErrorBoundary, LoadingSpinner} from '../shared/components';
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
  const {cards, isLoading, totalCards, getCardById} = useCardDataContext();

  const selectedCard = cardId ? getCardById(cardId) ?? null : null;

  const synergies = useMemo(() => {
    if (!selectedCard || cards.length === 0) return [];
    return sharedEngine.findSynergies(selectedCard, cards);
  }, [selectedCard, cards]);

  const totalSynergyCount = useMemo(
    () => synergies.reduce((sum, group) => sum + group.synergies.length, 0),
    [synergies],
  );

  const goHome = useCallback(() => navigate('/'), [navigate]);

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
      <div style={{minHeight: '100vh', fontFamily: FONTS.body}}>
        <ErrorBoundary>
          <SynergyResults
            selectedCard={selectedCard}
            synergies={synergies}
            totalSynergyCount={totalSynergyCount}
            onClearSelection={goHome}
            isMobile
          />
        </ErrorBoundary>
      </div>
    );
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
        <CardDetailPanel card={selectedCard} onClear={goHome} />
        <SynergyResults
          selectedCard={selectedCard}
          synergies={synergies}
          totalSynergyCount={totalSynergyCount}
          onClearSelection={goHome}
        />
        <SynergyBreakdown synergies={synergies} totalCount={totalSynergyCount} />
      </div>
    </div>
  );
}
