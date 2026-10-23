import {useState} from 'react';
import {COLORS, DISABLED_STYLE, EASING, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../../shared/constants';
import {CountBadge} from '../../../shared/components/CountBadge';

interface MechanicsButtonProps {
  onClick: () => void;
  activeCount: number;
  isMobile?: boolean;
  /** Off while the playstyle's cards load: the button holds its place in the toolbar (#914). */
  disabled?: boolean;
}

function MechanicsIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      {/* Three small "tile" squares — visually distinct from FilterIcon's funnel */}
      <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="12" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="12" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Gold-outlined "Mechanics" button — primary-accent treatment that stands out
 *  against neutral chrome while staying distinct from FiltersButton's filled gradient.
 *  Rest:   gold border + gold text + faint gold tint background
 *  Hover:  brighter gold + slightly stronger tint
 *  Active: same gold border + filled gold tint + soft glow (count badge differentiates further) */
export function MechanicsButton({onClick, activeCount, isMobile, disabled}: MechanicsButtonProps) {
  const [hovered, setHovered] = useState(false);
  const active = activeCount > 0;
  // A pointer over the button while it's off doesn't light it.
  const lit = hovered && !disabled;

  const background = active
    ? 'rgba(212, 175, 55, 0.14)'
    : lit
      ? 'rgba(212, 175, 55, 0.08)'
      : 'rgba(212, 175, 55, 0.04)';
  const boxShadow = active
    ? '0 0 12px rgba(212, 175, 55, 0.25)'
    : lit
      ? '0 0 8px rgba(212, 175, 55, 0.15)'
      : 'none';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Mechanics"
      style={{
        height: 34,
        padding: isMobile ? `0 ${SPACING.md}px` : `0 ${SPACING.section}px`,
        border: `1px solid ${COLORS.primary}`,
        background,
        color: COLORS.primary,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        fontWeight: 500,
        borderRadius: `${RADIUS.lg}px`,
        boxShadow,
        cursor: 'pointer',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.sm,
        transition: `background 0.15s ${EASING.snappy}, box-shadow 0.15s ${EASING.snappy}`,
        ...(disabled ? DISABLED_STYLE : {}),
      }}>
      <MechanicsIcon />
      Mechanics
      <CountBadge count={activeCount} />
    </button>
  );
}
