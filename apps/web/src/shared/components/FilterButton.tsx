import {COLORS, RADIUS, FONT_SIZES} from '../constants';

type FilterButtonSize = 'sm' | 'md';

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeColor?: string;
  inactiveColor?: string;
  inactiveTextColor?: string;
  size?: FilterButtonSize;
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
  inactiveColor = COLORS.gray100,
  inactiveTextColor = COLORS.gray700,
  size = 'sm',
}: FilterButtonProps) {
  const sizeStyle = SIZE_STYLES[size];

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        ...sizeStyle,
        border: 'none',
        background: active ? activeColor : inactiveColor,
        color: active ? COLORS.white : inactiveTextColor,
        fontWeight: 500,
        cursor: 'pointer',
      }}>
      {children}
    </button>
  );
}
