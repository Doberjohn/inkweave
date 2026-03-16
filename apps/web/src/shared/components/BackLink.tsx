import {useState} from 'react';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../constants';

interface BackLinkProps {
  onClick: () => void;
  label: string;
}

/** Styled back-navigation button with arrow and gold hover effect. */
export function BackLink({onClick, label}: BackLinkProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: hovered ? COLORS.primary500 : COLORS.textMuted,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        fontWeight: 500,
        padding: 0,
        marginBottom: `${SPACING.lg}px`,
        transition: 'color 0.15s',
      }}>
      <span style={{fontSize: `${FONT_SIZES.base}px`}}>&larr;</span>
      {label}
    </button>
  );
}
