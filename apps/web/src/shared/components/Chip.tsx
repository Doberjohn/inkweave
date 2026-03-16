import {useState} from 'react';
import {COLORS, FONTS, FONT_SIZES} from '../constants';

interface ChipBaseProps {
  label: string;
  isMobile?: boolean;
  title?: string;
  children?: React.ReactNode;
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
  const {label, isMobile, title, children} = props;
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
        borderRadius: 20,
        fontSize: `${FONT_SIZES.base}px`,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: FONTS.body,
        transition: 'all 0.2s',
        border: active
          ? '1px solid rgba(212, 175, 55, 0.4)'
          : hovered
            ? '1px solid rgba(255, 185, 0, 0.25)'
            : `1px solid ${COLORS.surfaceBorder}`,
        background: active
          ? hovered
            ? 'rgba(212, 175, 55, 0.18)'
            : 'rgba(212, 175, 55, 0.12)'
          : hovered
            ? 'rgba(255, 185, 0, 0.06)'
            : 'transparent',
        color: glow ? COLORS.primary500 : COLORS.textMuted,
        boxShadow: glow
          ? '0 0 12px rgba(255, 185, 0, 0.15), inset 0 0 8px rgba(255, 185, 0, 0.05)'
          : 'none',
        ...(isMobile
          ? {
              flexShrink: 0,
              whiteSpace: 'nowrap' as const,
              minHeight: '44px',
            }
          : {}),
      }}>
      {label}
      {children}
      {isDismiss && (
        <span
          style={{
            fontSize: `${FONT_SIZES.base}px`,
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
