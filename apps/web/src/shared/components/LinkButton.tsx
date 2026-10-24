import {COLORS, DISABLED_STYLE, EASING, FONTS, FONT_SIZES} from '../constants';
import {useHover} from '../hooks/useHover';
import {isOff} from './isOff';

interface LinkButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** gold = accent action ("Show the math", "Undo"); muted = quiet utility ("Clear all"). */
  tone?: 'gold' | 'muted';
  size?: 'sm' | 'base';
  /** Underline on hover for prose-adjacent placements. */
  underlineOnHover?: boolean;
  /** React 19 ref-as-prop: the card view moves focus to its BACK link when a comparison opens. */
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * The link-style text button (#509): bare text, no border or background — the
 * one blessed recipe for the archetype that previously existed in four
 * hand-rolled forms ("Clear all" alone had four). Gold tone brightens on
 * hover; muted tone lifts to full text color. `aria-disabled` holds it off like
 * `disabled`, as CtaButton does (#790), while it keeps its focus.
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
  const off = isOff(disabled, rest['aria-disabled']);
  const hot = hovered && !off;
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
        ...(off ? DISABLED_STYLE : {}),
        ...style,
      }}>
      {children}
    </button>
  );
}
