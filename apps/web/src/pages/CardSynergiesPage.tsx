import {useCallback, useMemo} from 'react';
import {useParams, useNavigate, useSearchParams, Navigate} from 'react-router-dom';
import {SynergyResults} from '../features/synergies';
import {usePrecomputedSynergies} from '../features/synergies/hooks';
import {ErrorBoundary, LoadingSpinner} from '../shared/components';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../shared/constants';
import {useResponsive} from '../shared/hooks';
import {useCardDataContext} from '../shared/contexts/CardDataContext';

const centeredPage = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: FONTS.body,
} as const;

/**
 * Mobile-only synergies view, accessed via /card/:cardId/synergies.
 * Shows the full synergy grid with a back header pointing to the card detail.
 * On desktop, redirects to the main card page (which shows synergies inline).
 */
export function CardSynergiesPage() {
  const {cardId} = useParams<{cardId: string}>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {isMobile} = useResponsive();
  const {isLoading, getCardById} = useCardDataContext();

  const expandedGroup = searchParams.get('group');

  const selectedCard = cardId ? (getCardById(cardId) ?? null) : null;

  const {synergies, error: synergiesError} = usePrecomputedSynergies(selectedCard);

  const totalSynergyCount = useMemo(
    () => synergies.reduce((sum, group) => sum + group.synergies.length, 0),
    [synergies],
  );

  const goBack = useCallback(() => {
    if (cardId) navigate(`/card/${cardId}`);
    else navigate('/');
  }, [cardId, navigate]);

  const handleShowAll = useCallback(
    (groupKey: string) => {
      setSearchParams({group: groupKey}, {replace: true});
    },
    [setSearchParams],
  );

  const handleBackToAll = useCallback(() => {
    setSearchParams({}, {replace: true});
  }, [setSearchParams]);

  // On desktop, this route isn't needed — redirect to card page
  if (!isMobile && !isLoading && selectedCard) {
    return <Navigate to={`/card/${cardId}`} replace />;
  }

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
        <button
          onClick={() => navigate('/')}
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

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        display: 'flex',
        flexDirection: 'column',
      }}>
      {/* Header: ← Card Name */}
      <div
        style={{
          height: 48,
          background: 'rgba(26, 26, 46, 0.9)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: SPACING.lg,
          borderBottom: '1px solid rgba(51, 51, 85, 0.5)',
          flexShrink: 0,
        }}>
        <h1 style={{margin: 0, fontSize: 'inherit', fontWeight: 'inherit'}}>
          <button
            onClick={goBack}
            aria-label={`Back to ${selectedCard.fullName}`}
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.primary500,
              fontSize: FONT_SIZES.md,
              fontWeight: 700,
              letterSpacing: '0.96px',
              cursor: 'pointer',
              padding: `${SPACING.sm}px 0`,
              fontFamily: FONTS.body,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
            &larr; {selectedCard.fullName}
          </button>
        </h1>
      </div>

      {/* Synergy results */}
      {synergiesError && (
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
          Failed to load synergies: {synergiesError.message}
        </div>
      )}
      <ErrorBoundary>
        <SynergyResults
          selectedCard={selectedCard}
          synergies={synergies}
          totalSynergyCount={totalSynergyCount}
          onClearSelection={goBack}
          isMobile
          showCardDetail={false}
          expandedGroup={expandedGroup}
          onShowAll={handleShowAll}
          onBackToAll={handleBackToAll}
        />
      </ErrorBoundary>
    </main>
  );
}
