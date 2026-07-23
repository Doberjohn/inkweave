import {CAP_LABEL_XS, COLORS, GOLD_GLOW, RADIUS} from '../constants';

/**
 * The BETA chip (#511): previously duplicated character-for-character between
 * the deck ScoreGauge and HealthSummary — one source, composed from the
 * CAP_LABEL and GOLD_GLOW consts so it tracks the one-gold ruling.
 */
export function BetaTag({style}: {style?: React.CSSProperties}) {
  return (
    <span
      style={{
        ...CAP_LABEL_XS,
        color: COLORS.primary,
        background: GOLD_GLOW.activeBg,
        border: `1px solid ${GOLD_GLOW.activeBorder}`,
        borderRadius: RADIUS.sm,
        padding: '2px 6px',
        lineHeight: 1,
        ...style,
      }}>
      Beta
    </span>
  );
}
