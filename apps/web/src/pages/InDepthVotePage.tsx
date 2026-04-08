import {useNavigate, useParams} from 'react-router-dom';
import {CompactHeader, CtaButton, BackLink, LoadingSpinner, EtherealBackground} from '../shared/components';
import {useResponsive} from '../shared/hooks';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {PairDisplay, VoteStatusBanner, InDepthVoteForm} from '../features/voting';
import {useSpecificPair} from '../features/voting/hooks/useSpecificPair';
import {useInDepthVoteSession} from '../features/voting/hooks/useInDepthVoteSession';
import {COLORS, FONTS, FONT_SIZES, LAYOUT, RADIUS, SPACING} from '../shared/constants';

/** Inject keyframes once at module load */
(function injectKeyframes() {
  const STYLE_ID = 'indepth-page-keyframes';
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes idv-fade-up {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes idv-submit-glow {
      0%   { box-shadow: 0 0 0 0 rgba(212,175,55,0.4); }
      50%  { box-shadow: 0 0 20px 6px rgba(212,175,55,0.15); }
      100% { box-shadow: 0 0 0 0 rgba(212,175,55,0); }
    }
    @keyframes idv-check-draw {
      from { stroke-dashoffset: 24; }
      to   { stroke-dashoffset: 0; }
    }
  `;
  document.head.appendChild(style);
})();

const MAX_WIDTH = 560;
const TOTAL_DIMENSIONS = 6;

function ProgressBar({answeredCount, animate}: {answeredCount: number; animate?: boolean}) {
  const pct = (answeredCount / TOTAL_DIMENSIONS) * 100;
  const isComplete = answeredCount === TOTAL_DIMENSIONS;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.sm,
        width: '100%',
        maxWidth: MAX_WIDTH,
        animation: animate ? 'idv-fade-up 0.35s ease-out 100ms both' : 'none',
      }}>
      <div
        style={{
          flex: 1,
          height: 3,
          background: COLORS.surfaceBorder,
          borderRadius: 2,
          overflow: 'hidden',
        }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: isComplete
              ? 'linear-gradient(90deg, #6ee7a0, #4ade80)'
              : 'linear-gradient(90deg, #d4af37, #ffb900)',
            borderRadius: 2,
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
      <span
        style={{
          fontSize: FONT_SIZES.xs,
          fontWeight: isComplete ? 700 : 500,
          color: isComplete ? '#6ee7a0' : COLORS.textMuted,
          fontFamily: FONTS.body,
          whiteSpace: 'nowrap',
          transition: 'color 0.3s ease',
        }}>
        {isComplete ? '✓ Complete' : `${answeredCount} / ${TOTAL_DIMENSIONS}`}
      </span>
    </div>
  );
}

function SuccessCard({answeredCount, onBack, onVoteMore}: {answeredCount: number; onBack: () => void; onVoteMore: () => void}) {
  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: RADIUS.card,
        boxShadow: '0 8px 32px rgba(212, 175, 55, 0.15)',
        padding: '32px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        width: '100%',
        maxWidth: MAX_WIDTH,
        animation: 'idv-fade-up 0.4s ease-out',
      }}>
      {/* Animated checkmark circle */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#1a3d1a',
          border: '2px solid #6ee7a0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 13l4 4L19 7"
            stroke="#6ee7a0"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="24"
            style={{animation: 'idv-check-draw 0.5s ease-out 0.2s both'}}
          />
        </svg>
      </div>

      <span style={{fontSize: FONT_SIZES.xxl, fontWeight: 700, color: COLORS.primary, fontFamily: FONTS.body}}>
        Thanks for your feedback!
      </span>
      <span style={{fontSize: FONT_SIZES.base, color: COLORS.textMuted, fontFamily: FONTS.body}}>
        You rated {answeredCount} of {TOTAL_DIMENSIONS} dimensions — every answer helps calibrate synergy scores.
      </span>
      <div style={{display: 'flex', gap: 12, marginTop: SPACING.sm}}>
        <CtaButton onClick={onBack}>
          Back to synergy
        </CtaButton>
        <CtaButton variant="ghost" onClick={onVoteMore}>
          Vote on more pairs
        </CtaButton>
      </div>
    </div>
  );
}

export function InDepthVotePage() {
  const navigate = useNavigate();
  const {cardAId, cardBId} = useParams<{cardAId: string; cardBId: string}>();
  const {isMobile, windowWidth} = useResponsive();
  const {cards} = useCardDataContext();

  const {pair, isLoading, error} = useSpecificPair(cardAId, cardBId);
  const session = useInDepthVoteSession(pair);

  const stickyPair = !isMobile && windowWidth >= 1024;

  const answeredCount = [
    session.formState.isReal,
    session.formState.accuracy,
    session.formState.score,
    session.formState.wouldPlay,
    session.formState.whoCarries,
    session.formState.difficulty,
  ].filter(v => v !== null).length;

  const allAnswered = answeredCount === TOTAL_DIMENSIONS;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(`/card/${cardAId}`);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (error || !pair) {
    return (
      <div style={{minHeight: '100vh', display: 'flex', flexDirection: 'column'}}>
        <CompactHeader
          onLogoClick={() => navigate('/')}
          isMobile={isMobile}
          cards={cards}
          onCardSelect={(card) => navigate(`/card/${card.id}`)}
        />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            gap: 16,
          }}>
          <span style={{fontSize: FONT_SIZES.xl, fontWeight: 700, color: COLORS.text, fontFamily: FONTS.body}}>
            {error ?? 'Pair not found'}
          </span>
          <CtaButton variant="ghost" onClick={() => navigate('/')}>
            Back to Home
          </CtaButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', overflowY: 'auto'}}>
      <EtherealBackground isMobile={isMobile} vivid />
      <CompactHeader
        onLogoClick={() => navigate('/')}
        isMobile={isMobile}
        cards={cards}
        onCardSelect={(card) => navigate(`/card/${card.id}`)}
      />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: isMobile ? '16px 16px 120px' : '16px 16px 60px',
          gap: 16,
          position: 'relative',
          zIndex: 1,
        }}>
        {/* Back navigation */}
        <div style={{width: '100%', maxWidth: MAX_WIDTH}}>
          <BackLink onClick={handleBack} label="Back to synergy" />
        </div>

        {/* Pair display — optionally sticky on desktop */}
        <div
          style={stickyPair ? {
            position: 'sticky',
            top: LAYOUT.compactHeaderHeight,
            zIndex: 10,
            background: 'linear-gradient(180deg, #0d0d14 0%, rgba(13,13,20,0.95) 80%, transparent 100%)',
            padding: '0 0 24px',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
          } : undefined}>
          <PairDisplay
            pair={pair}
            selectedScore={session.formState.score}
            isMobile={isMobile}
          />
        </div>

        {/* Progress bar */}
        <ProgressBar answeredCount={answeredCount} animate />

        {/* Page subtitle */}
        <span
          style={{
            fontSize: FONT_SIZES.base,
            color: COLORS.textMuted,
            fontFamily: FONTS.body,
            textAlign: 'center',
            animation: 'idv-fade-up 0.35s ease-out 150ms both',
          }}>
          Answer any or all — every response helps calibrate synergy scores.
        </span>

        {/* Status banners */}
        {session.isRateLimited && (
          <div style={{width: '100%', maxWidth: MAX_WIDTH}}>
            <VoteStatusBanner type="rate_limited" />
          </div>
        )}
        {session.lastResult === 'error' && (
          <div style={{width: '100%', maxWidth: MAX_WIDTH}}>
            <VoteStatusBanner type="error" />
          </div>
        )}

        {/* Success state — animated card */}
        {session.lastResult === 'success' ? (
          <SuccessCard
            answeredCount={answeredCount}
            onBack={handleBack}
            onVoteMore={() => navigate('/vote')}
          />
        ) : (
          /* Vote form + submit button */
          <div style={{width: '100%', maxWidth: MAX_WIDTH, display: 'flex', flexDirection: 'column', gap: SPACING.xl, alignItems: 'center'}}>
            <InDepthVoteForm
              formState={session.formState}
              cardA={pair.cardA}
              cardB={pair.cardB}
              onSetIsReal={session.setIsReal}
              onSetAccuracy={session.setAccuracy}
              onSetScore={session.setScore}
              onSetWouldPlay={session.setWouldPlay}
              onSetWhoCarries={session.setWhoCarries}
              onSetDifficulty={session.setDifficulty}
              isMobile={isMobile}
              animate
            />

            <CtaButton
              onClick={session.submit}
              disabled={!session.hasAnyAnswer || session.isSubmitting || session.isRateLimited}
              style={{
                width: '100%',
                maxWidth: MAX_WIDTH,
                opacity: session.hasAnyAnswer ? 1 : 0.5,
                boxShadow: session.hasAnyAnswer ? '0 0 12px rgba(255,185,0,0.15)' : 'none',
                animation: session.isSubmitting
                  ? 'idv-submit-glow 1.5s ease-in-out infinite'
                  : 'idv-fade-up 0.35s ease-out 600ms both',
                transition: 'opacity 0.3s ease, box-shadow 0.3s ease',
              }}>
              {session.isSubmitting
                ? 'Submitting...'
                : allAnswered
                  ? 'Submit All 6 Votes'
                  : 'Submit Votes'}
            </CtaButton>
          </div>
        )}
      </main>
    </div>
  );
}
