import {useState} from 'react';
import {COLORS, FONTS, FONT_SIZES, RADIUS} from '../constants';
import {FilterIcon} from './FilterIcon';
import {CountBadge} from './CountBadge';

interface FiltersButtonProps {
  onClick: () => void;
  activeCount: number;
  isMobile?: boolean;
}

/** Orange gradient "Filters" button with optional count badge. */
export function FiltersButton({onClick, activeCount, isMobile}: FiltersButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Filters"
      style={{
        height: 34,
        padding: isMobile ? '0 12px' : '0 14px',
        border: 'none',
        background: COLORS.filterGradient,
        color: COLORS.filterText,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        fontWeight: 500,
        borderRadius: `${RADIUS.lg}px`,
        cursor: 'pointer',
        flexShrink: 0,
        boxShadow: isMobile
          ? '0px 6px 10px 0px rgba(254, 154, 0, 0.15)'
          : '0px 8px 12px 0px rgba(254, 154, 0, 0.15), 0px 3px 5px 0px rgba(254, 154, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        opacity: hovered ? 0.9 : 1,
        transition: 'opacity 0.15s',
      }}>
      <FilterIcon />
      Filters
      <CountBadge count={activeCount} />
    </button>
  );
}
