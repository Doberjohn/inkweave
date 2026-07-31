import {useState} from 'react';
import {COLORS, DISABLED_STYLE, DURATION, EASING, FONTS, FONT_SIZES, PRESS_SCALE, RADIUS, hexRgba} from '../constants';
import {useBoop} from '../hooks';
import {CTA_FILLED_STYLE} from './ctaStyles';

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


/** Per-variant recipe; `hot` = hovered and enabled (drives the neutral warm-up). */
function variantStyle(variant: CtaVariant, hot: boolean): React.CSSProperties {
  const styles: Record<CtaVariant, React.CSSProperties> = {
    filled: CTA_FILLED_STYLE,
    pill: {...CTA_FILLED_STYLE, borderRadius: `${RADIUS.pill}px`},
    ghost: {
      background: 'transparent',
      color: COLORS.primary,
      border: `1px solid ${hexRgba(COLORS.primary, 0.4)}`,
    },
    neutral: {
      background: 'transparent',
      color: hot ? COLORS.primary : COLORS.textMuted,
      border: `1px solid ${hot ? hexRgba(COLORS.primary, 0.4) : COLORS.surfaceBorder}`,
    },
  };
  return styles[variant];
}


type MouseHandlers = Pick<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onMouseEnter' | 'onMouseLeave' | 'onMouseDown' | 'onMouseUp'
>;

/** Hover + press tracking with the boop trigger, chaining any caller-supplied handlers. */
function useCtaInteractions(disabled: boolean | undefined, handlers: MouseHandlers) {
  const boop = useBoop({scale: 1.03, timing: 200});
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const props: MouseHandlers = {
    onMouseEnter: (e) => {
      setHovered(true);
      if (!disabled) boop.trigger();
      handlers.onMouseEnter?.(e);
    },
    onMouseLeave: (e) => {
      setHovered(false);
      setPressed(false);
      handlers.onMouseLeave?.(e);
    },
    onMouseDown: (e) => {
      if (!disabled) setPressed(true);
      handlers.onMouseDown?.(e);
    },
    onMouseUp: (e) => {
      setPressed(false);
      handlers.onMouseUp?.(e);
    },
  };

  return {boop, hovered, pressed, props};
}

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
  const {boop, hovered, pressed, props} = useCtaInteractions(disabled, {
    onMouseEnter,
    onMouseLeave,
    onMouseDown,
    onMouseUp,
  });

  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '0 20px',
    minHeight: 44,
    borderRadius: `${RADIUS.lg}px`,
    fontFamily: FONTS.body,
    // The kit baseline (2026-07-31 ruling): every button is 14/600. Muted-grey
    // labels at 13/500 read thin on a dark ground — contrast was never the issue
    // (textMuted is 6.18-7.36:1, above AA everywhere), stroke weight was.
    fontSize: `${FONT_SIZES.lg}px`,
    fontWeight: 600,
    cursor: 'pointer',
    transition: `all ${DURATION.base}ms ${EASING.snappy}`,
    textDecoration: 'none',
  };

  return (
    <button
      {...rest}
      {...props}
      disabled={disabled}
      style={{
        ...baseStyle,
        ...variantStyle(variant, hovered && !disabled),
        ...(!disabled ? boop.style : {}),
        ...(pressed && !disabled ? {transform: `scale(${PRESS_SCALE})`} : {}),
        ...(disabled ? DISABLED_STYLE : {}),
        ...style,
      }}>
      {children}
    </button>
  );
}
