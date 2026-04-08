import {useState} from 'react';
import {COLORS, FONTS, RADIUS, SPACING} from '../../../shared/constants';

export interface OptionPickerOption<T> {
  key: string;
  label: string;
  value: T;
}

export interface OptionColor {
  border: string;
  glow: string;
  hintBg: string;
  hoverBorder: string;
}

interface OptionPickerProps<T> {
  ariaLabel: string;
  options: OptionPickerOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  isMobile?: boolean;
  /** Per-option-key color mapping. Falls back to gold default if absent. */
  colorScheme?: Record<string, OptionColor>;
  /** Base delay in ms for staggered fade-up entrance animation. Default 0. */
  animationDelayBase?: number;
}

const DEFAULT_OPTION_COLOR: OptionColor = {
  border: COLORS.primary,
  glow: 'rgba(255, 185, 0, 0.15)',
  hintBg: 'rgba(255, 185, 0, 0.06)',
  hoverBorder: 'rgba(255, 185, 0, 0.35)',
};

/** Inject keyframes once at module load */
(function injectKeyframes() {
  const STYLE_ID = 'option-picker-keyframes';
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes idv-pulse {
      0%   { transform: scale(1); }
      40%  { transform: scale(1.06); }
      100% { transform: scale(1); }
    }
    @keyframes idv-fade-up {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .idv-option-btn:focus-visible {
      outline: 2px solid #d4af37;
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
})();

/**
 * Generic 2-3 option radio group with semantic colors, hover/glow/dimming feedback.
 * Used for IsReal, Accuracy, WouldPlay, and Difficulty dimensions.
 */
export function OptionPicker<T>({ariaLabel, options, value, onChange, isMobile, colorScheme, animationDelayBase = 0}: OptionPickerProps<T>) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [pulsingKey, setPulsingKey] = useState<string | null>(null);

  const hasSelection = value !== null;
  const height = isMobile ? 44 : 48;

  const getColors = (key: string): OptionColor => colorScheme?.[key] ?? DEFAULT_OPTION_COLOR;

  const handleClick = (key: string, optValue: T) => {
    setPulsingKey(key);
    onChange(optValue);
    setTimeout(() => setPulsingKey(null), 300);
  };

  const renderButton = (opt: OptionPickerOption<T>, index: number) => {
    const {key, label, value: optValue} = opt;
    const colors = getColors(key);
    const isSelected = value === optValue;
    const isHovered = hoveredKey === key;
    const isPressed = pressedKey === key;
    const isPulsing = pulsingKey === key;
    const isDimmed = hasSelection && !isSelected;

    const baseDelay = animationDelayBase + index * 40;

    const style: React.CSSProperties = {
      flex: 1,
      minWidth: 0,
      height,
      borderRadius: RADIUS.lg,
      cursor: 'pointer',
      fontSize: 13,
      fontFamily: FONTS.body,
      padding: '0 12px',
      transition: 'all 0.2s ease',
      transform: isPressed ? 'scale(0.97)' : undefined,
      animation: isPulsing
        ? 'idv-pulse 0.3s ease-out'
        : animationDelayBase > 0
          ? `idv-fade-up 0.35s ease-out ${baseDelay}ms both`
          : 'none',
      // State-driven styles
      ...(isSelected
        ? {
            background: colors.hintBg,
            border: `2px solid ${colors.border}`,
            color: colors.border,
            fontWeight: 700,
            boxShadow: `0 0 16px ${colors.glow}`,
            opacity: 1,
          }
        : {
            background: isHovered ? colors.hintBg : 'rgba(255,255,255,0.03)',
            border: isHovered
              ? `1px solid ${colors.hoverBorder}`
              : '1px solid rgba(255,255,255,0.08)',
            color: isHovered ? COLORS.text : COLORS.textMuted,
            fontWeight: 500,
            boxShadow: isHovered ? `inset 0 0 12px ${colors.glow}` : 'none',
            opacity: isDimmed ? 0.45 : 1,
          }),
    };

    if (isMobile) {
      style.width = '100%';
      style.flex = 'none';
    }

    return (
      <button
        key={key}
        className="idv-option-btn"
        role="radio"
        aria-checked={isSelected}
        onClick={() => handleClick(key, optValue)}
        onMouseEnter={() => setHoveredKey(key)}
        onMouseLeave={() => { setHoveredKey(null); setPressedKey(null); }}
        onMouseDown={() => setPressedKey(key)}
        onMouseUp={() => setPressedKey(null)}
        style={style}>
        {label}
      </button>
    );
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 6 : SPACING.sm,
        width: '100%',
      }}>
      {options.map(renderButton)}
    </div>
  );
}
