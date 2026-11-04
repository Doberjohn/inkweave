import type {CSSProperties} from 'react';
import {COLORS, FONTS, FONT_SIZES, FONT_WEIGHT, LINE_HEIGHT, SPACING, TRUNCATE, VISUALLY_HIDDEN} from '../../../shared/constants';
import {binderWord} from './shelfWords';

/** The heading and its count on one line, the count after the words as the mockup set them. */
const ROW: CSSProperties = {display: 'flex', alignItems: 'baseline', gap: SPACING.md, minWidth: 0};

const titleStyle = (compact: boolean): CSSProperties => ({
  ...TRUNCATE,
  margin: 0,
  fontFamily: FONTS.hero,
  fontSize: `${compact ? FONT_SIZES.xxl : FONT_SIZES.xxxl}px`,
  // The hero serif's one weight, said out loud: an <h2> asks for bold, which it has no face for.
  fontWeight: FONT_WEIGHT.regular,
  lineHeight: LINE_HEIGHT.tight,
  color: COLORS.text,
});

const COUNT_STYLE: CSSProperties = {
  flexShrink: 0,
  fontSize: `${FONT_SIZES.base}px`,
  fontWeight: FONT_WEIGHT.medium,
  color: COLORS.textMuted,
  whiteSpace: 'nowrap',
};

interface ShelfHeadingProps {
  /** How many binders the shelf holds, My collection included, or null until they have loaded. */
  count: number | null;
  /** A phone's row, beside Collection: a step smaller, the count a bare number, its word for screen readers alone. */
  compact?: boolean;
}

/**
 * The binder shelf's heading (#1074), where the toolbar's filters stand on a computer and in a
 * phone's binder row: "Your binders" and how many. The count joins once the binders have loaded,
 * after the words, so nothing moves when it does.
 */
export function ShelfHeading({count, compact = false}: ShelfHeadingProps) {
  return (
    <div style={ROW}>
      <h2 style={titleStyle(compact)}>Your binders</h2>
      {count !== null && (
        <span style={COUNT_STYLE}>
          {count}
          <span style={compact ? VISUALLY_HIDDEN : undefined}> {binderWord(count)}</span>
        </span>
      )}
    </div>
  );
}
