import {COLORS, EASING, FONTS, FONT_SIZES} from '../constants';
import {useHover} from 'inkweave-ui/hooks/useHover';

interface BackLinkProps {
  onClick: () => void;
  label: string;
  /** Merged last — outer spacing belongs to the call site, not the component (#509). */
  style?: React.CSSProperties;
}

/** Styled back-navigation button with arrow and gold hover effect. The arrow is drawn, not read: its name is the label. */
export function BackLink({onClick, label, style}: BackLinkProps) {
  const {hovered, hoverProps} = useHover();

  return (
    <button
      onClick={onClick}
      {...hoverProps}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: hovered ? COLORS.primary500 : COLORS.textMuted,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        fontWeight: 500,
        padding: 0,
        transition: `color 0.15s ${EASING.snappy}`,
        ...style,
      }}>
      <span aria-hidden="true" style={{fontSize: `${FONT_SIZES.base}px`}}>&larr;</span>
      {label}
    </button>
  );
}
