import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {useNavigate} from 'react-router-dom';
import Skeleton, {SkeletonTheme} from 'react-loading-skeleton';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CompactHeader, CtaButton, EtherealBackground} from '../shared/components';
import {CardDetailSkeleton} from '../features/cards';
import {useResponsive} from '../shared/hooks';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {PairDisplay, ScorePicker, VoteToast, VoteStatusBanner} from '../features/voting';
import type {VoteToastData} from '../features/voting';
import {usePairQueue} from '../features/voting/hooks/usePairQueue';
import {useVoteSession} from '../features/voting/hooks/useVoteSession';
import type {Score} from '../shared/lib/supabase';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../shared/constants';

// ──────────────────────────────────────────────────────────
// Module helpers
// ──────────────────────────────────────────────────────────

function getMainPadding(isMobile: boolean, compactLayout: boolean): string {
  if (isMobile) return '16px 16px 120px';
  if (compactLayout) return '16px 16px 60px';
  return '0 0 60px';
}

function getMainJustify(compactLayout: boolean): 'flex-start' | 'center' {
  return compactLayout ? 'flex-start' : 'center';
}

/** Number keys 1-9 → score 1-9; 0 → score 10. Anything else → null. */
function getScoreFromKey(key: string): Score | null {
  if (key >= '1' && key <= '9') return Number(key) as Score;
  if (key === '0') return 10 as Score;
  return null;
}

// ──────────────────────────────────────────────────────────
// Custom hooks
// ──────────────────────────────────────────────────────────

type VoteSession = ReturnType<typeof useVoteSession>;

function useVoteHandlers({
  currentPair,
  voteSession,
  advance,
  skip,
  undo,
}: {
  currentPair: ReturnType<typeof usePairQueue>['currentPair'];
  voteSession: VoteSession;
  advance: () => void;
  skip: () => void;
  undo: () => void;
}) {
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

  return {toastData, handleScoreClick, handleSkip, handleToastDismiss, handleUndo};
}

/** Wires window keydown shortcuts: 1-9 → score, 0 → score 10, S → skip. */
function useVoteKeyboardShortcuts({
  pair,
  isRateLimited,
  onScore,
  onSkip,
}: {
  pair: ReturnType<typeof usePairQueue>['currentPair'];
  isRateLimited: boolean;
  onScore: (score: Score) => void;
  onSkip: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!pair || isRateLimited) return;
      const score = getScoreFromKey(e.key);
      if (score !== null) {
        onScore(score);
        return;
      }
      if (e.key.toLowerCase() === 's') {
        onSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScore, onSkip, pair, isRateLimited]);
}

// ──────────────────────────────────────────────────────────
// Page shell + sub-components
// ──────────────────────────────────────────────────────────

const pageShellOuter = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  overflow: 'hidden',
  overflowY: 'auto',
} as const;

type PageHeaderProps = {
  isMobile: boolean;
  cards: LorcanaCard[];
  onLogoClick: () => void;
  onCardSelect: (card: {id: string}) => void;
};

function VotePageShell({
  isMobile,
  cards,
  compactLayout,
  onLogoClick,
  onCardSelect,
  ariaBusy,
  ariaLabel,
  mainGap = 12,
  children,
  tail,
}: PageHeaderProps & {
  compactLayout: boolean;
  ariaBusy?: boolean;
  ariaLabel?: string;
  mainGap?: number;
  children: ReactNode;
  tail?: ReactNode;
}) {
  return (
    <div style={pageShellOuter}>
      <EtherealBackground isMobile={isMobile} vivid />
      <CompactHeader
        onLogoClick={onLogoClick}
        isMobile={isMobile}
        cards={cards}
        onCardSelect={onCardSelect}
      />
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: getMainJustify(compactLayout),
          padding: getMainPadding(isMobile, compactLayout),
          gap: mainGap,
          position: 'relative',
          zIndex: 1,
        }}
        aria-busy={ariaBusy}
        aria-label={ariaLabel}>
        {children}
      </main>
      {tail}
    </div>
  );
}

function VoteSkeletonPair({compactLayout}: {compactLayout: boolean}) {
  const skelImageWidth = compactLayout ? 220 : 298;
  const skelCardWidth = compactLayout ? 260 : 340;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: compactLayout ? 'column' : 'row',
        gap: compactLayout ? SPACING.lg : SPACING.xl,
        alignItems: 'center',
      }}>
      <CardDetailSkeleton
        imageWidth={skelImageWidth}
        textLines={0}
        width={skelCardWidth}
        padding={0}
      />
      <CardDetailSkeleton
        imageWidth={skelImageWidth}
        textLines={0}
        width={skelCardWidth}
        padding={0}
      />
    </div>
  );
}

function VoteSkeletonPicker() {
  return (
    <SkeletonTheme baseColor={COLORS.surfaceAlt} highlightColor={COLORS.surfaceHover}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
        <Skeleton width={220} height={14} borderRadius={RADIUS.sm} />
        <div style={{display: 'flex', gap: 6}}>
          {Array.from({length: 10}, (_, i) => (
            <Skeleton key={i} width={32} height={32} borderRadius={RADIUS.md} />
          ))}
        </div>
        <Skeleton width={140} height={32} borderRadius={RADIUS.lg} />
      </div>
    </SkeletonTheme>
  );
}

function VoteLoadingView({
  isMobile,
  cards,
  compactLayout,
  onLogoClick,
  onCardSelect,
}: PageHeaderProps & {compactLayout: boolean}) {
  return (
    <VotePageShell
      isMobile={isMobile}
      cards={cards}
      compactLayout={compactLayout}
      onLogoClick={onLogoClick}
      onCardSelect={onCardSelect}
      mainGap={24}
      ariaBusy
      ariaLabel="Loading vote pair">
      <VoteSkeletonPair compactLayout={compactLayout} />
      <VoteSkeletonPicker />
    </VotePageShell>
  );
}

function VoteErrorView({isMobile, cards, onLogoClick, onCardSelect}: PageHeaderProps) {
  return (
    <div style={{minHeight: '100vh', display: 'flex', flexDirection: 'column'}}>
      <CompactHeader
        onLogoClick={onLogoClick}
        isMobile={isMobile}
        cards={cards}
        onCardSelect={onCardSelect}
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

function MaxWidthBanner({type}: {type: 'rate_limited' | 'error'}) {
  return (
    <div style={{width: '100%', maxWidth: 760}}>
      <VoteStatusBanner type={type} />
    </div>
  );
}

function StatusBanners({session}: {session: VoteSession}) {
  return (
    <>
      {session.isRateLimited && <MaxWidthBanner type="rate_limited" />}
      {session.lastResult === 'error' && <MaxWidthBanner type="error" />}
    </>
  );
}

function EmptyVotesView({onHome}: {onHome: () => void}) {
  return (
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
      <span
        style={{
          fontSize: 13,
          color: COLORS.textMuted,
          fontFamily: FONTS.body,
          textAlign: 'center',
        }}>
        You&apos;ve voted on all available pairs this session.
      </span>
      <CtaButton onClick={onHome}>Back to Home</CtaButton>
    </div>
  );
}

function SkipPairButton({
  onClick,
  compactLayout,
}: {
  onClick: () => void;
  compactLayout: boolean;
}) {
  return (
    <button
      onClick={onClick}
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
  );
}

function ScorePickerArea({
  formScore,
  compactLayout,
  onScore,
  onSkip,
}: {
  formScore: Score | null;
  compactLayout: boolean;
  onScore: (score: Score) => void;
  onSkip: () => void;
}) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
      <span style={{fontSize: FONT_SIZES.base, color: COLORS.mutedText, fontFamily: FONTS.body}}>
        How strong is this synergy?
      </span>
      <ScorePicker value={formScore} onChange={onScore} isMobile={compactLayout} />
      <SkipPairButton onClick={onSkip} compactLayout={compactLayout} />
    </div>
  );
}

type Queue = ReturnType<typeof usePairQueue>;

function VoteCardArea({
  pair,
  showStacks,
  previousPreviews,
  upcomingPreviews,
  compactLayout,
  formScore,
  onScore,
  onSkip,
}: {
  pair: NonNullable<Queue['currentPair']>;
  showStacks: boolean;
  previousPreviews: Queue['previousPreviews'];
  upcomingPreviews: Queue['upcomingPreviews'];
  compactLayout: boolean;
  formScore: Score | null;
  onScore: (score: Score) => void;
  onSkip: () => void;
}) {
  return (
    <>
      <PairDisplay
        pair={pair}
        selectedScore={null}
        previousPairs={showStacks ? previousPreviews : undefined}
        upcomingPairs={showStacks ? upcomingPreviews : undefined}
        isMobile={compactLayout}
      />
      <ScorePickerArea
        formScore={formScore}
        compactLayout={compactLayout}
        onScore={onScore}
        onSkip={onSkip}
      />
    </>
  );
}

type Handlers = ReturnType<typeof useVoteHandlers>;

function VotePageMainView({
  isMobile,
  cards,
  compactLayout,
  showStacks,
  queue,
  voteSession,
  handlers,
  onLogoClick,
  onCardSelect,
}: PageHeaderProps & {
  compactLayout: boolean;
  showStacks: boolean;
  queue: Queue;
  voteSession: VoteSession;
  handlers: Handlers;
}) {
  const {toastData, handleScoreClick, handleSkip, handleToastDismiss, handleUndo} = handlers;
  return (
    <VotePageShell
      isMobile={isMobile}
      cards={cards}
      compactLayout={compactLayout}
      onLogoClick={onLogoClick}
      onCardSelect={onCardSelect}
      tail={
        toastData && (
          <VoteToast
            key={`${toastData.cardAName}:${toastData.cardBName}`}
            data={toastData}
            onDismiss={handleToastDismiss}
            onUndo={queue.canUndo ? handleUndo : undefined}
            isMobile={isMobile}
          />
        )
      }>
      <StatusBanners session={voteSession} />
      {queue.isEmpty && <EmptyVotesView onHome={onLogoClick} />}
      {queue.currentPair && (
        <VoteCardArea
          pair={queue.currentPair}
          showStacks={showStacks}
          previousPreviews={queue.previousPreviews}
          upcomingPreviews={queue.upcomingPreviews}
          compactLayout={compactLayout}
          formScore={voteSession.formState.score}
          onScore={handleScoreClick}
          onSkip={handleSkip}
        />
      )}
    </VotePageShell>
  );
}

// ──────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────

export function VotePage() {
  const navigate = useNavigate();
  const {isMobile, windowWidth} = useResponsive();
  // Voting page needs ~850px for desktop card pair (2×340 + dashes + badge)
  const compactLayout = isMobile || windowWidth < 900;
  // Side stacks need ~350px each beyond the card pair (first tier = 286px + margin)
  const showStacks = !compactLayout && windowWidth >= 1500;
  const {cards} = useCardDataContext();
  const queue = usePairQueue();
  const voteSession = useVoteSession(queue.currentPair);

  const goHome = useCallback(() => navigate('/'), [navigate]);
  const onCardSelect = useCallback(
    (card: {id: string}) => navigate(`/card/${card.id}`),
    [navigate],
  );

  const handlers = useVoteHandlers({
    currentPair: queue.currentPair,
    voteSession,
    advance: queue.advance,
    skip: queue.skip,
    undo: queue.undo,
  });

  useVoteKeyboardShortcuts({
    pair: queue.currentPair,
    isRateLimited: voteSession.isRateLimited,
    onScore: handlers.handleScoreClick,
    onSkip: handlers.handleSkip,
  });

  if (queue.isLoading && !queue.currentPair) {
    return (
      <VoteLoadingView
        isMobile={isMobile}
        cards={cards}
        compactLayout={compactLayout}
        onLogoClick={goHome}
        onCardSelect={onCardSelect}
      />
    );
  }

  if (queue.error) {
    return (
      <VoteErrorView
        isMobile={isMobile}
        cards={cards}
        onLogoClick={goHome}
        onCardSelect={onCardSelect}
      />
    );
  }

  return (
    <VotePageMainView
      isMobile={isMobile}
      cards={cards}
      compactLayout={compactLayout}
      showStacks={showStacks}
      queue={queue}
      voteSession={voteSession}
      handlers={handlers}
      onLogoClick={goHome}
      onCardSelect={onCardSelect}
    />
  );
}
