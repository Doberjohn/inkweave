interface SearchIconProps {
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function SearchIcon({size = 20, color, strokeWidth = 1.5}: SearchIconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="6" stroke={color} strokeWidth={strokeWidth} />
      <line
        x1="13.5"
        y1="13.5"
        x2="17"
        y2="17"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}
