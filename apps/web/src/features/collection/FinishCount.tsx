import type {CSSProperties} from 'react';
import {COLORS, FOIL_SHEEN, FONTS, FONT_SIZES, GOLD_GLOW, RADIUS, SPACING, TABULAR} from '../../shared/constants';
import type {Finish} from './collectionParser';

const PILL_STYLE: CSSProperties = {
  ...TABULAR,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 40,
  height: 26,
  padding: `0 ${SPACING.sm}px`,
  borderRadius: RADIUS.sm,
  fontFamily: FONTS.body,
  fontSize: `${FONT_SIZES.base}px`,
  fontWeight: 700,
  lineHeight: 1,
  color: COLORS.text,
};

/** Normal copies on the card's own black, as the copies stripe draws them; foil on brushed gold. */
const GROUNDS: Record<Finish, CSSProperties> = {
  normal: {background: COLORS.background, border: `1px solid ${COLORS.surfaceBorder}`},
  foil: {...FOIL_SHEEN.surface(COLORS.background, false), border: `1px solid ${GOLD_GLOW.activeBorder}`},
};

const NONE_STYLE: CSSProperties = {...PILL_STYLE, color: COLORS.textMuted, fontWeight: 400};

/**
 * One finish's copies, read only, on the copies stripe's grounds: the finish is the ground, not
 * a letter (owner, 2026-08-14). A dash for none. Decoration: what it says is the caller's to name.
 */
export function FinishCount({finish, count}: {finish: Finish; count: number}) {
  if (count === 0) return <span style={NONE_STYLE}>–</span>;
  return <span style={{...PILL_STYLE, ...GROUNDS[finish]}}>{count}</span>;
}
