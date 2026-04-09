import {useNavigate, useParams} from 'react-router-dom';
import {CompactHeader, CtaButton, BackLink, LoadingSpinner, EtherealBackground} from '../shared/components';
import {useResponsive} from '../shared/hooks';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {PairDisplay, VoteStatusBanner, InDepthVoteForm} from '../features/voting';
import {useSpecificPair} from '../features/voting/hooks/useSpecificPair';
import {useInDepthVoteSession} from '../features/voting/hooks/useInDepthVoteSession';
import {COLORS, EASING, FONTS, FONT_SIZES, LAYOUT, RADIUS, SPACING} from '../shared/constants';

/** Inject keyframes once at module load */
(function injectKeyframes() {
  const STYLE_ID = 'indepth-page-keyframes';
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes idv-submit-glow {
      0%   { box-shadow: 0 0 0 0 rgba(212,175,55,0.4); }
      50%  { box-shadow: 0 0 20px 6px rgba(212,175,55,0.15); }
      100% { box-shadow: 0 0 0 0 rgba(212,175,55,0); }
    }
    @keyframes idv-check-draw {
      from { stroke-dashoffset: 24; }
      to   { stroke-dashoffset: 0; }
    }
    @keyframes idv-shimmer {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(200%); }
    }
    @keyframes idv-sparkle {
      0%, 100% { opacity: 0; transform: translateY(50%) scale(0); }
      15%      { opacity: 1; transform: translateY(-50%) scale(1.2); }
      50%      { opacity: 0.8; transform: translateY(-150%) scale(0.9); }
      85%      { opacity: 0.3; transform: translateY(-250%) scale(0.5); }
    }
    @keyframes idv-complete-pulse {
      0%   { box-shadow: 0 0 4px 1px rgba(110,231,160,0.3); }
      50%  { box-shadow: 0 0 12px 3px rgba(110,231,160,0.5); }
      100% { box-shadow: 0 0 4px 1px rgba(110,231,160,0.3); }
    }
  `;
  document.head.appendChild(style);
})();

const TOTAL_DIMENSIONS = 6;

// ── Sub-components ──

function ProgressBar({answeredCount, maxWidth}: {answeredCount: number; maxWidth?: number}) {
  const pct = (answeredCount / TOTAL_DIMENSIONS) * 100;
  const isComplete = answeredCount === TOTAL_DIMENSIONS;
  const glowIntensity = answeredCount / TOTAL_DIMENSIONS; // 0 to 1

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.md,
        width: '100%',
        maxWidth,
      }}>
      {/* Track */}
      <div
        role="progressbar"
        aria-valuenow={answeredCount}
        aria-valuemin={0}
        aria-valuemax={TOTAL_DIMENSIONS}
        aria-label={`Voting progress: ${answeredCount} of ${TOTAL_DIMENSIONS} dimensions answered`}
        style={{
          flex: 1,
          height: 8,
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
        {/* Fill with golden gradient + glow */}
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: isComplete
              ? 'linear-gradient(90deg, #4ade80, #6ee7a0, #4ade80)'
              : 'linear-gradient(90deg, #b8860b, #d4af37, #ffb900, #ffd700)',
            borderRadius: 4,
            transition: `width 0.5s ${EASING.bounce}, box-shadow 0.5s ${EASING.smooth}`,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: isComplete
              ? '0 0 12px 2px rgba(110,231,160,0.4)'
              : `0 0 ${8 + glowIntensity * 12}px ${1 + glowIntensity * 2}px rgba(255,185,0,${0.15 + glowIntensity * 0.25})`,
            animation: isComplete ? 'idv-complete-pulse 2s ease-in-out infinite' : undefined,
          }}>
          {/* Shimmer sweep */}
          {answeredCount > 0 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                animation: 'idv-shimmer 2.5s ease-in-out infinite',
              }}
            />
          )}
        </div>

        {/* Sparkles along the fill — SVG stars that float up and fade */}
        {answeredCount > 0 && answeredCount < TOTAL_DIMENSIONS && (
          <>
            {[0, 1, 2, 3].map((i) => (
              <svg
                key={i}
                width="7"
                height="7"
                viewBox="0 0 10 10"
                style={{
                  position: 'absolute',
                  left: `calc(${pct}% - ${6 + i * 8}px)`,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  animation: `idv-sparkle ${1.5 + i * 0.5}s ease-in-out ${i * 0.4}s infinite`,
                  pointerEvents: 'none',
                  overflow: 'visible',
                }}>
                <path
                  d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z"
                  fill="#ffd700"
                  style={{filter: 'drop-shadow(0 0 2px rgba(255,215,0,0.8))'}}
                />
              </svg>
            ))}
          </>
        )}
      </div>

      {/* Label */}
      <span
        style={{
          fontSize: FONT_SIZES.sm,
          fontWeight: isComplete ? 700 : 600,
          color: isComplete ? '#6ee7a0' : COLORS.primary,
          fontFamily: FONTS.body,
          whiteSpace: 'nowrap',
          transition: `color 0.3s ${EASING.smooth}`,
          textShadow: isComplete
            ? '0 0 8px rgba(110,231,160,0.4)'
            : `0 0 ${4 + glowIntensity * 6}px rgba(255,185,0,${0.1 + glowIntensity * 0.2})`,
        }}>
        {isComplete ? '\u2713 Complete' : `${answeredCount} / ${TOTAL_DIMENSIONS}`}
      </span>
    </div>
  );
}

// ── Response-aware success messages ──

import type {InDepthFormState} from '../features/voting/types';
import type {Accuracy} from '../shared/lib/supabase';

/** Collect all applicable insight messages, then pick one at random */
function getResponseInsight(formState: InDepthFormState): string {
  const insights: string[] = [];

  // isReal
  if (formState.isReal === false) insights.push("Your skepticism sharpens our detection.");
  if (formState.isReal === true) insights.push("Confirmed \u2014 this synergy is the real deal.");

  // accuracy
  if (formState.accuracy === (-1 as Accuracy)) insights.push("Noted \u2014 this score may need to come down.");
  if (formState.accuracy === (0 as Accuracy)) insights.push("Good to know the engine got this one right.");
  if (formState.accuracy === (1 as Accuracy)) insights.push("Noted \u2014 this pair might deserve a higher score.");

  // score
  if (formState.score !== null && formState.score >= 9) insights.push("A perfect synergy \u2014 high praise!");
  if (formState.score !== null && formState.score <= 3) insights.push("A weak link \u2014 honest ratings make the engine smarter.");
  if (formState.score !== null && formState.score >= 4 && formState.score <= 8) insights.push("A solid rating \u2014 the middle range is where precision matters most.");

  // wouldPlay
  if (formState.wouldPlay === false) insights.push("Not every synergy belongs in a deck \u2014 that\u2019s useful data.");
  if (formState.wouldPlay === true) insights.push("A pair worth building around \u2014 noted!");

  // whoCarries
  if (formState.whoCarries === 'a' || formState.whoCarries === 'b') insights.push("Knowing which card drives it helps players prioritize.");
  if (formState.whoCarries === 'both') insights.push("Equal partners \u2014 both cards pull their weight here.");

  // difficulty
  if (formState.difficulty === 3) insights.push("Hard to pull off \u2014 good to know for deckbuilders.");
  if (formState.difficulty === 2) insights.push("Situational synergies are the trickiest to score \u2014 thanks for the clarity.");
  if (formState.difficulty === 1) insights.push("Easy to execute \u2014 a reliable combo.");

  if (insights.length === 0) return "Your perspective makes the scores more accurate.";
  return insights[Math.floor(Math.random() * insights.length)];
}

const CLOSERS = [
  "The community scores get sharper with every vote.",
  "Lorcana players everywhere benefit from this.",
  "This pair\u2019s accuracy just improved.",
  "One vote closer to perfect synergy scores.",
  "Your input shapes what other players see.",
];

function getRandomCloser(): string {
  return CLOSERS[Math.floor(Math.random() * CLOSERS.length)];
}

function SuccessCard({formState, onBack, onVoteMore}: {formState: InDepthFormState; onBack: () => void; onVoteMore: () => void}) {
  const insight = getResponseInsight(formState);
  const closer = getRandomCloser();

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
        animation: 'idv-fade-up 0.4s ease-out',
      }}>
      <div
        style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#1a3d1a', border: '2px solid #6ee7a0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="#6ee7a0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="24" style={{animation: 'idv-check-draw 0.5s ease-out 0.2s both'}} />
        </svg>
      </div>
      <span style={{fontSize: FONT_SIZES.xxl, fontWeight: 700, color: COLORS.primary, fontFamily: FONTS.body}}>
        Thanks for your feedback!
      </span>
      <span style={{fontSize: FONT_SIZES.base, color: COLORS.text, fontFamily: FONTS.body}}>
        {insight}
      </span>
      <span style={{fontSize: FONT_SIZES.base, color: COLORS.textMuted, fontFamily: FONTS.body, fontStyle: 'italic'}}>
        {closer}
      </span>
      <div style={{display: 'flex', gap: 12, marginTop: SPACING.sm}}>
        <CtaButton onClick={onBack}>Back to synergy</CtaButton>
        <CtaButton variant="ghost" onClick={onVoteMore}>Vote on more pairs</CtaButton>
      </div>
    </div>
  );
}

// ── Main page ──

export function InDepthVotePage() {
  const navigate = useNavigate();
  const {cardAId, cardBId} = useParams<{cardAId: string; cardBId: string}>();
  const {isMobile} = useResponsive();
  const {cards} = useCardDataContext();

  const {pair, isLoading, error} = useSpecificPair(cardAId, cardBId);
  const session = useInDepthVoteSession(pair);

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
        <CompactHeader onLogoClick={() => navigate('/')} isMobile={isMobile} cards={cards} onCardSelect={(card) => navigate(`/card/${card.id}`)} />
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16}}>
          <span style={{fontSize: FONT_SIZES.xl, fontWeight: 700, color: COLORS.text, fontFamily: FONTS.body}}>
            {error ?? 'Pair not found'}
          </span>
          <CtaButton variant="ghost" onClick={() => navigate('/')}>Back to Home</CtaButton>
        </div>
      </div>
    );
  }

  // Shared form props
  const formProps = {
    formState: session.formState,
    cardA: pair.cardA,
    cardB: pair.cardB,
    onSetIsReal: session.setIsReal,
    onSetAccuracy: session.setAccuracy,
    onSetScore: session.setScore,
    onSetWouldPlay: session.setWouldPlay,
    onSetWhoCarries: session.setWhoCarries,
    onSetDifficulty: session.setDifficulty,
  };

  // Status banners
  const statusBanners = (
    <>
      {session.isRateLimited && <VoteStatusBanner type="rate_limited" />}
      {session.lastResult === 'error' && <VoteStatusBanner type="error" />}
    </>
  );

  const isSuccess = session.lastResult === 'success';

  return (
    <div style={{minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', overflowY: 'auto'}}>
      <EtherealBackground isMobile={isMobile} vivid />
      <CompactHeader onLogoClick={() => navigate('/')} isMobile={isMobile} cards={cards} onCardSelect={(card) => navigate(`/card/${card.id}`)} />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: isMobile ? '16px 16px 120px' : '16px 32px 60px',
          gap: 16,
          position: 'relative',
          zIndex: 1,
        }}>

        {/* Back link */}
        <div style={{width: '100%', maxWidth: isMobile ? 560 : 1320}}>
          <BackLink onClick={handleBack} label="Back to synergy" />
        </div>

        {isMobile ? (
          /* ══ Mobile: stacked tabbed layout ══ */
          <>
            <PairDisplay
              pair={pair}
              selectedScore={null}
              isMobile
              showEngineScore
            />

            {!isSuccess && (
              <>
                <ProgressBar answeredCount={answeredCount} maxWidth={560} />
                <span style={{fontSize: FONT_SIZES.lg, color: COLORS.primary, fontFamily: FONTS.body, textAlign: 'center', fontWeight: 500, fontStyle: 'italic'}}>
                  Every response helps calibrate synergy scores.
                </span>
              </>
            )}

            {statusBanners}

            <div style={{width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: SPACING.xl, alignItems: 'center'}}>
              {isSuccess ? (
                <SuccessCard formState={session.formState} onBack={handleBack} onVoteMore={() => navigate('/vote')} />
              ) : (
                <>
                  <InDepthVoteForm {...formProps} isMobile animate layout="tabbed" />
                  {allAnswered && (
                    <CtaButton
                      onClick={session.submit}
                      disabled={session.isSubmitting || session.isRateLimited}
                      style={{
                        width: '100%',
                        animation: session.isSubmitting ? 'idv-submit-glow 1.5s ease-in-out infinite' : 'idv-fade-up 0.35s ease-out',
                      }}>
                      {session.isSubmitting ? 'Submitting...' : 'Submit your vote'}
                    </CtaButton>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          /* ══ Desktop: side-by-side layout ══ */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: 60,
              width: '100%',
              maxWidth: 1320,
              alignItems: 'start',
            }}>
            {/* Left column: pair + synergy descriptions (sticky) */}
            <div style={{
              position: 'sticky',
              top: LAYOUT.compactHeaderHeight + 16,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}>
              <PairDisplay
                pair={pair}
                selectedScore={null}
                showEngineScore
              />
            </div>

            {/* Right column: progress + form + submit (center-aligned) */}
            <div style={{display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', alignSelf: 'center', minWidth: 0}}>
              {!isSuccess && (
                <>
                  <ProgressBar answeredCount={answeredCount} />
                  <span style={{fontSize: FONT_SIZES.lg, color: COLORS.primary, fontFamily: FONTS.body, textAlign: 'center', fontWeight: 500, fontStyle: 'italic'}}>
                    Every response helps calibrate synergy scores.
                  </span>
                </>
              )}

              {statusBanners}

              {isSuccess ? (
                <SuccessCard formState={session.formState} onBack={handleBack} onVoteMore={() => navigate('/vote')} />
              ) : (
                <>
                  <div style={{width: '100%', maxWidth: 560}}>
                    <InDepthVoteForm {...formProps} animate layout="tabbed" />
                  </div>

                  {allAnswered && (
                    <CtaButton
                      onClick={session.submit}
                      disabled={session.isSubmitting || session.isRateLimited}
                      style={{
                        width: '100%',
                        maxWidth: 560,
                        animation: session.isSubmitting ? 'idv-submit-glow 1.5s ease-in-out infinite' : 'idv-fade-up 0.35s ease-out',
                      }}>
                      {session.isSubmitting ? 'Submitting...' : 'Submit your vote'}
                    </CtaButton>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
