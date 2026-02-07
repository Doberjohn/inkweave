import {APP_NAME, COLORS, FONT_SIZES, SPACING} from '../constants';

interface HeaderProps {
  totalCards: number;
  isLoading: boolean;
}

export function Header({totalCards, isLoading}: HeaderProps) {
  return (
    <header
      style={{
        background: `linear-gradient(90deg, ${COLORS.headerGradientStart}, ${COLORS.headerGradientEnd})`,
        borderBottom: `1px solid ${COLORS.gray200}`,
        padding: `${SPACING.xl}px ${SPACING.xxl}px`,
        color: COLORS.white,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
      <div>
        <h1 style={{fontSize: `${FONT_SIZES.xxxl}px`, fontWeight: 700, margin: 0}}>{APP_NAME}</h1>
        <p style={{fontSize: `${FONT_SIZES.base}px`, color: COLORS.white, marginTop: '4px', opacity: 0.9}}>
          {isLoading ? 'Loading...' : `${totalCards} cards loaded`}
        </p>
      </div>
    </header>
  );
}
