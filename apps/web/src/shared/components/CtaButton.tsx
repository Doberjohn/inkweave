import {useState} from 'react';
import {COLORS, FONTS, FONT_SIZES, RADIUS} from '../constants';

interface CtaButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant: filled (orange gradient) or ghost (gold outline) */
  variant?: 'filled' | 'ghost';
}

/** Shared CTA button with built-in hover effect. */
export function CtaButton({
  variant = 'filled',
  style,
  children,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: CtaButtonProps) {
  const [hovered, setHovered] = useState(false);

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
    transition: 'all 0.2s',
    textDecoration: 'none',
  };

  const variantStyle: React.CSSProperties =
    variant === 'filled'
      ? {
          border: 'none',
          background: hovered ? 'linear-gradient(90deg, #ffb020, #fe9a00)' : COLORS.filterGradient,
          color: COLORS.filterText,
          boxShadow: COLORS.filterShadow,
        }
      : {
          background: hovered ? 'rgba(255, 185, 0, 0.05)' : 'transparent',
          color: COLORS.primary,
          border: hovered ? '1px solid rgba(255, 185, 0, 0.6)' : '1px solid rgba(255, 185, 0, 0.4)',
        };

  return (
    <button
      {...rest}
      onMouseEnter={(e) => {
        setHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        onMouseLeave?.(e);
      }}
      style={{...baseStyle, ...variantStyle, ...style}}>
      {children}
    </button>
  );
}
