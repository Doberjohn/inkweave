import {useState} from 'react';
import {COLORS, EASING, FONTS, FONT_SIZES, GOLD_GLOW, RADIUS} from '../constants';

interface SortSelectProps<T extends string> {
  options: {value: T; label: string; mobileLabel?: string}[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  style?: React.CSSProperties;
  /** When true, uses each option's `mobileLabel` (when defined) instead of `label`. */
  isMobile?: boolean;
}

export function SortSelect<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = 'Sort',
  style,
  isMobile,
}: SortSelectProps<T>) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);

  const borderColor = focus
    ? GOLD_GLOW.activeBorder
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
        // Explicit height matches FiltersButton/MechanicsButton (34px). Native <select>
        // otherwise renders larger on mobile (browsers boost form-control sizing to
        // prevent iOS tap-zoom). appearance:none disables platform chrome so our
        // inline font-size + padding actually take effect.
        height: 34,
        boxSizing: 'border-box',
        padding: '0 28px 0 10px',
        appearance: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        backgroundColor: COLORS.sortBg,
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'><path d='M1 1l4 4 4-4' stroke='%23e8e8e8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        borderRadius: `${RADIUS.md}px`,
        border: `1px solid ${borderColor}`,
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        lineHeight: 1,
        cursor: 'pointer',
        // #511 interaction rule: never suppress the focus ring without a
        // replacement — the UA outline is dropped ONLY because the GOLD_GLOW
        // ring below renders a visible focus indicator in its place.
        outline: 'none',
        boxShadow: focus ? GOLD_GLOW.focusRing : 'none',
        transition: `border-color 0.15s ${EASING.snappy}, box-shadow 0.15s ${EASING.snappy}`,
        ...style,
      }}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {isMobile && opt.mobileLabel ? opt.mobileLabel : opt.label}
        </option>
      ))}
    </select>
  );
}
