import {useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {CompactHeader, CtaButton, BackLink, LoadingSpinner, EtherealBackground} from '../shared/components';
import {useResponsive} from '../shared/hooks';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {PairDisplay, VoteStatusBanner, InDepthVoteForm} from '../features/voting';
import {useSpecificPair} from '../features/voting/hooks/useSpecificPair';
import {useInDepthVoteSession} from '../features/voting/hooks/useInDepthVoteSession';
import {COLORS, FONTS, FONT_SIZES, LAYOUT, RADIUS, SPACING} from '../shared/constants';

/** Page-level layout — controls how pair and form are arranged */
type PageLayout = 'tabbed' | 'side-by-side' | 'side-by-side-compact';

const PAGE_LAYOUT_OPTIONS: {key: PageLayout; label: string}[] = [
  {key: 'tabbed', label: 'Tabbed'},
  {key: 'side-by-side', label: 'Side-by-side'},
  {key: 'side-by-side-compact', label: 'SbS compact'},
];

/** Inject keyframes once at module load */
(function injectKeyframes() {
  const STYLE_ID = 'indepth-page-keyframes';
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  // idv-fade-up and idv-pulse are injected by OptionPicker — only page-specific keyframes here
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
  `;
  document.head.appendChild(style);
})();

const TOTAL_DIMENSIONS = 6;

// ── Shared sub-components ──

function ProgressBar({answeredCount, maxWidth}: {answeredCount: number; maxWidth?: number}) {
  const pct = (answeredCount / TOTAL_DIMENSIONS) * 100;
  const isComplete = answeredCount === TOTAL_DIMENSIONS;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.sm,
        width: '100%',
        maxWidth,
      }}>
      <div
        role="progressbar"
        aria-valuenow={answeredCount}
        aria-valuemin={0}
        aria-valuemax={TOTAL_DIMENSIONS}
        aria-label={`Voting progress: ${answeredCount} of ${TOTAL_DIMENSIONS} dimensions answered`}
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
        {isComplete ? '\u2713 Complete' : `${answeredCount} / ${TOTAL_DIMENSIONS}`}
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
        animation: 'idv-fade-up 0.4s ease-out',
      }}>
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
        <CtaButton onClick={onBack}>Back to synergy</CtaButton>
        <CtaButton variant="ghost" onClick={onVoteMore}>Vote on more pairs</CtaButton>
      </div>
    </div>
  );
}

function LayoutSwitcher({current, onChange}: {current: PageLayout; onChange: (l: PageLayout) => void}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: '6px 10px',
        background: 'rgba(0,0,0,0.7)',
        borderRadius: RADIUS.lg,
        border: `1px solid ${COLORS.surfaceBorder}`,
        backdropFilter: 'blur(8px)',
      }}>
      <span style={{fontSize: FONT_SIZES.xs, color: COLORS.textDim, fontFamily: FONTS.body, alignSelf: 'center', marginRight: 4}}>Layout:</span>
      {PAGE_LAYOUT_OPTIONS.map(({key, label}) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            fontSize: FONT_SIZES.xs,
            fontFamily: FONTS.body,
            padding: '3px 8px',
            borderRadius: RADIUS.md,
            border: current === key ? `1px solid ${COLORS.primary}` : '1px solid transparent',
            background: current === key ? 'rgba(255,185,0,0.12)' : 'transparent',
            color: current === key ? COLORS.primary : COLORS.textMuted,
            fontWeight: current === key ? 700 : 500,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Submit button (shared across layouts) ──

function SubmitButton({hasAnyAnswer, allAnswered, isSubmitting, isRateLimited, onSubmit}: {
  hasAnyAnswer: boolean; allAnswered: boolean; isSubmitting: boolean; isRateLimited: boolean; onSubmit: () => void;
}) {
  return (
    <CtaButton
      onClick={onSubmit}
      disabled={!hasAnyAnswer || isSubmitting || isRateLimited}
      style={{
        width: '100%',
        opacity: hasAnyAnswer ? 1 : 0.5,
        boxShadow: hasAnyAnswer ? '0 0 12px rgba(255,185,0,0.15)' : 'none',
        animation: isSubmitting ? 'idv-submit-glow 1.5s ease-in-out infinite' : undefined,
        transition: 'opacity 0.3s ease, box-shadow 0.3s ease',
      }}>
      {isSubmitting ? 'Submitting...' : allAnswered ? 'Submit All 6 Votes' : 'Submit Votes'}
    </CtaButton>
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
  const [pageLayout, setPageLayout] = useState<PageLayout>('tabbed');

  const isSideBySide = pageLayout === 'side-by-side' || pageLayout === 'side-by-side-compact';
  const useMobileCards = pageLayout === 'side-by-side-compact' || isMobile;

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

  const submitProps = {
    hasAnyAnswer: session.hasAnyAnswer,
    allAnswered,
    isSubmitting: session.isSubmitting,
    isRateLimited: session.isRateLimited,
    onSubmit: session.submit,
  };

  // Status banners (shared)
  const statusBanners = (
    <>
      {session.isRateLimited && <VoteStatusBanner type="rate_limited" />}
      {session.lastResult === 'error' && <VoteStatusBanner type="error" />}
    </>
  );

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
          padding: isMobile ? '16px 16px 120px' : '16px 24px 60px',
          gap: 16,
          position: 'relative',
          zIndex: 1,
        }}>

        {/* Top bar: back link + layout switcher */}
        <div style={{width: '100%', maxWidth: isSideBySide ? 1300 : 560, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
          <BackLink onClick={handleBack} label="Back to synergy" />
          <LayoutSwitcher current={pageLayout} onChange={setPageLayout} />
        </div>

        {/* Success state */}
        {session.lastResult === 'success' ? (
          <SuccessCard answeredCount={answeredCount} onBack={handleBack} onVoteMore={() => navigate('/vote')} />
        ) : isSideBySide ? (
          /* ══ Side-by-side layout ══ */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: SPACING.xxl,
              width: '100%',
              maxWidth: pageLayout === 'side-by-side' ? 1300 : 960,
              alignItems: 'start',
            }}>
            {/* Left column: pair + synergy descriptions */}
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
                selectedScore={session.formState.score}
                isMobile={useMobileCards}
              />
            </div>

            {/* Right column: progress + form + submit */}
            <div style={{display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0}}>
              <ProgressBar answeredCount={answeredCount} />

              <span style={{fontSize: FONT_SIZES.base, color: COLORS.textMuted, fontFamily: FONTS.body}}>
                Answer any or all — every response helps calibrate synergy scores.
              </span>

              {statusBanners}

              <InDepthVoteForm
                {...formProps}
                isMobile={isMobile}
                animate
                layout="tabbed"
                compact={useMobileCards}
              />

              <SubmitButton {...submitProps} />
            </div>
          </div>
        ) : (
          /* ══ Tabbed single-column layout ══ */
          <>
            <PairDisplay
              pair={pair}
              selectedScore={session.formState.score}
              isMobile={isMobile}
            />

            <ProgressBar answeredCount={answeredCount} maxWidth={560} />

            <span style={{fontSize: FONT_SIZES.base, color: COLORS.textMuted, fontFamily: FONTS.body, textAlign: 'center'}}>
              Answer any or all — every response helps calibrate synergy scores.
            </span>

            {statusBanners}

            <div style={{width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: SPACING.xl, alignItems: 'center'}}>
              <InDepthVoteForm
                {...formProps}
                isMobile={isMobile}
                animate
                layout="tabbed"
              />
              <SubmitButton {...submitProps} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
