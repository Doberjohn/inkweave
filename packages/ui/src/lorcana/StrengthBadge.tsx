import {FONT_SIZES, RADIUS, SPACING} from '../tokens/theme';
import type {StrengthTier} from '../lib/scoreUtils';

type BadgeSize = 'sm' | 'md' | 'lg';

interface StrengthBadgeProps {
  tier: StrengthTier;
  /** Content to display (typically a label, score, or both) */
  children: React.ReactNode;
  /** sm = card overlays (xs font), md = breakdowns (xs font, lighter weight), lg = modal headers (base font) */
  size?: BadgeSize;
  /** data-testid for testing */
  testId?: string;
  /** HTML title attribute for tooltips */
  title?: string;
}

// The md badge's top and bottom padding: a hairline, under the spacing scale's first step
// (SPACING.xxs, 2).
const HAIRLINE = 1;

const SIZE_STYLES: Record<BadgeSize, React.CSSProperties> = {
  sm: {
    padding: `${SPACING.xxs}px ${SPACING.sm}px`,
    fontSize: `${FONT_SIZES.xs}px`,
    fontWeight: 600,
    lineHeight: 1.4,
  },
  md: {
    padding: `${HAIRLINE}px ${SPACING.sm}px`,
    fontSize: `${FONT_SIZES.xs}px`,
    fontWeight: 500,
  },
  lg: {
    padding: `${SPACING.xs}px ${SPACING.sm}px`,
    fontSize: `${FONT_SIZES.base}px`,
    fontWeight: 700,
    minWidth: 28,
    textAlign: 'center' as const,
  },
};

/** Inline badge colored by synergy strength tier. */
export function StrengthBadge({tier, children, size = 'sm', testId, title}: StrengthBadgeProps) {
  return (
    <span
      data-testid={testId}
      title={title}
      style={{
        background: tier.bg,
        color: tier.color,
        borderRadius: `${RADIUS.sm}px`,
        display: 'inline-block',
        ...SIZE_STYLES[size],
      }}>
      {children}
    </span>
  );
}
