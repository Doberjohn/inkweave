import {APP_NAME, COLORS, FONT_SIZES, SPACING} from '../constants';

export function Header() {
  return (
    <header
      style={{
        background: COLORS.white,
        borderBottom: `1px solid ${COLORS.gray200}`,
        padding: `${SPACING.sm}px ${SPACING.xxl}px`,
        color: COLORS.gray900,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
      <h1 style={{fontSize: `${FONT_SIZES.xl}px`, fontWeight: 700, margin: 0}}>{APP_NAME}</h1>
    </header>
  );
}
