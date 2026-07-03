import type {ReactNode} from 'react';
import {COLORS, FONT_SIZES, FONTS, RADIUS} from '../../../shared/constants';
import {CtaButton} from '../../../shared/components/CtaButton';
import {VoteAffirmation} from '../../voting/components';

// Amethyst is the community-column accent across the modal. Both the progress fill
// and the CTA below carry that brand identity (gold reads as engine-side).
const COMMUNITY_TINT = '#b691ff';
const COMMUNITY_TINT_DARK = '#9b7dd6';

export type CommunityEmptyVariant = 'full-empty' | 'half-empty';

interface CommunityEmptyStateProps {
  variant: CommunityEmptyVariant;
  /** Total community votes received so far (for the progress label). */
  current: number;
  /** Threshold above which the corresponding state ends. Defaults to 1. */
  threshold?: number;
  onCta: () => void;
  /** When true, replace the CTA with an affirmation tile — user has already in-depth-voted from this browser. */
  userAlreadyVoted?: boolean;
}

const COPY: Record<CommunityEmptyVariant, {title: string; renderDesc: (n: number) => ReactNode; ctaLabel: string}> = {
  'full-empty': {
    title: 'Not enough votes yet',
    renderDesc: (remaining) => (
      <>
        Need <strong style={{color: COMMUNITY_TINT}}>{remaining} more</strong> vote
        {remaining === 1 ? '' : 's'} before community signal becomes meaningful.
      </>
    ),
    ctaLabel: 'Rate in Detail →',
  },
  'half-empty': {
    title: 'Not enough in-depth votes yet',
    renderDesc: (remaining) => (
      <>
        Need <strong style={{color: COMMUNITY_TINT}}>{remaining} more</strong> in-depth vote
        {remaining === 1 ? '' : 's'} to fill in the community details.
      </>
    ),
    ctaLabel: 'Help fill in the details →',
  },
};

/**
 * Empty state card for the right column when community data is sparse.
 *
 * `full-empty`: total_votes < threshold — replaces all community content (score, dist, metrics).
 * `half-empty`: total_votes ≥ threshold but score_votes < threshold — replaces only the metric rows;
 *   parent still renders the dist bar above.
 */
export function CommunityEmptyState({variant, current, threshold = 1, onCta, userAlreadyVoted = false}: CommunityEmptyStateProps) {
  const remaining = Math.max(threshold - current, 0);
  const {title, renderDesc, ctaLabel} = COPY[variant];
  const progressPct = Math.min((current / threshold) * 100, 100);

  return (
    <div
      style={{
        // 1:1 with mockup phase 3 `.empty-state`: vertical+horizontal center, dashed border,
        // 24/20 padding, 12 gap, surface-alt bg.
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 12,
        padding: '24px 20px',
        // Faint amethyst wash over the modal bg, mirroring the QuickVotePrompt's
        // gold wash pattern (rgba 0.06). Same darkness as before, but the column-accent
        // hue replaces the cool surfaceAlt blue so the two empty/active panels read as
        // a visually consistent pair.
        background: 'rgba(182, 145, 255, 0.06)',
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: `${RADIUS.lg}px`,
        textAlign: 'center',
        fontFamily: FONTS.body,
      }}>
      <h4
        style={{
          margin: 0,
          fontSize: `${FONT_SIZES.base}px`,
          fontWeight: 700,
          letterSpacing: '0.02em',
          color: COLORS.text,
        }}>
        {title}
      </h4>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          lineHeight: 1.5,
          color: COLORS.descriptionText,
        }}>
        {renderDesc(remaining)}
      </p>
      <div
        aria-label={`${current} of ${threshold} votes`}
        style={{display: 'flex', alignItems: 'center', gap: 10, marginTop: 4}}>
        <div
          style={{
            flex: 1,
            height: 6,
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 3,
            overflow: 'hidden',
          }}>
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              background: COMMUNITY_TINT,
              transition: 'width 0.4s ease-out',
            }}
          />
        </div>
        <span
          style={{
            fontSize: 11,
            color: COLORS.textMuted,
            fontWeight: 600,
            letterSpacing: '0.04em',
            minWidth: 28,
            textAlign: 'right',
            flexShrink: 0,
          }}>
          {current} / {threshold}
        </span>
      </div>
      {userAlreadyVoted ? (
        <div style={{marginTop: 6}}>
          <VoteAffirmation
            accentColor={COMMUNITY_TINT}
            title="Thanks for rating this in depth"
            detail="Early voter — you're helping Inkweave grow!"
          />
        </div>
      ) : (
        <CtaButton
          onClick={onCta}
          style={{
            width: '100%',
            minHeight: 40,
            marginTop: 6,
            // Override the default gold gradient — the community CTA should read as community brand,
            // not engine. Dark text remains legible on the amethyst gradient.
            background: `linear-gradient(180deg, ${COMMUNITY_TINT} 0%, ${COMMUNITY_TINT_DARK} 100%)`,
            color: COLORS.background,
            boxShadow: `0 4px 12px rgba(182, 145, 255, 0.3)`,
          }}>
          {ctaLabel}
        </CtaButton>
      )}
    </div>
  );
}
