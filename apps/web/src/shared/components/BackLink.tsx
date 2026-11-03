import {COLORS, DURATION, EASING, FONTS, FONT_SIZES, FONT_WEIGHT} from '../constants';
import {useHover} from 'inkweave-ui/hooks/useHover';

interface BackLinkProps {
  onClick: () => void;
  label: string;
  /** Merged last — outer spacing belongs to the call site, not the component (#509). */
  style?: React.CSSProperties;
}

/** Styled back-navigation button with arrow and the brand gold on hover. The arrow is drawn, not read: its name is the label. */
export function BackLink({onClick, label, style}: BackLinkProps) {
  const {hovered, hoverProps} = useHover();

  return (
    <button
      type="button"
      onClick={onClick}
      {...hoverProps}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: hovered ? COLORS.primary : COLORS.textMuted,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        fontWeight: FONT_WEIGHT.medium,
        padding: 0,
        transition: `color ${DURATION.fast}ms ${EASING.snappy}`,
        ...style,
      }}>
      <span aria-hidden="true" style={{fontSize: `${FONT_SIZES.base}px`}}>&larr;</span>
      {label}
    </button>
  );
}
