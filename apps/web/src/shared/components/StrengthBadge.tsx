import {FONT_SIZES, RADIUS} from '../constants';
import type {StrengthTier} from '../../features/synergies/utils/scoreUtils';

type BadgeSize = 'sm' | 'md' | 'lg';

interface StrengthBadgeProps {
  tier: StrengthTier;
  /** Content to display — typically a label, score, or both */
  children: React.ReactNode;
  /** sm = card overlays (xs font), md = breakdowns (xs font, lighter weight), lg = modal headers (base font) */
  size?: BadgeSize;
  /** data-testid for testing */
  testId?: string;
  /** HTML title attribute for tooltips */
  title?: string;
}

const SIZE_STYLES: Record<BadgeSize, React.CSSProperties> = {
  sm: {
    padding: '2px 7px',
    fontSize: `${FONT_SIZES.xs}px`,
    fontWeight: 600,
    lineHeight: 1.4,
  },
  md: {
    padding: '1px 6px',
    fontSize: `${FONT_SIZES.xs}px`,
    fontWeight: 500,
  },
  lg: {
    padding: '3px 8px',
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
