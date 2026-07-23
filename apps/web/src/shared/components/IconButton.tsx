import {COLORS, EASING, RADIUS} from '../constants';
import {useHover} from '../hooks/useHover';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon buttons have no text, so the accessible name is the label. */
  'aria-label': string;
  /** Square hit target in px. Defaults to the 44px touch-target floor. */
  size?: number;
  /** React 19 ref-as-prop: dialogs attach initial-focus refs to their close ×. */
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * The blessed icon/close button (#509), consolidating the five hand-rolled
 * close-× recipes: a square touch target, quiet at rest, surface + text lift
 * on hover. Children are the glyph (an × character or an SVG icon).
 */
export function IconButton({size = 44, style, children, disabled, ...rest}: IconButtonProps) {
  const {hovered, hoverProps} = useHover();
  const hot = hovered && !disabled;

  return (
    <button
      {...rest}
      {...hoverProps}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        padding: 0,
        border: 'none',
        borderRadius: `${RADIUS.md}px`,
        background: hot ? COLORS.surfaceHover : 'transparent',
        color: hot ? COLORS.text : COLORS.textMuted,
        cursor: 'pointer',
        transition: `all 0.15s ${EASING.snappy}`,
        ...(disabled ? {opacity: 0.4, cursor: 'not-allowed'} : {}),
        ...style,
      }}>
      {children}
    </button>
  );
}
