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
      <h1 style={{fontSize: `${FONT_SIZES.xl}px`, fontWeight: 700, margin: 0}}>Lorcana Synergy</h1>
      <div style={{display: 'flex', gap: '4px'}} role="group" aria-label="Game mode">
        <button
          onClick={() => onGameModeChange('infinity')}
          aria-pressed={gameMode === 'infinity'}
          style={{
            padding: '6px 12px',
            borderRadius: `${RADIUS.md}px`,
            border: 'none',
            background: gameMode === 'infinity' ? COLORS.white : 'rgba(255,255,255,0.2)',
            color: gameMode === 'infinity' ? COLORS.primary700 : COLORS.white,
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
            border: 'none',
            background: gameMode === 'core' ? COLORS.white : 'rgba(255,255,255,0.2)',
            color: gameMode === 'core' ? COLORS.primary700 : COLORS.white,
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
