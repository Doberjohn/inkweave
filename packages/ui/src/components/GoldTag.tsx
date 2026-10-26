import {CAP_LABEL_XS, COLORS, GOLD_GLOW, RADIUS, SPACING} from '../tokens/theme';

interface GoldTagProps {
  children: React.ReactNode;
  /** Merged last, for the caller's own spacing. */
  style?: React.CSSProperties;
}

/**
 * A small uppercase gold label, composed from the CAP_LABEL and GOLD_GLOW consts so it tracks the
 * one-gold ruling (#511). One source for the BETA chip and the release notes' Highlight tag: a
 * label, never a control.
 */
export function GoldTag({children, style}: GoldTagProps) {
  return (
    <span
      style={{
        ...CAP_LABEL_XS,
        color: COLORS.primary,
        background: GOLD_GLOW.activeBg,
        border: `1px solid ${GOLD_GLOW.activeBorder}`,
        borderRadius: RADIUS.sm,
        padding: `${SPACING.xxs}px ${SPACING.sm}px`,
        lineHeight: 1,
        ...style,
      }}>
      {children}
    </span>
  );
}
