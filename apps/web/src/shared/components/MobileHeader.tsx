import type {GameMode} from '../../features/cards';
import {COLORS, FONT_SIZES, SPACING, RADIUS, LAYOUT_MOBILE} from '../constants';

interface MobileHeaderProps {
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
}

export function MobileHeader({gameMode, onGameModeChange}: MobileHeaderProps) {
  return (
    <header
      style={{
        background: COLORS.white,
        borderBottom: `1px solid ${COLORS.gray200}`,
        padding: `${SPACING.md}px ${SPACING.lg}px`,
        paddingTop: `calc(${SPACING.md}px + env(safe-area-inset-top))`,
        color: COLORS.gray900,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: `${LAYOUT_MOBILE.headerHeight}px`,
        boxSizing: 'border-box',
      }}>
      <h1 style={{fontSize: `${FONT_SIZES.xl}px`, fontWeight: 700, margin: 0}}>Lorcana Synergy</h1>
      <div style={{display: 'flex', gap: '4px'}} role="group" aria-label="Game mode">
        <button
          onClick={() => onGameModeChange('infinity')}
          aria-pressed={gameMode === 'infinity'}
          style={{
            padding: '6px 12px',
            borderRadius: `${RADIUS.md}px`,
            border: `1px solid ${COLORS.gray300}`,
            background: gameMode === 'infinity' ? COLORS.primary600 : COLORS.white,
            color: gameMode === 'infinity' ? COLORS.white : COLORS.gray700,
            fontSize: `${FONT_SIZES.sm}px`,
            fontWeight: 600,
            cursor: 'pointer',
          }}>
          Infinity
        </button>
        <button
          onClick={() => onGameModeChange('core')}
          aria-pressed={gameMode === 'core'}
          style={{
            padding: '6px 12px',
            borderRadius: `${RADIUS.md}px`,
            border: `1px solid ${COLORS.gray300}`,
            background: gameMode === 'core' ? COLORS.primary600 : COLORS.white,
            color: gameMode === 'core' ? COLORS.white : COLORS.gray700,
            fontSize: `${FONT_SIZES.sm}px`,
            fontWeight: 600,
            cursor: 'pointer',
          }}>
          Core
        </button>
      </div>
    </header>
  );
}
