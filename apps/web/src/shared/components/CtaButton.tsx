import {useState} from 'react';
import {COLORS, EASING, FONTS, FONT_SIZES, RADIUS, hexRgba} from '../constants';
import {useBoop} from '../hooks';

/**
 * The blessed CTA variants (#509, one component per the owner ruling):
 * - `filled`  — THE primary action (orange gradient, dark text: the landing canon).
 * - `ghost`   — gold-outlined secondary action (e.g. Explore/Rate, Skip this pair).
 * - `neutral` — quiet outlined secondary (modal Close/Cancel, Sign out, admin utility);
 *               text and border warm to gold on hover.
 * - `pill`    — the filled recipe fully rounded, for nav promos (e.g. the Reveals link).
 */
export type CtaVariant = 'filled' | 'ghost' | 'neutral' | 'pill';

interface CtaButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CtaVariant;
}

/** Uniform kit disabled recipe (#509): visibly dimmed, explicit cursor, no motion. */
const DISABLED_STYLE: React.CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

/** Uniform kit press feedback (#509): a small scale-down while the pointer is held. */
const PRESS_SCALE = 'scale(0.97)';

const FILLED_STYLE: React.CSSProperties = {
  border: 'none',
  background: COLORS.filterGradient,
  color: COLORS.filterText,
  boxShadow: COLORS.filterShadow,
};

/** Shared CTA button: variant menu + built-in boop hover, press, and disabled states. */
export function CtaButton({
  variant = 'filled',
  style,
  children,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onMouseUp,
  disabled,
  ...rest
}: CtaButtonProps) {
  const boop = useBoop({scale: 1.03, timing: 200});
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '0 20px',
    minHeight: 44,
    borderRadius: `${RADIUS.lg}px`,
    fontFamily: FONTS.body,
    fontSize: `${FONT_SIZES.base}px`,
    fontWeight: 500,
    cursor: 'pointer',
    transition: `all 0.25s ${EASING.snappy}`,
    textDecoration: 'none',
  };

  const variantStyles: Record<CtaVariant, React.CSSProperties> = {
    filled: FILLED_STYLE,
    pill: {...FILLED_STYLE, borderRadius: `${RADIUS.pill}px`},
    ghost: {
      background: 'transparent',
      color: COLORS.primary,
      border: `1px solid ${hexRgba(COLORS.primary, 0.4)}`,
    },
    neutral: {
      background: 'transparent',
      color: hovered && !disabled ? COLORS.primary : COLORS.textMuted,
      border: `1px solid ${hovered && !disabled ? hexRgba(COLORS.primary, 0.4) : COLORS.surfaceBorder}`,
    },
  };

  return (
    <button
      {...rest}
      disabled={disabled}
      onMouseEnter={(e) => {
        setHovered(true);
        if (!disabled) boop.trigger();
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        setPressed(false);
        onMouseLeave?.(e);
      }}
      onMouseDown={(e) => {
        if (!disabled) setPressed(true);
        onMouseDown?.(e);
      }}
      onMouseUp={(e) => {
        setPressed(false);
        onMouseUp?.(e);
      }}
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...(!disabled ? boop.style : {}),
        ...(pressed && !disabled ? {transform: PRESS_SCALE} : {}),
        ...(disabled ? DISABLED_STYLE : {}),
        ...style,
      }}>
      {children}
    </button>
  );
}
