import {COLORS, DISABLED_STYLE, DURATION, EASING, RADIUS} from '../tokens/theme';

interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'role' | 'onClick' | 'onChange' | 'type'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

const TRACK = {width: 44, height: 24};
const KNOB = 18;
/** The knob's inset from the track's edge, inside the track's 1px border. */
const INSET = (TRACK.height - 2 - KNOB) / 2;

/**
 * An on/off setting that takes effect at once (WAI-ARIA's switch pattern): a button with
 * `role="switch"` and `aria-checked`. Name it from text on the page with `aria-labelledby`,
 * and put a `<label htmlFor>` on that text, so pressing the title flips it too and the row is
 * the touch target. On, the filled CTA's orange with a dark knob at the end; off, the raised
 * surface with a muted knob at the start.
 */
export function Switch({checked, onCheckedChange, disabled, style, ...rest}: SwitchProps) {
  return (
    <button
      {...rest}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      style={{
        position: 'relative',
        flexShrink: 0,
        ...TRACK,
        padding: 0,
        borderRadius: `${RADIUS.pill}px`,
        border: `1px solid ${checked ? 'transparent' : COLORS.surfaceBorder}`,
        background: checked ? COLORS.filterGradient : COLORS.surfaceRaised,
        cursor: 'pointer',
        transition: `background ${DURATION.base}ms ${EASING.smooth}, border-color ${DURATION.base}ms ${EASING.smooth}`,
        ...(disabled ? DISABLED_STYLE : {}),
        ...style,
      }}>
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: INSET,
          left: INSET,
          width: KNOB,
          height: KNOB,
          borderRadius: `${RADIUS.pill}px`,
          background: checked ? COLORS.background : COLORS.textMuted,
          transform: checked ? `translateX(${TRACK.width - 2 - KNOB - 2 * INSET}px)` : 'none',
          transition: `transform ${DURATION.fast}ms ${EASING.bounce}, background ${DURATION.fast}ms ${EASING.smooth}`,
        }}
      />
    </button>
  );
}
