import {COLORS, FONT_SIZES, FONTS, RADIUS, SPACING} from '../../../shared/constants';
import {useResponsive} from '../../../shared/hooks';
import type {AccuracyDistribution} from '../../../shared/lib/supabase';
import type {QuickVoteError, QuickVoteState, Accuracy} from '../hooks/useQuickVote';
import {DistributionBar} from './DistributionBar';

interface QuickVoteControlProps {
  state: QuickVoteState;
  onVote: (accuracy: Accuracy) => void;
  distribution: AccuracyDistribution | null;
  userChoice: Accuracy | null;
  error: QuickVoteError;
}

const CHOICE_LABELS: Record<Accuracy, string> = {
  [-1]: 'Should be lower',
  [0]: 'About right',
  [1]: 'Should be higher',
};

const CHOICE_COLORS: Record<Accuracy, {border: string; glow: string}> = {
  [-1]: {border: '#f59090', glow: 'rgba(245, 144, 144, 0.15)'},
  [0]: {border: '#6ee7a0', glow: 'rgba(110, 231, 160, 0.15)'},
  [1]: {border: '#60b5f5', glow: 'rgba(96, 181, 245, 0.15)'},
};

const VOTES = [-1, 0, 1] as const;

const CONTAINER_STYLE: React.CSSProperties = {
  background: 'rgba(212, 175, 55, 0.04)',
  border: '1px solid rgba(212, 175, 55, 0.12)',
  borderRadius: 10,
  padding: '14px 16px',
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
  border: `1px solid ${COLORS.surfaceBorder}`,
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

const TEASER_STYLE: React.CSSProperties = {
  fontSize: `${FONT_SIZES.sm}px`,
  color: COLORS.textDim,
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'not-allowed',
  fontFamily: 'inherit',
  textAlign: 'left',
};

function VoteButtons({
  disabled,
  submitting,
  selectedChoice,
  onVote,
  isMobile,
}: {
  disabled: boolean;
  submitting: boolean;
  selectedChoice: Accuracy | null;
  onVote: (accuracy: Accuracy) => void;
  isMobile: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: SPACING.sm,
      }}>
      {VOTES.map((vote) => {
        const isSelected = submitting && selectedChoice === vote;
        const isDimmed = submitting && selectedChoice !== vote;
        const colors = CHOICE_COLORS[vote];

        return (
          <button
            key={vote}
            type="button"
            disabled={disabled}
            onClick={() => onVote(vote)}
            aria-pressed={isSelected || undefined}
            style={{
              ...BASE_BUTTON_STYLE,
              opacity: isDimmed ? 0.3 : 1,
              transform: isSelected ? 'scale(1.05)' : undefined,
              border: isSelected ? `1px solid ${colors.border}` : BASE_BUTTON_STYLE.border,
              boxShadow: isSelected ? `0 0 16px ${colors.glow}` : undefined,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}>
            {isSelected ? `✓ ${CHOICE_LABELS[vote]}` : CHOICE_LABELS[vote]}
          </button>
        );
      })}
    </div>
  );
}

function TeaserButton() {
  return (
    <button type="button" disabled style={TEASER_STYLE}>
      Rate in detail →
    </button>
  );
}

export function QuickVoteControl({
  state,
  onVote,
  distribution,
  userChoice,
  error,
}: QuickVoteControlProps) {
  const {isMobile} = useResponsive();

  if (state === 'hidden') return null;

  if (state === 'result') {
    const isFirstVoter = distribution?.total === 1;

    return (
      <div style={CONTAINER_STYLE}>
        <p style={{...QUESTION_STYLE, color: COLORS.text, margin: 0}}>
          ✦ Thanks! You voted:{' '}
          <span style={{color: COLORS.primary}}>
            {userChoice !== null ? CHOICE_LABELS[userChoice] : ''}
          </span>
        </p>
        {isFirstVoter ? (
          <p style={{...QUESTION_STYLE, color: '#6ee7a0', margin: 0}}>
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
        ) : (
          <p style={{...QUESTION_STYLE, fontSize: `${FONT_SIZES.sm}px`, margin: 0}}>
            Loading community votes…
          </p>
        )}
        {distribution && (
          <p style={{...QUESTION_STYLE, fontSize: `${FONT_SIZES.sm}px`, margin: 0}}>
            {distribution.total} votes on this pair
          </p>
        )}
        <TeaserButton />
      </div>
    );
  }

  const isSubmitting = state === 'submitting';
  const isError = state === 'error';
  const buttonsDisabled = isSubmitting || (isError && error === 'rate_limited');

  return (
    <div style={CONTAINER_STYLE}>
      <p style={QUESTION_STYLE}>Do you agree with this score?</p>
      <VoteButtons
        disabled={buttonsDisabled}
        submitting={isSubmitting}
        selectedChoice={userChoice}
        onVote={onVote}
        isMobile={isMobile}
      />
      {isError && (
        <p
          role="alert"
          style={{
            fontSize: `${FONT_SIZES.sm}px`,
            color: COLORS.error,
            margin: 0,
            padding: `${SPACING.xs}px 0`,
          }}>
          {error === 'rate_limited'
            ? "You're voting fast! Try again in a bit."
            : 'Something went wrong, try again'}
        </p>
      )}
      <TeaserButton />
    </div>
  );
}
