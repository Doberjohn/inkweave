import type {ReactNode} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {CompactHeader, CtaButton, BackLink, EtherealBackground, Sparkles} from '../shared/components';
import {CardDetailSkeleton} from '../features/cards';
import {useResponsive} from '../shared/hooks';
import {useCardModal} from '../shared/contexts/CardModalContext';
import {PairDisplay, VoteStatusBanner, InDepthVoteForm, VoteFormSkeleton} from '../features/voting';
import {useSpecificPair} from '../features/voting/hooks/useSpecificPair';
import {
  useInDepthVoteSession,
  type UseInDepthVoteSessionReturn,
} from '../features/voting/hooks/useInDepthVoteSession';
import type {InDepthFormState, VotingPair} from '../features/voting/types';
import type {Accuracy} from '../shared/lib/supabase';
import {COLORS, EASING, FONTS, FONT_SIZES, LAYOUT, RADIUS, SPACING, TIER_COLORS, hexRgba, whiteRgba} from '../shared/constants';

/** Inject keyframes once at module load */
(function injectKeyframes() {
  const STYLE_ID = 'indepth-page-keyframes';
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes idv-submit-glow {
      0%   { box-shadow: 0 0 0 0 ${hexRgba(COLORS.primary500, 0.4)}; }
      50%  { box-shadow: 0 0 20px 6px ${hexRgba(COLORS.primary500, 0.15)}; }
      100% { box-shadow: 0 0 0 0 ${hexRgba(COLORS.primary500, 0)}; }
    }
    @keyframes idv-check-draw {
      from { stroke-dashoffset: 24; }
      to   { stroke-dashoffset: 0; }
    }
    @keyframes idv-shimmer {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(200%); }
    }
    @keyframes idv-complete-pulse {
      0%   { box-shadow: 0 0 4px 1px ${hexRgba(TIER_COLORS.strong.color, 0.3)}; }
      50%  { box-shadow: 0 0 12px 3px ${hexRgba(TIER_COLORS.strong.color, 0.5)}; }
      100% { box-shadow: 0 0 4px 1px ${hexRgba(TIER_COLORS.strong.color, 0.3)}; }
    }
  `;
  document.head.appendChild(style);
})();

const TOTAL_DIMENSIONS = 6;

// ──────────────────────────────────────────────────────────
// Helpers (module scope)
// ──────────────────────────────────────────────────────────

function countAnsweredDimensions(formState: InDepthFormState): number {
  return [
    formState.isReal,
    formState.accuracy,
    formState.score,
    formState.wouldPlay,
    formState.whoCarries,
    formState.difficulty,
  ].filter((v) => v !== null).length;
}

type InsightRule = {when: (s: InDepthFormState) => boolean; message: string};

/** Table-driven insight matching: each rule contributes a candidate message
 * if its predicate fires, then one message is picked at random from the
 * matches. Replaces 15 sequential if-statements (CC 22). */
const INSIGHT_RULES: InsightRule[] = [
  {when: (s) => s.isReal === false, message: 'Your skepticism sharpens our detection.'},
  {when: (s) => s.isReal === true, message: 'Confirmed — this synergy is the real deal.'},
  {when: (s) => s.accuracy === (-1 as Accuracy), message: 'Noted — this score may need to come down.'},
  {when: (s) => s.accuracy === (0 as Accuracy), message: 'Good to know the engine got this one right.'},
  {when: (s) => s.accuracy === (1 as Accuracy), message: 'Noted — this pair might deserve a higher score.'},
  {when: (s) => s.score !== null && s.score >= 9, message: 'A perfect synergy — high praise!'},
  {when: (s) => s.score !== null && s.score <= 3, message: 'A weak link — honest ratings make the engine smarter.'},
  {
    when: (s) => s.score !== null && s.score >= 4 && s.score <= 8,
    message: 'A solid rating — the middle range is where precision matters most.',
  },
  {when: (s) => s.wouldPlay === false, message: 'Not every synergy belongs in a deck — that’s useful data.'},
  {when: (s) => s.wouldPlay === true, message: 'A pair worth building around — noted!'},
  {
    when: (s) => s.whoCarries === 'a' || s.whoCarries === 'b',
    message: 'Knowing which card drives it helps players prioritize.',
  },
  {when: (s) => s.whoCarries === 'both', message: 'Equal partners — both cards pull their weight here.'},
  {when: (s) => s.difficulty === 3, message: 'Hard to pull off — good to know for deckbuilders.'},
  {
    when: (s) => s.difficulty === 2,
    message: 'Situational synergies are the trickiest to score — thanks for the clarity.',
  },
  {when: (s) => s.difficulty === 1, message: 'Easy to execute — a reliable combo.'},
];

const INSIGHT_FALLBACK = 'Your perspective makes the scores more accurate.';

const CLOSERS = [
  'The community scores get sharper with every vote.',
  'Lorcana players everywhere benefit from this.',
  'This pair’s accuracy just improved.',
  'One vote closer to perfect synergy scores.',
  'Your input shapes what other players see.',
];

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function getResponseInsight(formState: InDepthFormState): string {
  const matches = INSIGHT_RULES.filter((r) => r.when(formState)).map((r) => r.message);
  if (matches.length === 0) return INSIGHT_FALLBACK;
  return pickRandom(matches);
}

function getRandomCloser(): string {
  return pickRandom(CLOSERS);
}

function getFormProps(session: UseInDepthVoteSessionReturn, pair: VotingPair) {
  return {
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
}

// ──────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────

type ProgressVisuals = {
  sparkleColor: string;
  barBg: string;
  barShadow: string;
  barAnimation: string | undefined;
  labelWeight: 700 | 600;
  labelColor: string;
  labelShadow: string;
  labelText: string;
};

function buildProgressVisuals(
  isComplete: boolean,
  glowIntensity: number,
  answeredCount: number,
): ProgressVisuals {
  if (isComplete) {
    return {
      sparkleColor: TIER_COLORS.strong.color,
      barBg: `linear-gradient(90deg, ${COLORS.success}, ${TIER_COLORS.strong.color}, ${COLORS.success})`,
      barShadow: `0 0 12px 2px ${hexRgba(TIER_COLORS.strong.color, 0.4)}`,
      barAnimation: `idv-complete-pulse 2s ${EASING.smooth} infinite`,
      labelWeight: 700,
      labelColor: TIER_COLORS.strong.color,
      labelShadow: `0 0 8px ${hexRgba(TIER_COLORS.strong.color, 0.4)}`,
      labelText: '✓ Complete',
    };
  }
  return {
    sparkleColor: COLORS.primaryHover,
    barBg: `linear-gradient(90deg, ${COLORS.primary700}, ${COLORS.primary600}, ${COLORS.primary}, ${COLORS.primaryHover})`,
    barShadow: `0 0 ${8 + glowIntensity * 12}px ${1 + glowIntensity * 2}px ${hexRgba(COLORS.primary, 0.15 + glowIntensity * 0.25)}`,
    barAnimation: undefined,
    labelWeight: 600,
    labelColor: COLORS.primary,
    labelShadow: `0 0 ${4 + glowIntensity * 6}px ${hexRgba(COLORS.primary, 0.1 + glowIntensity * 0.2)}`,
    labelText: `${answeredCount} / ${TOTAL_DIMENSIONS}`,
  };
}

function ProgressBar({answeredCount, maxWidth}: {answeredCount: number; maxWidth?: number}) {
  const pct = (answeredCount / TOTAL_DIMENSIONS) * 100;
  const isComplete = answeredCount === TOTAL_DIMENSIONS;
  const glowIntensity = answeredCount / TOTAL_DIMENSIONS; // 0 to 1
  const v = buildProgressVisuals(isComplete, glowIntensity, answeredCount);
  const showSparkles = answeredCount > 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.md,
        width: '100%',
        maxWidth,
      }}>
      {/* Track with sparkles */}
      <Sparkles color={v.sparkleColor} minSize={3} maxSize={8} rate={showSparkles ? 500 : 99999}>
        <div
          role="progressbar"
          aria-valuenow={answeredCount}
          aria-valuemin={0}
          aria-valuemax={TOTAL_DIMENSIONS}
          aria-label={`Voting progress: ${answeredCount} of ${TOTAL_DIMENSIONS} dimensions answered`}
          style={{
            width: '100%',
            height: 8,
            background: whiteRgba(0.04),
            borderRadius: RADIUS.sm,
            overflow: 'hidden',
            position: 'relative',
            border: `1px solid ${whiteRgba(0.06)}`,
          }}>
          {/* Fill with golden gradient + glow */}
          <div
            className="idv-progress-fill"
            style={{
              height: '100%',
              width: `${pct}%`,
              background: v.barBg,
              borderRadius: RADIUS.sm,
              transition: `width 0.5s ${EASING.smooth}, box-shadow 0.5s ${EASING.smooth}`,
              boxShadow: v.barShadow,
              animation: v.barAnimation,
              position: 'relative',
              overflow: 'hidden',
            }}>
            {/* Shimmer sweep */}
            {showSparkles && (
              <div
                className="idv-shimmer-sweep"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(90deg, transparent 0%, ${whiteRgba(0.3)} 50%, transparent 100%)`,
                  animation: `idv-shimmer 2.5s ${EASING.smooth} infinite`,
                }}
              />
            )}
          </div>
        </div>
      </Sparkles>

      {/* Label */}
      <span
        style={{
          fontSize: FONT_SIZES.sm,
          fontWeight: v.labelWeight,
          color: v.labelColor,
          fontFamily: FONTS.body,
          whiteSpace: 'nowrap',
          transition: `color 0.3s ${EASING.smooth}`,
          textShadow: v.labelShadow,
        }}>
        {v.labelText}
      </span>
    </div>
  );
}

function ProgressEncouragement({answeredCount, maxWidth}: {answeredCount: number; maxWidth?: number}) {
  return (
    <>
      <ProgressBar answeredCount={answeredCount} maxWidth={maxWidth} />
      <span
        style={{
          fontSize: FONT_SIZES.lg,
          color: COLORS.primary,
          fontFamily: FONTS.body,
          textAlign: 'center',
          fontWeight: 500,
          fontStyle: 'italic',
        }}>
        Every response helps calibrate synergy scores.
      </span>
    </>
  );
}

function StatusBanners({session}: {session: UseInDepthVoteSessionReturn}) {
  return (
    <>
      {session.isRateLimited && <VoteStatusBanner type="rate_limited" />}
      {session.lastResult === 'error' && <VoteStatusBanner type="error" />}
    </>
  );
}

function SubmitVoteButton({
  session,
  allAnswered,
  maxWidth,
}: {
  session: UseInDepthVoteSessionReturn;
  allAnswered: boolean;
  maxWidth?: number;
}) {
  if (!allAnswered) return null;
  return (
    <CtaButton
      onClick={session.submit}
      disabled={session.isSubmitting || session.isRateLimited}
      className="idv-submit-btn"
      style={{
        width: '100%',
        maxWidth,
        animation: session.isSubmitting
          ? `idv-submit-glow 1.5s ${EASING.smooth} infinite`
          : `idv-fade-up 0.35s ${EASING.smooth}`,
      }}>
      {session.isSubmitting ? 'Submitting...' : 'Submit your vote'}
    </CtaButton>
  );
}

function SuccessCard({
  formState,
  onBack,
  onVoteMore,
}: {
  formState: InDepthFormState;
  onBack: () => void;
  onVoteMore: () => void;
}) {
  const insight = getResponseInsight(formState);
  const closer = getRandomCloser();

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: RADIUS.card,
        boxShadow: `0 8px 32px ${hexRgba(COLORS.primary500, 0.15)}`,
        padding: '32px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        width: '100%',
        animation: `idv-fade-up 0.4s ${EASING.smooth}`,
      }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: TIER_COLORS.strong.bg,
          border: `2px solid ${TIER_COLORS.strong.color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 13l4 4L19 7"
            stroke={TIER_COLORS.strong.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="24"
            style={{animation: `idv-check-draw 0.5s ${EASING.smooth} 0.2s both`}}
          />
        </svg>
      </div>
      <span style={{fontSize: FONT_SIZES.xxl, fontWeight: 700, color: COLORS.primary, fontFamily: FONTS.body}}>
        Thanks for your feedback!
      </span>
      <span style={{fontSize: FONT_SIZES.base, color: COLORS.text, fontFamily: FONTS.body}}>{insight}</span>
      <span
        style={{
          fontSize: FONT_SIZES.base,
          color: COLORS.textMuted,
          fontFamily: FONTS.body,
          fontStyle: 'italic',
        }}>
        {closer}
      </span>
      <div style={{display: 'flex', gap: 12, marginTop: SPACING.sm}}>
        <CtaButton onClick={onBack}>Back to synergy</CtaButton>
        <CtaButton variant="ghost" onClick={onVoteMore}>
          Vote on more pairs
        </CtaButton>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Page shell + view components
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
  onLogoClick: () => void;
};

function InDepthPageShell({
  isMobile,
  onLogoClick,
  ariaBusy,
  ariaLabel,
  children,
}: PageHeaderProps & {
  ariaBusy?: boolean;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <div style={pageShellOuter}>
      <EtherealBackground isMobile={isMobile} vivid />
      <CompactHeader
        onLogoClick={onLogoClick}
        isMobile={isMobile}
      />
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
        }}
        aria-busy={ariaBusy}
        aria-label={ariaLabel}>
        {children}
      </main>
    </div>
  );
}

function LoadingPairs({
  isMobile,
  pairImageWidth,
  pairCardWidth,
}: {
  isMobile: boolean;
  pairImageWidth: number;
  pairCardWidth: number;
}) {
  const skeletonPair = (
    <div style={{display: 'flex', gap: SPACING.md, justifyContent: isMobile ? 'center' : 'flex-start'}}>
      <CardDetailSkeleton imageWidth={pairImageWidth} textLines={0} width={pairCardWidth} padding={0} />
      <CardDetailSkeleton imageWidth={pairImageWidth} textLines={0} width={pairCardWidth} padding={0} />
    </div>
  );

  if (isMobile) {
    return (
      <>
        {skeletonPair}
        <div style={{width: '100%', maxWidth: 560}}>
          <VoteFormSkeleton rows={6} />
        </div>
      </>
    );
  }
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 60,
        width: '100%',
        maxWidth: 1320,
        alignItems: 'start',
      }}>
      {skeletonPair}
      <VoteFormSkeleton rows={6} />
    </div>
  );
}

function InDepthLoadingView({isMobile, onLogoClick}: PageHeaderProps) {
  const pairImageWidth = isMobile ? 150 : 298;
  const pairCardWidth = isMobile ? 170 : 340;
  return (
    <InDepthPageShell
      isMobile={isMobile}
      onLogoClick={onLogoClick}
      ariaBusy
      ariaLabel="Loading vote pair and form">
      <LoadingPairs isMobile={isMobile} pairImageWidth={pairImageWidth} pairCardWidth={pairCardWidth} />
    </InDepthPageShell>
  );
}

function InDepthErrorView({
  isMobile,
  error,
  onLogoClick,
}: PageHeaderProps & {error: string | null}) {
  return (
    <div style={{minHeight: '100vh', display: 'flex', flexDirection: 'column'}}>
      <CompactHeader
        onLogoClick={onLogoClick}
        isMobile={isMobile}
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
        <span
          style={{fontSize: FONT_SIZES.xl, fontWeight: 700, color: COLORS.text, fontFamily: FONTS.body}}>
          {error ?? 'Pair not found'}
        </span>
        <CtaButton variant="ghost" onClick={onLogoClick}>
          Back to Home
        </CtaButton>
      </div>
    </div>
  );
}

type ActiveViewProps = PageHeaderProps & {
  pair: VotingPair;
  session: UseInDepthVoteSessionReturn;
  onBack: () => void;
  onVoteMore: () => void;
};

function InDepthMobileView({
  pair,
  session,
  onLogoClick,
  onBack,
  onVoteMore,
}: ActiveViewProps) {
  const answeredCount = countAnsweredDimensions(session.formState);
  const allAnswered = answeredCount === TOTAL_DIMENSIONS;
  const isSuccess = session.lastResult === 'success';
  const formProps = getFormProps(session, pair);

  return (
    <InDepthPageShell isMobile onLogoClick={onLogoClick}>
      <div style={{width: '100%', maxWidth: 560}}>
        <BackLink onClick={onBack} label="Back to synergy" style={{marginBottom: SPACING.lg}} />
      </div>
      <PairDisplay pair={pair} selectedScore={null} isMobile showEngineScore />
      {!isSuccess && <ProgressEncouragement answeredCount={answeredCount} maxWidth={560} />}
      <StatusBanners session={session} />
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.xl,
          alignItems: 'center',
        }}>
        {isSuccess ? (
          <SuccessCard formState={session.formState} onBack={onBack} onVoteMore={onVoteMore} />
        ) : (
          <>
            <InDepthVoteForm {...formProps} isMobile animate layout="tabbed" />
            <SubmitVoteButton session={session} allAnswered={allAnswered} />
          </>
        )}
      </div>
    </InDepthPageShell>
  );
}

function InDepthDesktopView({
  pair,
  session,
  onLogoClick,
  onBack,
  onVoteMore,
}: ActiveViewProps) {
  const answeredCount = countAnsweredDimensions(session.formState);
  const allAnswered = answeredCount === TOTAL_DIMENSIONS;
  const isSuccess = session.lastResult === 'success';
  const formProps = getFormProps(session, pair);

  return (
    <InDepthPageShell
      isMobile={false}
      onLogoClick={onLogoClick}>
      <div style={{width: '100%', maxWidth: 1320}}>
        <BackLink onClick={onBack} label="Back to synergy" style={{marginBottom: SPACING.lg}} />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 60,
          width: '100%',
          maxWidth: 1320,
          alignItems: 'start',
        }}>
        <div
          style={{
            position: 'sticky',
            top: LAYOUT.compactHeaderHeight + 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}>
          <PairDisplay pair={pair} selectedScore={null} showEngineScore />
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            alignItems: 'center',
            alignSelf: 'center',
            minWidth: 0,
          }}>
          {!isSuccess && <ProgressEncouragement answeredCount={answeredCount} />}
          <StatusBanners session={session} />
          {isSuccess ? (
            <SuccessCard formState={session.formState} onBack={onBack} onVoteMore={onVoteMore} />
          ) : (
            <>
              <div style={{width: '100%', maxWidth: 560}}>
                <InDepthVoteForm {...formProps} animate layout="tabbed" />
              </div>
              <SubmitVoteButton session={session} allAnswered={allAnswered} maxWidth={560} />
            </>
          )}
        </div>
      </div>
    </InDepthPageShell>
  );
}

// ──────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────

export function InDepthVotePage() {
  const navigate = useNavigate();
  const {cardAId, cardBId} = useParams<{cardAId: string; cardBId: string}>();
  const {isMobile} = useResponsive();
  const {openCardModal} = useCardModal();
  const {pair, isLoading, error} = useSpecificPair(cardAId, cardBId);
  const session = useInDepthVoteSession(pair);

  const goHome = () => navigate('/');
  const onVoteMore = () => navigate('/vote');
  const onBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    if (cardAId) openCardModal(cardAId);
    else navigate('/');
  };

  if (isLoading) {
    return <InDepthLoadingView isMobile={isMobile} onLogoClick={goHome} />;
  }
  if (error || !pair) {
    return <InDepthErrorView isMobile={isMobile} error={error} onLogoClick={goHome} />;
  }
  if (isMobile) {
    return (
      <InDepthMobileView
        isMobile={isMobile}
        pair={pair}
        session={session}
        onLogoClick={goHome}
        onBack={onBack}
        onVoteMore={onVoteMore}
      />
    );
  }
  return (
    <InDepthDesktopView
      isMobile={isMobile}
      pair={pair}
      session={session}
      onLogoClick={goHome}
      onBack={onBack}
      onVoteMore={onVoteMore}
    />
  );
}
