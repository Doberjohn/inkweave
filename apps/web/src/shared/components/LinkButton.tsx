import {COLORS, DURATION, EASING, FONTS, FONT_SIZES} from '../constants';
import {useHover} from '../hooks/useHover';

interface LinkButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** gold = accent action ("Show the math", "Undo"); muted = quiet utility ("Clear all"). */
  tone?: 'gold' | 'muted';
  size?: 'sm' | 'base';
  /** Underline on hover for prose-adjacent placements. */
  underlineOnHover?: boolean;
}

/**
 * `size` names the KIT role, not a FONT_SIZES key. `base` is the kit baseline
 * (14px, 2026-07-31 ruling); `sm` is an opt-in smaller size a caller chose for a
 * tight space, deliberately left at 11px so the prop does not become a lie.
 * Indexing FONT_SIZES by `size` directly would silently pin `base` back to 13.
 */
const LINK_BUTTON_SIZE_PX = {sm: FONT_SIZES.sm, base: FONT_SIZES.lg} as const;

/**
 * The link-style text button (#509): bare text, no border or background — the
 * one blessed recipe for the archetype that previously existed in four
 * hand-rolled forms ("Clear all" alone had four). Gold tone brightens on
 * hover; muted tone lifts to full text color.
 */
export function LinkButton({
  tone = 'gold',
  size = 'base',
  underlineOnHover = false,
  style,
  children,
  disabled,
  ...rest
}: LinkButtonProps) {
  const {hovered, hoverProps} = useHover();
  const hot = hovered && !disabled;
  const color = tone === 'gold' ? (hot ? COLORS.primaryHover : COLORS.primary) : hot ? COLORS.text : COLORS.textMuted;

  return (
    <button
      {...rest}
      {...hoverProps}
      disabled={disabled}
      style={{
        background: 'transparent',
        border: 'none',
        padding: '2px 0',
        fontFamily: FONTS.body,
        fontSize: `${LINK_BUTTON_SIZE_PX[size]}px`,
        fontWeight: 600,
        color,
        cursor: 'pointer',
        textDecoration: hot && underlineOnHover ? 'underline' : 'none',
        transition: `color ${DURATION.fast}ms ${EASING.snappy}`,
        ...(disabled ? {opacity: 0.4, cursor: 'not-allowed'} : {}),
        ...style,
      }}>
      {children}
    </button>
  );
}
