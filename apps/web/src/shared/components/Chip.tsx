import {useState} from 'react';
import {COLORS, DURATION, EASING, FONTS, FONT_SIZES, GOLD_GLOW, RADIUS, hexRgba} from '../constants';

interface ChipBaseProps {
  label: string;
  isMobile?: boolean;
  title?: string;
  children?: React.ReactNode;
  /** Merged last — for site-specific layout tweaks (e.g. dimming in a filter row). */
  style?: React.CSSProperties;
}

interface ToggleChipProps extends ChipBaseProps {
  variant?: 'toggle';
  active: boolean;
  onClick: () => void;
}

interface DismissChipProps extends ChipBaseProps {
  variant: 'dismiss';
  onDismiss: () => void;
}

export type ChipProps = ToggleChipProps | DismissChipProps;

/**
 * Unified chip component with two variants:
 * - `toggle` (default): selectable chip with active/inactive state (gold glow when active)
 * - `dismiss`: always-active chip with × button to remove
 */
export function Chip(props: ChipProps) {
  const {label, isMobile, title, children, style} = props;
  const [hovered, setHovered] = useState(false);
  const isDismiss = props.variant === 'dismiss';

  // Dismiss chips are always visually "active" (gold tint)
  const active = isDismiss ? true : props.active;
  const glow = active || hovered;

  const handleClick = isDismiss ? props.onDismiss : props.onClick;

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={isDismiss ? undefined : active}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 5 : 6,
        padding: isDismiss
          ? isMobile
            ? '5px 8px 5px 10px'
            : '5px 10px 5px 12px'
          : isMobile
            ? '8px 14px'
            : '6px 14px',
        borderRadius: RADIUS.pill,
        fontSize: `${FONT_SIZES.lg}px`,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: FONTS.body,
        transition: `all ${DURATION.base}ms ${EASING.snappy}`,
        border: active
          ? `1px solid ${GOLD_GLOW.activeBorder}`
          : hovered
            ? `1px solid ${GOLD_GLOW.hoverBorder}`
            : `1px solid ${COLORS.surfaceBorder}`,
        background: active
          ? hexRgba(COLORS.primary, hovered ? 0.18 : 0.12)
          : hovered
            ? GOLD_GLOW.hoverBg
            : 'transparent',
        color: glow ? COLORS.primary : COLORS.textMuted,
        boxShadow: glow ? GOLD_GLOW.shadow : 'none',
        ...(isMobile
          ? {
              flexShrink: 0,
              whiteSpace: 'nowrap' as const,
              minHeight: '44px',
            }
          : {}),
        ...style,
      }}>
      {label}
      {children}
      {isDismiss && (
        <span
          style={{
            fontSize: `${FONT_SIZES.lg}px`,
            color: hovered ? COLORS.text : COLORS.textMuted,
            fontWeight: 600,
            lineHeight: 1,
          }}>
          ×
        </span>
      )}
    </button>
  );
}
