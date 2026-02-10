import {APP_NAME, COLORS, FONT_SIZES, SPACING, LAYOUT_MOBILE} from '../constants';

export function MobileHeader() {
  return (
    <header
      style={{
        background: `linear-gradient(135deg, ${COLORS.headerGradientStart} 0%, ${COLORS.headerGradientEnd} 100%)`,
        borderBottom: `1px solid ${COLORS.surfaceBorder}`,
        padding: `${SPACING.md}px ${SPACING.lg}px`,
        paddingTop: `calc(${SPACING.md}px + env(safe-area-inset-top))`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: `${LAYOUT_MOBILE.headerHeight}px`,
        boxSizing: 'border-box',
      }}>
      <h1
        style={{
          fontSize: `${FONT_SIZES.xxl}px`,
          fontWeight: 700,
          margin: 0,
          color: COLORS.primary,
          letterSpacing: '0.02em',
        }}>
        {APP_NAME}
      </h1>
    </header>
  );
}
