import {COLORS, FONT_SIZES, SPACING} from '../constants';

interface HeaderProps {
  totalCards: number;
  isLoading: boolean;
}

export function Header({totalCards, isLoading}: HeaderProps) {
  return (
    <header
      style={{
        background: `linear-gradient(135deg, ${COLORS.headerGradientStart} 0%, ${COLORS.headerGradientEnd} 100%)`,
        padding: `${SPACING.xl}px ${SPACING.xxl}px`,
        color: COLORS.white,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
      <div>
        <h1 style={{fontSize: `${FONT_SIZES.xxxl}px`, fontWeight: 700, margin: 0}}>Inkweave</h1>
        <p style={{fontSize: `${FONT_SIZES.base}px`, color: COLORS.primary200, marginTop: '4px'}}>
          {isLoading ? 'Loading...' : `${totalCards} cards loaded`}
        </p>
      </div>
    </header>
  );
}
