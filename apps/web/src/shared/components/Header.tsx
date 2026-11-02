import {APP_NAME, COLORS, FONT_SIZES, LAYOUT, SPACING, FONT_WEIGHT, LETTER_SPACING} from '../constants';

export function Header() {
  return (
    <header
      style={{
        background: `linear-gradient(135deg, ${COLORS.headerGradientStart} 0%, ${COLORS.headerGradientEnd} 100%)`,
        borderBottom: `1px solid ${COLORS.surfaceBorder}`,
        padding: `${SPACING.xl}px ${SPACING.xxl}px`,
        display: 'flex',
        alignItems: 'center',
        height: `${LAYOUT.headerHeight}px`,
        minHeight: `${LAYOUT.headerHeight}px`,
        boxSizing: 'border-box',
      }}>
      <h1
        style={{
          fontSize: `${FONT_SIZES.xxl}px`,
          fontWeight: FONT_WEIGHT.bold,
          margin: 0,
          color: COLORS.primary,
          letterSpacing: LETTER_SPACING.slight,
        }}>
        {APP_NAME}
      </h1>
    </header>
  );
}
