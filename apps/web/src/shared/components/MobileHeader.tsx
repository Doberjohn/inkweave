import {APP_NAME, COLORS, FONT_SIZES, SPACING, LAYOUT_MOBILE} from '../constants';

export function MobileHeader() {
  return (
    <header
      style={{
        background: `linear-gradient(135deg, ${COLORS.headerGradientStart} 0%, ${COLORS.headerGradientEnd} 100%)`,
        padding: `${SPACING.md}px ${SPACING.lg}px`,
        paddingTop: `calc(${SPACING.md}px + env(safe-area-inset-top))`,
        color: COLORS.white,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: `${LAYOUT_MOBILE.headerHeight}px`,
        boxSizing: 'border-box',
      }}>
      <h1 style={{fontSize: `${FONT_SIZES.xl}px`, fontWeight: 700, margin: 0}}>{APP_NAME}</h1>
    </header>
  );
}
