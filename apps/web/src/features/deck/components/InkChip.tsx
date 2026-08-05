import type {Ink} from 'inkweave-synergy-engine';
import {FONTS, FONT_SIZES, INK_COLORS, RADIUS, SPACING} from '../../../shared/constants';

/**
 * One of a deck's inks, as a tinted pill. Shared because it arrived twice
 * byte-identical: once in `DeckSummaryCard` (#473 task 7) and again in
 * `DeckViewPage` (task 8), each file-private and neither aware of the other.
 *
 * The ink palette is the one place a deck's identity is carried by colour alone,
 * so the label is always rendered too: `INK_COLORS` pairs are chosen for tint,
 * not for contrast against each other, and Amber against Amethyst is not a
 * distinction everyone can make.
 */
export function InkChip({ink}: {ink: Ink}) {
  const {bg, text, border} = INK_COLORS[ink];
  return (
    <span
      style={{
        background: bg,
        color: text,
        border: `1px solid ${border}`,
        borderRadius: `${RADIUS.pill}px`,
        padding: `${SPACING.xxs}px ${SPACING.sm}px`,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.sm}px`,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}>
      {ink}
    </span>
  );
}
