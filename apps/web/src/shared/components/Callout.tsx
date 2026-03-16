import {COLORS, FONT_SIZES, SPACING, RADIUS} from '../constants';

interface CalloutProps {
  children: React.ReactNode;
}

/** Accent-bordered callout box for group descriptions and explanatory text. */
export function Callout({children}: CalloutProps) {
  return (
    <div
      style={{
        margin: `${SPACING.sm}px 0 ${SPACING.lg}px`,
        padding: `${SPACING.sm}px ${SPACING.md}px`,
        background: COLORS.calloutBg,
        borderLeft: `3px solid ${COLORS.primary}`,
        borderRadius: `0 ${RADIUS.sm}px ${RADIUS.sm}px 0`,
      }}>
      <p
        style={{
          margin: 0,
          fontSize: `${FONT_SIZES.base}px`,
          color: COLORS.descriptionText,
          lineHeight: 1.5,
        }}>
        {children}
      </p>
    </div>
  );
}
