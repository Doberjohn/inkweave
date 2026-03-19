import {useState} from 'react';
import {COLORS, FONTS, FONT_SIZES, RADIUS} from '../constants';

interface SortSelectProps<T extends string> {
  options: {value: T; label: string}[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  style?: React.CSSProperties;
}

export function SortSelect<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = 'Sort',
  style,
}: SortSelectProps<T>) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);

  const borderColor = focus
    ? 'rgba(212, 175, 55, 0.4)'
    : hover
      ? COLORS.gray300
      : COLORS.surfaceBorder;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value as T);
  };

  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={handleChange}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        padding: '5px 10px',
        borderRadius: `${RADIUS.md}px`,
        border: `1px solid ${borderColor}`,
        background: COLORS.sortBg,
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        cursor: 'pointer',
        outline: 'none',
        transition: 'border-color 0.15s',
        ...style,
      }}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
