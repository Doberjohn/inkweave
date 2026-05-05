import {COLORS, FONT_SIZES, FONTS, RADIUS, SPACING} from '../../../shared/constants';
import {CtaButton} from '../../../shared/components/CtaButton';

export type CommunityEmptyVariant = 'full-empty' | 'half-empty';

interface CommunityEmptyStateProps {
  variant: CommunityEmptyVariant;
  /** Total community votes received so far (for the progress label). */
  current: number;
  /** Threshold above which the corresponding state ends. Defaults to 5. */
  threshold?: number;
  onCta: () => void;
}

const COPY: Record<CommunityEmptyVariant, {title: string; descTemplate: (n: number) => string; ctaLabel: string}> = {
  'full-empty': {
    title: 'Not enough votes yet',
    descTemplate: (remaining) =>
      `Need ${remaining} more vote${remaining === 1 ? '' : 's'} before community signal becomes meaningful.`,
    ctaLabel: 'Rate in Detail →',
  },
  'half-empty': {
    title: 'Not enough in-depth votes yet',
    descTemplate: (remaining) =>
      `Need ${remaining} more in-depth vote${remaining === 1 ? '' : 's'} to fill in the community details.`,
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
export function CommunityEmptyState({variant, current, threshold = 5, onCta}: CommunityEmptyStateProps) {
  const remaining = Math.max(threshold - current, 0);
  const {title, descTemplate, ctaLabel} = COPY[variant];
  const progressPct = Math.min((current / threshold) * 100, 100);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${SPACING.sm}px`,
        padding: `${SPACING.lg}px`,
        background: COLORS.surfaceAlt,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: `${RADIUS.lg}px`,
        fontFamily: FONTS.body,
      }}>
      <h4
        style={{
          margin: 0,
          fontSize: `${FONT_SIZES.base}px`,
          fontWeight: 600,
          color: COLORS.text,
        }}>
        {title}
      </h4>
      <p
        style={{
          margin: 0,
          fontSize: `${FONT_SIZES.sm}px`,
          color: COLORS.textMuted,
          lineHeight: 1.4,
        }}>
        {descTemplate(remaining)}
      </p>
      <div
        aria-label={`${current} of ${threshold} votes`}
        style={{display: 'flex', alignItems: 'center', gap: `${SPACING.sm}px`, marginTop: 4}}>
        <div
          style={{
            flex: 1,
            height: 4,
            background: COLORS.surfaceBorder,
            borderRadius: 2,
            overflow: 'hidden',
          }}>
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              background: COLORS.primary,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <span
          style={{
            fontSize: `${FONT_SIZES.xs}px`,
            color: COLORS.textMuted,
            fontWeight: 600,
            minWidth: 28,
            textAlign: 'right',
          }}>
          {current} / {threshold}
        </span>
      </div>
      <CtaButton onClick={onCta} style={{width: '100%', minHeight: 40, marginTop: SPACING.xs}}>
        {ctaLabel}
      </CtaButton>
    </div>
  );
}
