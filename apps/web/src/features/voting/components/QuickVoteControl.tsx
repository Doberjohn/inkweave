import {useState, useEffect, useId} from 'react';
import {COLORS, EASING, FONT_SIZES, FONTS, RADIUS, SPACING} from '../../../shared/constants';
import {useResponsive} from '../../../shared/hooks';
import {Sparkles} from '../../../shared/components/Sparkles';
import {CtaButton} from '../../../shared/components/CtaButton';
import type {AccuracyDistribution} from '../../../shared/lib/supabase';
import type {QuickVoteError, QuickVoteState, Accuracy} from '../hooks/useQuickVote';
import {DistributionBar} from './DistributionBar';

interface QuickVoteControlProps {
  state: QuickVoteState;
  onVote: (accuracy: Accuracy) => void;
  distribution: AccuracyDistribution | null;
  distributionFailed?: boolean;
  userChoice: Accuracy | null;
  error: QuickVoteError;
  /** Optional callback for "Rate in detail" link in the thank-you state */
  onRateInDetail?: () => void;
}

const CHOICE_LABELS: Record<Accuracy, string> = {
  [-1]: 'Should be lower',
  [0]: 'Score is fair',
  [1]: 'Should be higher',
};

const CHOICE_COLORS: Record<Accuracy, {border: string; glow: string; hintBg: string; hoverBorder: string}> = {
  [-1]: {border: '#f59090', glow: 'rgba(245, 144, 144, 0.15)', hintBg: 'rgba(245, 144, 144, 0.05)', hoverBorder: 'rgba(245, 144, 144, 0.35)'},
  [0]: {border: '#6ee7a0', glow: 'rgba(110, 231, 160, 0.15)', hintBg: 'rgba(110, 231, 160, 0.05)', hoverBorder: 'rgba(110, 231, 160, 0.35)'},
  [1]: {border: '#60b5f5', glow: 'rgba(96, 181, 245, 0.15)', hintBg: 'rgba(96, 181, 245, 0.05)', hoverBorder: 'rgba(96, 181, 245, 0.35)'},
};

const VOTES = [-1, 0, 1] as const;

const CONTAINER_STYLE: React.CSSProperties = {
  background: 'rgba(212, 175, 55, 0.06)',
  border: '1px solid rgba(212, 175, 55, 0.18)',
  borderRadius: 10,
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.sm,
  fontFamily: FONTS.body,
};

const QUESTION_STYLE: React.CSSProperties = {
  fontSize: `${FONT_SIZES.base}px`,
  color: COLORS.textMuted,
  margin: 0,
};

const BASE_BUTTON_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: RADIUS.lg,
  minHeight: 44,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: `${FONT_SIZES.base}px`,
  color: COLORS.text,
  padding: `${SPACING.xs}px ${SPACING.md}px`,
  transition: `all 0.25s ${EASING.snappy}`,
  flex: 1,
};

const CHOICE_ICONS: Record<Accuracy, string> = {
  [-1]: '↓',
  [0]: '✓',
  [1]: '↑',
};

const KEYFRAMES = `
@keyframes qv-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes qv-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes qv-pulse-glow {
  0%, 100% { text-shadow: 0 0 4px rgba(110, 231, 160, 0.2); }
  50% { text-shadow: 0 0 12px rgba(110, 231, 160, 0.5); }
}
.qv-vote-btn:focus-visible {
  outline: 2px solid rgba(212, 175, 55, 0.6);
  outline-offset: 2px;
}
`;

/** Injects keyframes once into the document head (ID-based, resilient to DOM cleanup in tests). */
function ensureKeyframes() {
  const STYLE_ID = 'qv-keyframes';
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
}

// ── VoteButtons + style helpers ──

interface VoteButtonState {
  isSelected: boolean;
  isDimmed: boolean;
  isHovered: boolean;
  isPressed: boolean;
  iconOpacity: number;
}

interface VoteButtonStateInput {
  vote: Accuracy;
  hoveredVote: Accuracy | null;
  pressedVote: Accuracy | null;
  selectedChoice: Accuracy | null;
  submitting: boolean;
  disabled: boolean;
}

function getVoteButtonState({vote, hoveredVote, pressedVote, selectedChoice, submitting, disabled}: VoteButtonStateInput): VoteButtonState {
  const isSelected = submitting && selectedChoice === vote;
  const isDimmed = submitting && selectedChoice !== vote;
  const isHovered = hoveredVote === vote && !disabled && !submitting;
  const isPressed = pressedVote === vote;
  return {
    isSelected,
    isDimmed,
    isHovered,
    isPressed,
    iconOpacity: isSelected || isHovered ? 1 : 0.4,
  };
}

interface VoteButtonStyleInput extends VoteButtonState {
  colors: typeof CHOICE_COLORS[Accuracy];
  disabled: boolean;
  index: number;
}

type VoteButtonColors = typeof CHOICE_COLORS[Accuracy];

function getVoteButtonBorder(isSelected: boolean, isHovered: boolean, colors: VoteButtonColors): string | undefined {
  if (isSelected) return `1px solid ${colors.border}`;
  if (isHovered) return `1px solid ${colors.hoverBorder}`;
  return BASE_BUTTON_STYLE.border;
}

function getVoteButtonStyle({isSelected, isDimmed, isHovered, isPressed, colors, disabled, index}: VoteButtonStyleInput): React.CSSProperties {
  return {
    ...BASE_BUTTON_STYLE,
    background: isSelected || isHovered ? colors.hintBg : BASE_BUTTON_STYLE.background,
    opacity: isDimmed ? 0.3 : 1,
    transform: isSelected ? 'scale(1.05)' : isPressed ? 'scale(0.97)' : undefined,
    border: getVoteButtonBorder(isSelected, isHovered, colors),
    boxShadow: isSelected ? `0 0 16px ${colors.glow}` : undefined,
    cursor: disabled ? 'not-allowed' : 'pointer',
    animation: `qv-fade-up 0.3s ease-out ${index * 80}ms both`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  };
}

interface VoteButtonsProps {
  disabled: boolean;
  submitting: boolean;
  selectedChoice: Accuracy | null;
  onVote: (accuracy: Accuracy) => void;
  isMobile: boolean;
  questionId: string;
}

function VoteButtons({disabled, submitting, selectedChoice, onVote, isMobile, questionId}: VoteButtonsProps) {
  const [hoveredVote, setHoveredVote] = useState<Accuracy | null>(null);
  const [pressedVote, setPressedVote] = useState<Accuracy | null>(null);

  return (
    <div
      role="group"
      aria-labelledby={questionId}
      style={{display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: SPACING.sm}}>
      {VOTES.map((vote, i) => {
        const visualState = getVoteButtonState({vote, hoveredVote, pressedVote, selectedChoice, submitting, disabled});
        const colors = CHOICE_COLORS[vote];
        return (
          <button
            key={vote}
            type="button"
            className="qv-vote-btn"
            disabled={disabled}
            onClick={() => onVote(vote)}
            onMouseEnter={() => setHoveredVote(vote)}
            onMouseLeave={() => { setHoveredVote(null); setPressedVote(null); }}
            onMouseDown={() => setPressedVote(vote)}
            onMouseUp={() => setPressedVote(null)}
            style={getVoteButtonStyle({...visualState, colors, disabled, index: i})}>
            <span style={{color: colors.border, opacity: visualState.iconOpacity, transition: 'opacity 0.2s'}} aria-hidden="true">
              {CHOICE_ICONS[vote]}
            </span>
            {CHOICE_LABELS[vote]}
          </button>
        );
      })}
    </div>
  );
}

// ── Result branch (submitting/result state) ──

function FirstVoterCallout() {
  return (
    <span style={{flexShrink: 0}}>
      <Sparkles color="#6ee7a0" minSize={3} maxSize={8} rate={300}>
        <span style={{fontSize: `${FONT_SIZES.sm}px`, color: '#6ee7a0', fontFamily: FONTS.body, fontWeight: 600, whiteSpace: 'nowrap', animation: 'qv-fade-up 0.4s ease-out 0.1s both, qv-pulse-glow 2s ease-in-out 0.5s infinite'}}>
          First to rate this pair!
        </span>
      </Sparkles>
    </span>
  );
}

function RatingsCount({total}: {total: number}) {
  const text = total === 1 ? '1 rating' : `${total} ratings`;
  return (
    <span style={{fontSize: `${FONT_SIZES.sm}px`, color: COLORS.textMuted, fontFamily: FONTS.body}}>
      {text}
    </span>
  );
}

function ConfirmationCallout({distribution, isFirstVoter}: {distribution: AccuracyDistribution | null; isFirstVoter: boolean}) {
  if (isFirstVoter) return <FirstVoterCallout />;
  if (distribution) return <RatingsCount total={distribution.total} />;
  return null;
}

function StatusMessage({text}: {text: string}) {
  return (
    <p style={{...QUESTION_STYLE, fontSize: `${FONT_SIZES.sm}px`, margin: 0, color: COLORS.textMuted, animation: 'qv-fade-in 0.3s ease-out'}}>
      {text}
    </p>
  );
}

function DistributionContent({distribution, distributionFailed, isFirstVoter}: {
  distribution: AccuracyDistribution | null;
  distributionFailed: boolean;
  isFirstVoter: boolean;
}) {
  if (distribution && !isFirstVoter) {
    return <DistributionBar lower={distribution.lower} right={distribution.right} higher={distribution.higher} animate showLabels={false} />;
  }
  if (distributionFailed) return <StatusMessage text="Community ratings unavailable" />;
  if (!distribution) return <StatusMessage text="Loading community ratings…" />;
  return null;
}

function RateInDetailCta({onClick}: {onClick: () => void}) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.xs, animation: 'qv-fade-up 0.3s ease-out 0.2s both'}}>
      <p style={{...QUESTION_STYLE, fontSize: `${FONT_SIZES.sm}px`, margin: 0, textAlign: 'center'}}>
        Want to help fine-tune this score?
      </p>
      <CtaButton onClick={onClick} style={{width: '100%', minHeight: 40}}>
        Rate this pair in depth &rarr;
      </CtaButton>
    </div>
  );
}

interface QuickVoteResultProps {
  userChoice: Accuracy | null;
  distribution: AccuracyDistribution | null;
  distributionFailed: boolean;
  onRateInDetail?: () => void;
}

function QuickVoteResult({userChoice, distribution, distributionFailed, onRateInDetail}: QuickVoteResultProps) {
  const isFirstVoter = distribution?.total === 1;
  const choiceColor = userChoice !== null ? CHOICE_COLORS[userChoice].border : COLORS.primary;
  const choiceLabel = userChoice !== null ? CHOICE_LABELS[userChoice] : '';

  return (
    <div key="qv-result" style={{...CONTAINER_STYLE, animation: 'qv-fade-in 0.3s ease-out'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'qv-fade-up 0.3s ease-out'}}>
        <p style={{...QUESTION_STYLE, fontSize: `${FONT_SIZES.sm}px`, margin: 0}}>
          Your rating: <span style={{color: choiceColor}}>{choiceLabel}</span>
        </p>
        <ConfirmationCallout distribution={distribution} isFirstVoter={isFirstVoter} />
      </div>
      <DistributionContent distribution={distribution} distributionFailed={distributionFailed} isFirstVoter={isFirstVoter} />
      {onRateInDetail && distribution && <RateInDetailCta onClick={onRateInDetail} />}
    </div>
  );
}

// ── Prompt branch (ready/error state) ──

function PromptError({error}: {error: QuickVoteError}) {
  const text = error === 'rate_limited' ? "You're rating fast! Try again in a bit." : 'Something went wrong, try again';
  return (
    <p
      role="alert"
      style={{
        fontSize: `${FONT_SIZES.sm}px`,
        color: COLORS.error,
        margin: 0,
        padding: `${SPACING.xs}px 0`,
        animation: 'qv-fade-up 0.2s ease-out',
      }}>
      {text}
    </p>
  );
}

interface QuickVotePromptProps {
  state: QuickVoteState;
  onVote: (accuracy: Accuracy) => void;
  userChoice: Accuracy | null;
  error: QuickVoteError;
  isMobile: boolean;
  questionId: string;
}

function QuickVotePrompt({state, onVote, userChoice, error, isMobile, questionId}: QuickVotePromptProps) {
  const isError = state === 'error';
  const buttonsDisabled = isError && error === 'rate_limited';

  return (
    <div key="qv-prompt" style={{...CONTAINER_STYLE, animation: 'qv-fade-up 0.35s ease-out'}}>
      <p id={questionId} style={{...QUESTION_STYLE, fontWeight: 600, color: COLORS.text, animation: 'qv-fade-in 0.3s ease-out'}}>
        Do you agree with this score?
      </p>
      <VoteButtons
        disabled={buttonsDisabled}
        submitting={false}
        selectedChoice={userChoice}
        onVote={onVote}
        isMobile={isMobile}
        questionId={questionId}
      />
      {isError && <PromptError error={error} />}
    </div>
  );
}

// ── Main component ──

export function QuickVoteControl({state, onVote, distribution, distributionFailed, userChoice, error, onRateInDetail}: QuickVoteControlProps) {
  const {isMobile} = useResponsive();
  const questionId = useId();

  useEffect(() => { ensureKeyframes(); }, []);

  if (state === 'hidden') return null;

  if (state === 'submitting' || state === 'result') {
    return (
      <QuickVoteResult
        userChoice={userChoice}
        distribution={distribution}
        distributionFailed={Boolean(distributionFailed)}
        onRateInDetail={onRateInDetail}
      />
    );
  }

  return (
    <QuickVotePrompt
      state={state}
      onVote={onVote}
      userChoice={userChoice}
      error={error}
      isMobile={isMobile}
      questionId={questionId}
    />
  );
}
