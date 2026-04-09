import {COLORS, EASING, FONTS, FONT_SIZES, RADIUS} from '../constants';
import {useBoop} from '../hooks';

interface CtaButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant: filled (orange gradient) or ghost (gold outline) */
  variant?: 'filled' | 'ghost';
}

/** Shared CTA button with built-in hover effect + boop. */
export function CtaButton({
  variant = 'filled',
  style,
  children,
  onMouseEnter,
  onMouseLeave,
  disabled,
  ...rest
}: CtaButtonProps) {
  const boop = useBoop({scale: 1.03, timing: 200});

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
    cursor: disabled ? 'default' : 'pointer',
    transition: `all 0.25s ${EASING.snappy}`,
    textDecoration: 'none',
  };

  const variantStyle: React.CSSProperties =
    variant === 'filled'
      ? {
          border: 'none',
          background: COLORS.filterGradient,
          color: COLORS.filterText,
          boxShadow: COLORS.filterShadow,
        }
      : {
          background: 'transparent',
          color: COLORS.primary,
          border: '1px solid rgba(255, 185, 0, 0.4)',
        };

  return (
    <button
      {...rest}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (!disabled) boop.trigger();
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        onMouseLeave?.(e);
      }}
      style={{...baseStyle, ...variantStyle, ...(!disabled ? boop.style : {}), ...style}}>
      {children}
    </button>
  );
}
