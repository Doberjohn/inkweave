import {COLORS, FONT_SIZES, FONTS} from '../../../shared/constants';

/** Shared filter-chip style for synergy group chip buttons. */
export function chipStyle(active: boolean, isMobile = false, hovered = false): React.CSSProperties {
  const glow = active || hovered;
  return {
    padding: isMobile ? '8px 14px' : '6px 14px',
    borderRadius: '20px',
    fontSize: `${FONT_SIZES.base}px`,
    fontWeight: 500,
    cursor: 'pointer',
    border: active
      ? '1px solid rgba(212, 175, 55, 0.4)'
      : hovered
        ? '1px solid rgba(255, 185, 0, 0.25)'
        : `1px solid ${COLORS.surfaceBorder}`,
    background: active
      ? 'rgba(212, 175, 55, 0.12)'
      : hovered
        ? 'rgba(255, 185, 0, 0.06)'
        : 'transparent',
    color: active || hovered ? COLORS.primary500 : COLORS.textMuted,
    boxShadow: glow
      ? '0 0 12px rgba(255, 185, 0, 0.15), inset 0 0 8px rgba(255, 185, 0, 0.05)'
      : 'none',
    transition: 'all 0.2s',
    fontFamily: FONTS.body,
    ...(isMobile
      ? {
          flexShrink: 0,
          whiteSpace: 'nowrap',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
        }
      : {}),
  };
}
