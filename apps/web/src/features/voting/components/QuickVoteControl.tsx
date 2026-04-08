import {useState, useEffect, useId} from 'react';
import {COLORS, FONT_SIZES, FONTS, RADIUS, SPACING} from '../../../shared/constants';
import {useResponsive} from '../../../shared/hooks';
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
}

const CHOICE_LABELS: Record<Accuracy, string> = {
  [-1]: 'Should be lower',
  [0]: 'About right',
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
  transition: 'all 0.2s',
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

function VoteButtons({
  disabled,
  submitting,
  selectedChoice,
  onVote,
  isMobile,
  questionId,
}: {
  disabled: boolean;
  submitting: boolean;
  selectedChoice: Accuracy | null;
  onVote: (accuracy: Accuracy) => void;
  isMobile: boolean;
  questionId: string;
}) {
  const [hoveredVote, setHoveredVote] = useState<Accuracy | null>(null);
  const [pressedVote, setPressedVote] = useState<Accuracy | null>(null);

  return (
    <div
      role="group"
      aria-labelledby={questionId}
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: SPACING.sm,
      }}>
      {VOTES.map((vote, i) => {
        const isSelected = submitting && selectedChoice === vote;
        const isDimmed = submitting && selectedChoice !== vote;
        const isHovered = hoveredVote === vote && !disabled && !submitting;
        const isPressed = pressedVote === vote;
        const colors = CHOICE_COLORS[vote];

        const iconOpacity = isSelected || isHovered ? 1 : 0.4;

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
            style={{
              ...BASE_BUTTON_STYLE,
              background: isSelected || isHovered ? colors.hintBg : BASE_BUTTON_STYLE.background,
              opacity: isDimmed ? 0.3 : 1,
              transform: isSelected ? 'scale(1.05)' : isPressed ? 'scale(0.97)' : undefined,
              border: isSelected
                ? `1px solid ${colors.border}`
                : isHovered
                  ? `1px solid ${colors.hoverBorder}`
                  : BASE_BUTTON_STYLE.border,
              boxShadow: isSelected ? `0 0 16px ${colors.glow}` : undefined,
              cursor: disabled ? 'not-allowed' : 'pointer',
              animation: `qv-fade-up 0.3s ease-out ${i * 80}ms both`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}>
            <span style={{color: colors.border, opacity: iconOpacity, transition: 'opacity 0.2s'}} aria-hidden="true">
              {CHOICE_ICONS[vote]}
            </span>
            {CHOICE_LABELS[vote]}
          </button>
        );
      })}
    </div>
  );
}



export function QuickVoteControl({
  state,
  onVote,
  distribution,
  distributionFailed,
  userChoice,
  error,
}: QuickVoteControlProps) {
  const {isMobile} = useResponsive();
  const questionId = useId();

  useEffect(() => { ensureKeyframes(); }, []);

  if (state === 'hidden') return null;

  // Show confirmation immediately on submit (optimistic) and on result
  if (state === 'submitting' || state === 'result') {
    const isFirstVoter = distribution?.total === 1;

    return (
      <div key="qv-result" style={{...CONTAINER_STYLE, animation: 'qv-fade-in 0.3s ease-out'}}>
        <p style={{...QUESTION_STYLE, color: COLORS.text, margin: 0, animation: 'qv-fade-up 0.3s ease-out'}}>
          ✦ Thanks! You voted:{' '}
          <span style={{color: COLORS.primary}}>
            {userChoice !== null ? CHOICE_LABELS[userChoice] : ''}
          </span>
        </p>
        {isFirstVoter ? (
          <p style={{...QUESTION_STYLE, color: '#6ee7a0', margin: 0, animation: 'qv-fade-up 0.4s ease-out 0.1s both, qv-pulse-glow 2s ease-in-out 0.5s infinite'}}>
            <span aria-hidden="true">✦ </span>
            <span>First to rate this pair!</span>
          </p>
        ) : distribution ? (
          <DistributionBar
            lower={distribution.lower}
            right={distribution.right}
            higher={distribution.higher}
            animate
            showLabels={false}
          />
        ) : distributionFailed ? (
          <p style={{...QUESTION_STYLE, fontSize: `${FONT_SIZES.sm}px`, margin: 0, color: COLORS.textMuted, animation: 'qv-fade-in 0.3s ease-out'}}>
            Community votes unavailable
          </p>
        ) : (
          <p style={{...QUESTION_STYLE, fontSize: `${FONT_SIZES.sm}px`, margin: 0, animation: 'qv-fade-in 0.3s ease-out'}}>
            Loading community votes…
          </p>
        )}
        {distribution && !isFirstVoter && (
          <p style={{...QUESTION_STYLE, fontSize: `${FONT_SIZES.sm}px`, margin: 0, animation: 'qv-fade-up 0.3s ease-out 0.2s both'}}>
            {distribution.total === 1 ? '1 vote' : `${distribution.total} votes`} on this pair
          </p>
        )}
      </div>
    );
  }

  const isError = state === 'error';
  const buttonsDisabled = isError && error === 'rate_limited';

  return (
    <div key="qv-prompt" style={{...CONTAINER_STYLE, animation: 'qv-fade-up 0.35s ease-out'}}>
      <p id={questionId} style={{...QUESTION_STYLE, fontWeight: 600, color: COLORS.text, animation: 'qv-fade-in 0.3s ease-out'}}>Do you agree with this score?</p>
      <VoteButtons
        disabled={buttonsDisabled}
        submitting={false}
        selectedChoice={userChoice}
        onVote={onVote}
        isMobile={isMobile}
        questionId={questionId}
      />
      {isError && (
        <p
          role="alert"
          style={{
            fontSize: `${FONT_SIZES.sm}px`,
            color: COLORS.error,
            margin: 0,
            padding: `${SPACING.xs}px 0`,
            animation: 'qv-fade-up 0.2s ease-out',
          }}>
          {error === 'rate_limited'
            ? "You're voting fast! Try again in a bit."
            : 'Something went wrong, try again'}
        </p>
      )}
    </div>
  );
}
