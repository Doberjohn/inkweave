import {useState} from 'react';
import {COLORS, EASING, FONTS, FONT_SIZES, GOLD_GLOW, RADIUS, hexRgba} from '../constants';

interface ChipBaseProps {
  label: string;
  isMobile?: boolean;
  title?: string;
  /**
   * A glyph shown INSTEAD of the label (the Rarity filter's symbols). The label
   * still names the chip, for assistive tech and as its tooltip unless `title`
   * says otherwise.
   */
  icon?: React.ReactNode;
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
 * A dismiss chip leaves room for its ×. An icon-only chip pads evenly, so the
 * pill closes into a circle and five rarity symbols fit one row of the docked
 * filter panel, its scrollbar included.
 */
function chipPadding(isDismiss: boolean, iconOnly: boolean, isMobile?: boolean): string {
  if (isDismiss) return isMobile ? '5px 8px 5px 10px' : '5px 10px 5px 12px';
  if (iconOnly) return isMobile ? '10px' : '6px';
  return isMobile ? '8px 14px' : '6px 14px';
}

/**
 * Unified chip component with two variants:
 * - `toggle` (default): selectable chip with active/inactive state (gold glow when active)
 * - `dismiss`: always-active chip with × button to remove
 */
export function Chip(props: ChipProps) {
  const {label, isMobile, title, icon, children, style} = props;
  const [hovered, setHovered] = useState(false);
  const isDismiss = props.variant === 'dismiss';
  const iconOnly = Boolean(icon);

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
      aria-label={iconOnly ? label : undefined}
      title={title ?? (iconOnly ? label : undefined)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 5 : 6,
        padding: chipPadding(isDismiss, iconOnly, isMobile),
        borderRadius: RADIUS.pill,
        fontSize: `${FONT_SIZES.base}px`,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: FONTS.body,
        transition: `all 0.25s ${EASING.snappy}`,
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
      {iconOnly ? icon : label}
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
