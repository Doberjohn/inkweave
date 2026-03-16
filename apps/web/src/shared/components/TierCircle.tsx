import {FONT_SIZES} from '../constants';
import type {StrengthTier} from '../../features/synergies/utils/scoreUtils';

type CircleSize = 'sm' | 'md';

interface TierCircleProps {
  tier: StrengthTier;
  /** Value to display inside the circle */
  children: React.ReactNode;
  /** sm = 22px (CardDetailPanel rows), md = 28px (SynergyBreakdown sidebar) */
  size?: CircleSize;
}

const CIRCLE_SIZES: Record<CircleSize, {px: number; fontSize: string}> = {
  sm: {px: 22, fontSize: `${FONT_SIZES.xs}px`},
  md: {px: 28, fontSize: `${FONT_SIZES.sm}px`},
};

/** Small circular badge showing a count, colored by strength tier. */
export function TierCircle({tier, children, size = 'md'}: TierCircleProps) {
  const {px, fontSize} = CIRCLE_SIZES[size];

  return (
    <div
      style={{
        width: px,
        height: px,
        borderRadius: '50%',
        background: tier.bg,
        color: tier.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 700,
        flexShrink: 0,
      }}>
      {children}
    </div>
  );
}
