import {useState, useEffect, useId} from 'react';
import {COLORS, EASING, FONT_SIZES, FONTS, RADIUS, SPACING} from '../../../shared/constants';
import {useResponsive} from '../../../shared/hooks';
import type {AccuracyDistribution} from '../../../shared/lib/supabase';
import type {QuickVoteError, QuickVoteState, Accuracy} from '../hooks/useQuickVote';
import {DistributionBar} from './DistributionBar';
import {VoteAffirmation} from './VoteAffirmation';

interface QuickVoteControlProps {
  state: QuickVoteState;
  onVote: (accuracy: Accuracy) => void;
  distribution: AccuracyDistribution | null;
  userChoice: Accuracy | null;
  error: QuickVoteError;
  /** Engine score being rated — used in the prompt copy ("How accurate is Inkweave's score of N?"). */
  engineScore?: number;
}

// Short labels matching mockup phase 2 — paired with the directional vote-icon (↓ ✓ ↑) for clarity.
const CHOICE_LABELS: Record<Accuracy, string> = {
  [-1]: 'Lower',
  [0]: 'Fair',
  [1]: 'Higher',
};

// Mockup phase 2 — tier colors visible AT REST so the vote buttons mirror the dist bar segments above.
// `restBorder`/`restBg` are at-rest; `hoverBorder`/`hoverBg` amplify on hover; `glow` is the post-vote select aura.
const CHOICE_COLORS: Record<
  Accuracy,
  {border: string; glow: string; restBg: string; restBorder: string; hoverBg: string; hoverBorder: string}
> = {
  [-1]: {
    border: '#f59090',
    glow: 'rgba(245, 144, 144, 0.15)',
    restBg: 'rgba(245, 144, 144, 0.05)',
    restBorder: 'rgba(245, 144, 144, 0.25)',
    hoverBg: 'rgba(245, 144, 144, 0.12)',
    hoverBorder: 'rgba(245, 144, 144, 0.55)',
  },
  [0]: {
    border: '#6ee7a0',
    glow: 'rgba(110, 231, 160, 0.15)',
    restBg: 'rgba(110, 231, 160, 0.05)',
    restBorder: 'rgba(110, 231, 160, 0.25)',
    hoverBg: 'rgba(110, 231, 160, 0.12)',
    hoverBorder: 'rgba(110, 231, 160, 0.55)',
  },
  [1]: {
    border: '#60b5f5',
    glow: 'rgba(96, 181, 245, 0.15)',
    restBg: 'rgba(96, 181, 245, 0.05)',
    restBorder: 'rgba(96, 181, 245, 0.25)',
    hoverBg: 'rgba(96, 181, 245, 0.12)',
    hoverBorder: 'rgba(96, 181, 245, 0.55)',
  },
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
    // Mockup phase 2 — vote-icon visible at rest (0.85), full opacity on hover/select.
    iconOpacity: isSelected || isHovered ? 1 : 0.85,
  };
}

interface VoteButtonStyleInput extends VoteButtonState {
  colors: typeof CHOICE_COLORS[Accuracy];
  disabled: boolean;
  index: number;
}

type VoteButtonColors = typeof CHOICE_COLORS[Accuracy];

function getVoteButtonBorder(isSelected: boolean, isHovered: boolean, colors: VoteButtonColors): string {
  if (isSelected) return `1px solid ${colors.border}`;
  if (isHovered) return `1px solid ${colors.hoverBorder}`;
  // Mockup phase 2 — tier-tinted at-rest border so the buttons mirror the dist bar segments.
  return `1px solid ${colors.restBorder}`;
}

function getVoteButtonStyle({isSelected, isDimmed, isHovered, isPressed, colors, disabled, index}: VoteButtonStyleInput): React.CSSProperties {
  // At-rest fill is the tier's faint tint (mockup phase 2). Hover amplifies it; selected pulls
  // toward the post-vote brighter tint with the glow ring.
  const background = isSelected || isHovered ? colors.hoverBg : colors.restBg;
  return {
    ...BASE_BUTTON_STYLE,
    background,
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

// ── Prompt branch (single render path for all non-hidden states) ──

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
  /** Engine score being rated (used in the prompt copy). */
  engineScore?: number;
  /** Pre-vote distribution data (mockup phase 2 shows it above the prompt with a dashed divider). */
  distribution: AccuracyDistribution | null;
}

/**
 * Two render paths:
 * - ready / submitting / error: dist + dashed divider + prompt + 3 buttons (+ optional error banner).
 * - result: dist + gold VoteAffirmation tile (no divider, no prompt, no buttons). The disabled-buttons
 *   pattern after voting was a dead-end UX — affirmation replaces it with closure on the user's vote.
 */
function QuickVotePrompt({state, onVote, userChoice, error, isMobile, questionId, engineScore, distribution}: QuickVotePromptProps) {
  const isError = state === 'error';
  const isSubmitting = state === 'submitting';
  const isResult = state === 'result';
  // Disable buttons when the network is in flight, when the user has already voted, or when rate-limited.
  const buttonsDisabled = isSubmitting || isResult || (isError && error === 'rate_limited');
  const hasDistribution = distribution && distribution.total > 0;
  const promptCopy =
    engineScore !== undefined
      ? `How accurate is Inkweave's score of ${engineScore}?`
      : 'Do you agree with this score?';

  return (
    <div
      key="qv-prompt"
      style={{
        ...CONTAINER_STYLE,
        // When the dist bar is shown above the prompt, give the block more breathing room
        // (mockup phase 2 `.vote-section.combined-vote { gap: 14px }`).
        gap: hasDistribution ? SPACING.section : SPACING.sm,
        animation: 'qv-fade-up 0.35s ease-out',
      }}>
      {hasDistribution && (
        <>
          <DistributionBar
            lower={distribution.lower}
            right={distribution.right}
            higher={distribution.higher}
            animate={false}
            contextLabel="How the community rates Inkweave's score"
          />
          {!isResult && (
            <hr
              aria-hidden="true"
              style={{
                border: 'none',
                borderTop: `1px dashed rgba(212, 175, 55, 0.18)`,
                margin: 0,
              }}
            />
          )}
        </>
      )}
      {isResult ? (
        <VoteAffirmation
          accentColor={COLORS.primary500}
          title="Thanks for your quick vote"
          detail={userChoice != null ? `You picked: ${CHOICE_LABELS[userChoice]}` : undefined}
        />
      ) : (
        <>
          <p id={questionId} style={{...QUESTION_STYLE, fontWeight: 600, color: COLORS.text, animation: 'qv-fade-in 0.3s ease-out'}}>
            {promptCopy}
          </p>
          <VoteButtons
            disabled={buttonsDisabled}
            submitting={isSubmitting}
            selectedChoice={userChoice}
            onVote={onVote}
            isMobile={isMobile}
            questionId={questionId}
          />
          {isError && <PromptError error={error} />}
        </>
      )}
    </div>
  );
}

// ── Main component ──

export function QuickVoteControl({state, onVote, distribution, userChoice, error, engineScore}: QuickVoteControlProps) {
  const {isMobile} = useResponsive();
  const questionId = useId();

  useEffect(() => { ensureKeyframes(); }, []);

  if (state === 'hidden') return null;

  // QuickVotePrompt handles the result-vs-active branch internally — see its docstring.
  return (
    <QuickVotePrompt
      state={state}
      onVote={onVote}
      userChoice={userChoice}
      error={error}
      isMobile={isMobile}
      questionId={questionId}
      engineScore={engineScore}
      distribution={distribution}
    />
  );
}
