import {COLORS, FONTS, FONT_SIZES, LAYOUT, SPACING} from '../constants';

interface CompactHeaderProps {
  totalCards: number;
  onLogoClick: () => void;
}

export function CompactHeader({totalCards, onLogoClick}: CompactHeaderProps) {
  return (
    <header
      data-testid="compact-header"
      style={{
        height: `${LAYOUT.compactHeaderHeight}px`,
        minHeight: `${LAYOUT.compactHeaderHeight}px`,
        padding: `0 ${SPACING.xl}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: `linear-gradient(180deg, ${COLORS.headerGradientStart} 0%, ${COLORS.headerGradientEnd} 100%)`,
        borderBottom: `1px solid ${COLORS.surfaceBorder}`,
        boxSizing: 'border-box',
      }}>
      {/* Clickable logo — returns to home */}
      <button
        onClick={onLogoClick}
        aria-label="Return to home"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
        <span
          style={{
            color: COLORS.primary,
            fontSize: `${FONT_SIZES.sm}px`,
            fontWeight: 600,
          }}>
          ✦
        </span>
        <span
          style={{
            fontFamily: FONTS.hero,
            fontSize: `${FONT_SIZES.xl}px`,
            fontWeight: 700,
            color: COLORS.primary,
            letterSpacing: '0.06em',
          }}>
          INKWEAVE
        </span>
      </button>

      {/* Card count */}
      <span
        style={{
          fontSize: `${FONT_SIZES.sm}px`,
          color: COLORS.textMuted,
        }}>
        {totalCards} cards
      </span>
    </header>
  );
}
