import {APP_NAME, COLORS, FONT_SIZES, SPACING} from '../constants';

interface HeaderProps {
  totalCards: number;
  isLoading: boolean;
}

export function Header({totalCards, isLoading}: HeaderProps) {
  return (
    <header
      style={{
        background: COLORS.white,
        borderBottom: `1px solid ${COLORS.gray200}`,
        padding: `${SPACING.xl}px ${SPACING.xxl}px`,
        color: COLORS.gray900,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
      <div>
        <h1 style={{fontSize: `${FONT_SIZES.xxxl}px`, fontWeight: 700, margin: 0}}>{APP_NAME}</h1>
        <p style={{fontSize: `${FONT_SIZES.base}px`, color: COLORS.gray600, marginTop: '4px'}}>
          {isLoading ? 'Loading...' : `${totalCards} cards loaded`}
        </p>
      </div>
    </header>
  );
}
