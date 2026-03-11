import {useState} from 'react';
import {COLORS, FONTS, FONT_SIZES} from '../constants';

interface FilterChipProps {
  label: string;
  onDismiss: () => void;
  isMobile?: boolean;
}

/** Dismissable filter chip with × button. Used in browse and synergy toolbars. */
export function FilterChip({label, onDismiss, isMobile}: FilterChipProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onDismiss}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 5 : 6,
        padding: isMobile ? '5px 8px 5px 10px' : '5px 10px 5px 12px',
        borderRadius: 20,
        background: hovered ? 'rgba(212, 175, 55, 0.18)' : 'rgba(212, 175, 55, 0.1)',
        border: `1px solid ${hovered ? 'rgba(212, 175, 55, 0.4)' : 'rgba(212, 175, 55, 0.25)'}`,
        color: COLORS.primary500,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: hovered
          ? '0 0 12px rgba(255, 185, 0, 0.15), inset 0 0 8px rgba(255, 185, 0, 0.05)'
          : 'none',
      }}>
      {label}
      <span
        style={{
          fontSize: `${FONT_SIZES.base}px`,
          color: hovered ? COLORS.text : COLORS.textMuted,
          fontWeight: 600,
          lineHeight: 1,
        }}>
        ×
      </span>
    </button>
  );
}
