import {COLORS, FONT_SIZES, FONTS, hexRgba, TABULAR} from '../../../shared/constants';

/** SVG geometry: a 0..100 viewBox with the arc radius leaving room for the stroke. */
const VIEWBOX = 100;
const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const STROKE = 9;
/** Score number size in viewBox units (NOT px). Constant so it stays a fixed share of
 *  the ring at any pixel size — a 44px satellite renders it at ~13px, not ~5px. */
const NUMBER_FONT = 30;

interface ScoreRingProps {
  /** 0..100 score; drives the arc fill and the centered number. */
  score: number;
  /** Arc + number color — the tier color for the overall ring, the status color per dimension. */
  color: string;
  /** Outer pixel diameter. */
  size: number;
  /** Optional caption rendered under the ring (e.g. the dimension label). */
  label?: string;
}

/**
 * A PageSpeed-style circular score gauge (#472, item 5): a faint full-circle track
 * with a colored arc whose length is `score/100` of the circumference, and the score
 * centered. Presentation-only — reused for the overall Deck Quality Score (health cell
 * + Analysis-tab hero) and the per-dimension analyzer rings. The number + label scale
 * with `size` so one component serves the big and small rings alike.
 */
export function ScoreRing({score, color, size, label}: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const arc = (clamped / 100) * CIRCUMFERENCE;
  return (
    <div style={{display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 5}}>
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        width={size}
        height={size}
        role="img"
        aria-label={`${label ? `${label} ` : ''}score ${clamped} of 100`}>
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke={hexRgba(color, 0.18)} strokeWidth={STROKE} />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${CIRCUMFERENCE}`}
          transform="rotate(-90 50 50)"
        />
        <text
          x="50"
          y="52"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontFamily={FONTS.body}
          fontWeight={700}
          fontSize={NUMBER_FONT}
          style={{...TABULAR}}>
          {clamped}
        </text>
      </svg>
      {label && <span style={{fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: COLORS.textMuted, textAlign: 'center'}}>{label}</span>}
    </div>
  );
}
