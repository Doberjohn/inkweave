import {APP_NAME, COLORS, FONT_SIZES, LAYOUT, SPACING} from '../constants';

export function Header() {
  return (
    <header
      style={{
        background: COLORS.white,
        borderBottom: `1px solid ${COLORS.gray200}`,
        padding: `0 ${SPACING.xxl}px`,
        color: COLORS.gray900,
        display: 'flex',
        alignItems: 'center',
        height: `${LAYOUT.headerHeight}px`,
        minHeight: `${LAYOUT.headerHeight}px`,
        boxSizing: 'border-box',
      }}>
      <h1 style={{fontSize: `${FONT_SIZES.xl}px`, fontWeight: 700, margin: 0}}>{APP_NAME}</h1>
    </header>
  );
}
