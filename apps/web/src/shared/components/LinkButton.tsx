import {COLORS, EASING, FONTS, FONT_SIZES} from '../constants';
import {useHover} from '../hooks/useHover';

interface LinkButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** gold = accent action ("Show the math", "Undo"); muted = quiet utility ("Clear all"). */
  tone?: 'gold' | 'muted';
  size?: 'sm' | 'base';
  /** Underline on hover for prose-adjacent placements. */
  underlineOnHover?: boolean;
}

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
        fontSize: `${FONT_SIZES[size]}px`,
        fontWeight: 500,
        color,
        cursor: 'pointer',
        textDecoration: hot && underlineOnHover ? 'underline' : 'none',
        transition: `color 0.15s ${EASING.snappy}`,
        ...(disabled ? {opacity: 0.4, cursor: 'not-allowed'} : {}),
        ...style,
      }}>
      {children}
    </button>
  );
}
