import {COLORS, EASING, FONTS, FONT_SIZES} from '../constants';
import {useHover} from '../hooks/useHover';

interface BackLinkProps {
  onClick: () => void;
  label: string;
  /** Merged last — outer spacing belongs to the call site, not the component (#509). */
  style?: React.CSSProperties;
}

/** Styled back-navigation button with arrow and gold hover effect. */
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
      <span style={{fontSize: `${FONT_SIZES.base}px`}}>&larr;</span>
      {label}
    </button>
  );
}
