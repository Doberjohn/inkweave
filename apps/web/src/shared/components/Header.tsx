import type {GameMode} from '../../features/cards';
import {COLORS, FONT_SIZES, SPACING, RADIUS} from '../constants';

interface HeaderProps {
  totalCards: number;
  isLoading: boolean;
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
}

export function Header({totalCards, isLoading, gameMode, onGameModeChange}: HeaderProps) {
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
        <h1 style={{fontSize: `${FONT_SIZES.xxxl}px`, fontWeight: 700, margin: 0}}>Inkweave</h1>
        <p style={{fontSize: `${FONT_SIZES.base}px`, color: COLORS.gray600, marginTop: '4px'}}>
          {isLoading ? 'Loading...' : `${totalCards} cards loaded`}
        </p>
      </div>
      <div style={{display: 'flex', gap: '4px'}} role="group" aria-label="Game mode">
        <button
          onClick={() => onGameModeChange('infinity')}
          aria-pressed={gameMode === 'infinity'}
          style={{
            padding: '8px 16px',
            borderRadius: `${RADIUS.md}px`,
            border: `1px solid ${COLORS.gray300}`,
            background: gameMode === 'infinity' ? COLORS.primary600 : COLORS.white,
            color: gameMode === 'infinity' ? COLORS.white : COLORS.gray700,
            fontSize: `${FONT_SIZES.base}px`,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}>
          Infinity
        </button>
        <button
          onClick={() => onGameModeChange('core')}
          aria-pressed={gameMode === 'core'}
          style={{
            padding: '8px 16px',
            borderRadius: `${RADIUS.md}px`,
            border: `1px solid ${COLORS.gray300}`,
            background: gameMode === 'core' ? COLORS.primary600 : COLORS.white,
            color: gameMode === 'core' ? COLORS.white : COLORS.gray700,
            fontSize: `${FONT_SIZES.base}px`,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}>
          Core
        </button>
      </div>
    </header>
  );
}
