import {useCallback, useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {CompactHeader, CtaButton, LoadingSpinner, EtherealBackground} from '../shared/components';
import {useResponsive} from '../shared/hooks';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {PairDisplay, ScorePicker, VoteToast, VoteStatusBanner} from '../features/voting';
import type {VoteToastData} from '../features/voting';
import {usePairQueue} from '../features/voting/hooks/usePairQueue';
import {useVoteSession} from '../features/voting/hooks/useVoteSession';
import type {Score} from '../shared/lib/supabase';
import {COLORS, FONTS, FONT_SIZES} from '../shared/constants';

export function VotePage() {
  const navigate = useNavigate();
  const {isMobile, windowWidth} = useResponsive();
  // Voting page needs ~850px for desktop card pair (2×340 + dashes + badge)
  const compactLayout = isMobile || windowWidth < 900;
  // Side stacks need ~350px each beyond the card pair (first tier = 286px + margin)
  const showStacks = !compactLayout && windowWidth >= 1500;
  const {cards} = useCardDataContext();
  const {currentPair, upcomingPreviews, previousPreviews, isLoading, error, advance, skip, undo, canUndo, isEmpty} = usePairQueue();
  const voteSession = useVoteSession(currentPair);

  const [toastData, setToastData] = useState<VoteToastData | null>(null);
  const streakRef = useRef(0);

  /** One-click vote: click score → show toast → advance immediately → submit in background */
  const handleScoreClick = useCallback(
    (score: Score) => {
      if (!currentPair || voteSession.isRateLimited) return;

      // Track streak (close match = diff <= 1)
      const diff = Math.abs(score - currentPair.aggregateScore);
      streakRef.current = diff <= 1 ? streakRef.current + 1 : 0;

      // Show toast immediately with score comparison (optimistic)
      setToastData({
        cardAName: currentPair.cardA.fullName,
        cardBName: currentPair.cardB.fullName,
        engineScore: currentPair.aggregateScore,
        userScore: score,
        streak: streakRef.current,
      });

      // Advance to next pair immediately
      advance();

      // Submit vote in background (fire-and-forget)
      voteSession.submitWithScore(score);
    },
    [voteSession, currentPair, advance],
  );

  const handleSkip = useCallback(() => {
    voteSession.resetForm();
    skip();
  }, [voteSession, skip]);

  const handleToastDismiss = useCallback(() => {
    setToastData(null);
  }, []);

  const handleUndo = useCallback(() => {
    undo();
    setToastData(null);
  }, [undo]);

  // Keyboard shortcuts: 1-9 → score, 0 → score 10, S → skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!currentPair || voteSession.isRateLimited) return;

      if (e.key >= '1' && e.key <= '9') {
        handleScoreClick(Number(e.key) as Score);
      } else if (e.key === '0') {
        handleScoreClick(10 as Score);
      } else if (e.key.toLowerCase() === 's') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleScoreClick, handleSkip, currentPair, voteSession.isRateLimited]);

  // Loading state
  if (isLoading && !currentPair) {
    return (
      <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (error) {
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
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
          }}>
          <VoteStatusBanner type="error" onRetry={() => window.location.reload()} />
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
          justifyContent: compactLayout ? 'flex-start' : 'center',
          padding: isMobile ? '16px 16px 120px' : compactLayout ? '16px 16px 60px' : '0 0 60px',
          gap: 12,
          position: 'relative',
          zIndex: 1,
        }}>
        {/* Status banners */}
        {voteSession.isRateLimited && (
          <div style={{width: '100%', maxWidth: 760}}>
            <VoteStatusBanner type="rate_limited" />
          </div>
        )}
        {voteSession.lastResult === 'error' && (
          <div style={{width: '100%', maxWidth: 760}}>
            <VoteStatusBanner type="error" />
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              padding: 32,
            }}>
            <span style={{fontSize: 20, fontWeight: 700, color: COLORS.text, fontFamily: FONTS.body}}>
              All caught up!
            </span>
            <span style={{fontSize: 13, color: COLORS.textMuted, fontFamily: FONTS.body, textAlign: 'center'}}>
              You've voted on all available pairs this session.
            </span>
            <CtaButton onClick={() => navigate('/')}>Back to Home</CtaButton>
          </div>
        )}

        {/* Pair display + score picker */}
        {currentPair && (
          <>
            <PairDisplay
              pair={currentPair}
              selectedScore={null}
              previousPairs={showStacks ? previousPreviews : undefined}
              upcomingPairs={showStacks ? upcomingPreviews : undefined}
              isMobile={compactLayout}
            />

            {/* Score picker — click = instant vote + advance */}
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
              <span style={{fontSize: FONT_SIZES.base, color: COLORS.mutedText, fontFamily: FONTS.body}}>
                How strong is this synergy?
              </span>
              <ScorePicker
                value={voteSession.formState.score}
                onChange={handleScoreClick}
                isMobile={compactLayout}
              />
              <button
                onClick={handleSkip}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = COLORS.primary500;
                  e.currentTarget.style.borderColor = COLORS.primary500;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = COLORS.textMuted;
                  e.currentTarget.style.borderColor = COLORS.surfaceBorder;
                }}
                style={{
                  background: 'none',
                  border: `1px solid ${COLORS.surfaceBorder}`,
                  borderRadius: 8,
                  color: COLORS.textMuted,
                  fontSize: 13,
                  fontFamily: FONTS.body,
                  cursor: 'pointer',
                  padding: compactLayout ? '12px 24px' : '8px 24px',
                  marginTop: 4,
                  transition: 'color 0.2s ease, border-color 0.2s ease',
                }}>
                {compactLayout ? 'Skip this pair' : 'Skip this pair (S)'}
              </button>
            </div>
          </>
        )}
      </main>

      {/* Toast notification */}
      {toastData && (
        <VoteToast key={`${toastData.cardAName}:${toastData.cardBName}`} data={toastData} onDismiss={handleToastDismiss} onUndo={canUndo ? handleUndo : undefined} isMobile={isMobile} />
      )}
    </div>
  );
}
