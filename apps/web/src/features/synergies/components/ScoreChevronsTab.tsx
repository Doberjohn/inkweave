import {
  COLORS,
  DURATION,
  EASING,
  FONT_SIZES,
  RADIUS,
  hexRgba,
  whiteRgba,
} from '../../../shared/constants';

interface ScoreChevronsTabProps {
  label: string;
  score: string;
  /** Adds "/10" after the score; off while there is no score to show. */
  showScale: boolean;
  isActive: boolean;
  /** The tab's colour: its text while active, and the tint of its fill, edge and glow. */
  tint: string;
  onClick: () => void;
}

/**
 * One of the phone comparison's two score tabs (MobileComparisonView): a label over a big score,
 * tinted while its panel is in view. A tab family of its own, so the lint rule's no-adhoc-buttons
 * exempts this file by name (#835).
 */
export function ScoreChevronsTab({
  label,
  score,
  showScale,
  isActive,
  tint,
  onClick,
}: ScoreChevronsTabProps) {
  const tabStyle: React.CSSProperties = {
    ...TAB_BASE_STYLE,
    background: isActive ? hexRgba(tint, 0.06) : whiteRgba(0.02),
    borderColor: isActive ? hexRgba(tint, 0.5) : COLORS.surfaceBorder,
    boxShadow: isActive ? `0 0 14px ${hexRgba(tint, 0.15)}` : undefined,
  };
  // The inactive tab's text is textMuted, as TabList's is, and "/10" keeps its tab's full colour:
  // dimmer, they missed 4.5:1 (WCAG 1.4.3).
  const textColor = isActive ? tint : COLORS.textMuted;
  const labelStyle: React.CSSProperties = {...TAB_LABEL_STYLE, color: textColor};
  const scoreStyle: React.CSSProperties = {...TAB_SCORE_STYLE, color: textColor};
  const scaleStyle: React.CSSProperties = {
    fontSize: FONT_SIZES.md,
    fontWeight: 700,
    color: textColor,
    marginLeft: 2,
  };
  return (
    <button type="button" aria-current={isActive} onClick={onClick} style={tabStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={scoreStyle}>
        {score}
        {showScale && <span style={scaleStyle}>/10</span>}
      </span>
    </button>
  );
}

const TAB_TRANSITION = `${DURATION.base}ms ${EASING.snappy}`;

const TAB_BASE_STYLE: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 4,
  padding: '12px 14px 10px',
  border: '1px solid',
  borderRadius: RADIUS.card,
  fontFamily: 'inherit',
  cursor: 'pointer',
  overflow: 'hidden',
  transition: `background ${TAB_TRANSITION}, border-color ${TAB_TRANSITION}, color ${TAB_TRANSITION}`,
};

const TAB_LABEL_STYLE: React.CSSProperties = {
  fontSize: FONT_SIZES.xs,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
};

const TAB_SCORE_STYLE: React.CSSProperties = {
  fontSize: FONT_SIZES.displaySm,
  fontWeight: 800,
  lineHeight: 1,
  fontFeatureSettings: '"tnum"',
};
