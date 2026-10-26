import {COLORS, FONT_SIZES, NEUTRAL_LADDER, RADIUS, SPACING} from '../tokens/theme';

/**
 * The chip's size and padding. Admin measures a list width from its widest use, Card studio's
 * "not deployed yet" (92px): Edit card's search stacks a row's marks under its name below it
 * (SEARCH_STACK_BELOW, 306px), so a change to the font or the padding here needs that breakpoint
 * measured again.
 */
const TAG: React.CSSProperties = {
  flex: 'none',
  fontSize: FONT_SIZES.xs,
  fontWeight: 500,
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
  color: COLORS.textMuted,
  border: `1px solid ${NEUTRAL_LADDER.strongBorder}`,
  borderRadius: RADIUS.xs,
  padding: `0 ${SPACING.xs}px`,
};

interface TagProps {
  /** A word or two, lowercase ("raw", "low n", "preview"), that says enough without the title. */
  children: React.ReactNode;
  /** What the tag means, on hover. */
  title?: string;
}

/**
 * A small informative chip beside a name or a number, never a control: muted text in a thin
 * box. It keeps its size in a flex row and never wraps. Admin's "raw" and "low n" tags and Card
 * studio's are this chip; GoldTag is the gold, uppercase label for a highlight.
 */
export function Tag({children, title}: TagProps) {
  return (
    <span title={title} style={TAG}>
      {children}
    </span>
  );
}
