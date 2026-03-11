import {useState} from 'react';
import {COLORS, RADIUS, FONT_SIZES} from '../constants';

type FilterButtonSize = 'sm' | 'md';

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeColor?: string;
  /** Solid background color for active state. Falls back to activeColor. */
  activeBgColor?: string;
  inactiveColor?: string;
  inactiveTextColor?: string;
  size?: FilterButtonSize;
  'aria-label'?: string;
}

const SIZE_STYLES: Record<FilterButtonSize, React.CSSProperties> = {
  sm: {
    padding: '5px 10px',
    borderRadius: `${RADIUS.md}px`,
    fontSize: `${FONT_SIZES.sm}px`,
  },
  md: {
    padding: '10px 16px',
    borderRadius: `${RADIUS.lg}px`,
    fontSize: `${FONT_SIZES.base}px`,
    minHeight: '44px',
  },
};

export function FilterButton({
  active,
  onClick,
  children,
  activeColor = COLORS.primary600,
  activeBgColor,
  inactiveColor = COLORS.gray100,
  inactiveTextColor = COLORS.gray700,
  size = 'sm',
  'aria-label': ariaLabel,
}: FilterButtonProps) {
  const [hovered, setHovered] = useState(false);
  const sizeStyle = SIZE_STYLES[size];
  const bgColor = activeBgColor ?? activeColor;

  const hoverStyles = active
    ? {
        border: `1px solid ${activeColor}80`,
        background: bgColor,
        boxShadow: hovered
          ? `0 0 12px ${activeColor}70, inset 0 0 6px ${activeColor}20`
          : `0 0 8px ${activeColor}50`,
      }
    : hovered
      ? {
          border: `1px solid ${activeColor}40`,
          background: inactiveColor,
          boxShadow: `0 0 8px ${activeColor}30`,
        }
      : {
          border: '1px solid transparent',
          background: inactiveColor,
          boxShadow: 'none',
        };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={active}
      aria-label={ariaLabel}
      style={{
        ...sizeStyle,
        border: hoverStyles.border,
        background: hoverStyles.background,
        color: active ? COLORS.white : inactiveTextColor,
        fontWeight: 500,
        cursor: 'pointer',
        boxShadow: hoverStyles.boxShadow,
        transition: 'box-shadow 0.2s, background 0.2s, border-color 0.2s',
      }}>
      {children}
    </button>
  );
}
