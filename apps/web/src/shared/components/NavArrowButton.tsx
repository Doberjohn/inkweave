import type {CSSProperties} from 'react';
import {RADIUS, SPACING} from '../constants';
import {CtaButton} from './CtaButton';

/**
 * The gold arrow that turns the binder's pages: round, beside the spread where the
 * binder draws its own arrows, and a pill with its word in the spread map (owner,
 * 2026-10-12: "Previous" and "Next" beside the chevrons).
 *
 * A KIT BUTTON, because `inkweave/no-adhoc-buttons` blocks a styled `<button>` in
 * feature code — correctly, since a second hand-rolled copy is exactly how the
 * back-link census ended up with eleven affordances in five shapes.
 *
 * A FILLED `CtaButton` UNDERNEATH (owner, 2026-10-12: "some sort of hover feedback"):
 * its gold, its boop as the pointer arrives and its press, so the arrows answer the
 * pointer the way the toolbar's gold buttons do. Only the shape and the chevron are
 * this component's.
 *
 * POSITIONING IS ENTIRELY THE CONSUMER'S — the base sets no `position` at all. The
 * binder lays it out beside the spread as a flex sibling, because overlaying it
 * there put the arrow on top of the cards at every window size where the spread is
 * wide. A consumer that overlays it offsets it without `transform`, which the boop
 * and the press own.
 */

/** The round arrow: a gold disc around the chevron. */
const ROUND: CSSProperties = {flexShrink: 0, width: 44, height: 44, minHeight: 0, padding: 0, borderRadius: '50%'};

/** The worded arrow: the same gold, fully rounded around the chevron and its word. */
const WORDED: CSSProperties = {
  flexShrink: 0,
  height: 44,
  minHeight: 0,
  gap: SPACING.xs,
  borderRadius: `${RADIUS.pill}px`,
  whiteSpace: 'nowrap',
};

/** The chevron's side sits nearer its edge than the word's, so the pill looks even on both. */
const WORDED_PADDING = {
  prev: `0 ${SPACING.md}px 0 ${SPACING.sm}px`,
  next: `0 ${SPACING.sm}px 0 ${SPACING.md}px`,
} as const;

const PATH = {
  prev: 'M15 18l-6-6 6-6',
  next: 'M9 6l6 6-6 6',
} as const;

interface NavArrowButtonProps {
  direction: 'prev' | 'next';
  /** The accessible name — "Previous spread", etc. With a word, it contains the word. */
  label: string;
  /** A word beside the chevron ("Previous", "Next"), which makes the arrow a pill. */
  text?: string;
  onClick: () => void;
  disabled?: boolean;
  /** Size and placement, and anything else the consumer needs to override. */
  style?: CSSProperties;
}

export function NavArrowButton({
  direction,
  label,
  text,
  onClick,
  disabled = false,
  style,
}: NavArrowButtonProps) {
  const glyph = text ? 18 : 22;
  const shape = text ? {...WORDED, padding: WORDED_PADDING[direction]} : ROUND;
  return (
    <CtaButton
      type="button"
      variant="filled"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{...shape, ...style}}>
      {direction === 'next' && text}
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d={PATH[direction]}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {direction === 'prev' && text}
    </CtaButton>
  );
}
