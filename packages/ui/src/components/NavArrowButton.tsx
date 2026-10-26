import {useState, type CSSProperties, type FocusEvent} from 'react';
import {DURATION, EASING, ICON_SIZE} from '../tokens/theme';
import {useHover} from '../hooks/useHover';
import {focusedByKeyboard} from '../utils/focusedByKeyboard';
import {usePrefersReducedMotion} from '../utils/prefersReducedMotion';
import {CtaButton} from './CtaButton';

/**
 * The gold arrow that turns the binder's pages: a disc beside the spread where the binder
 * draws its arrows there, and under a lone page; and where Browse docks its panels, a smaller
 * one on each of the spread's outer edges, which grows under the pointer (owner, 2026-10-22:
 * it replaced the worded Previous and Next at either end of the spread map's row).
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
 * and the press own. An edge disc grows with the `scale` property instead, which
 * composes with theirs, about its centre, so it keeps the place its consumer gave it.
 *
 * AT THE BINDER'S END IT STAYS FOCUSABLE (#790): dimmed, announced as unavailable
 * (`aria-disabled`), and a press does nothing. A native `disabled` dropped keyboard
 * focus to the page the moment Enter on Next reached the last spread, so the next Tab
 * started from the top of the page. An edge disc there stays small.
 */

/** The round arrow: a gold disc around the chevron. */
const ROUND: CSSProperties = {flexShrink: 0, width: 44, height: 44, minHeight: 0, padding: 0, borderRadius: '50%'};

/** The edge disc's size at rest (owner, 2026-10-22). Its consumer places it by it. */
export const EDGE_DISC_SIZE = 28;

/** The edge disc grown, while a pointer rests on it or the keyboard's focus is on it: 40px. */
const EDGE_DISC_GROWN = 40 / EDGE_DISC_SIZE;

/** The edge disc: small, and grown when `grown`, with the boop's own transition kept beside the growth's. */
function edgeStyle(grown: boolean, reducedMotion: boolean): CSSProperties {
  return {
    ...ROUND,
    width: EDGE_DISC_SIZE,
    height: EDGE_DISC_SIZE,
    scale: grown ? `${EDGE_DISC_GROWN}` : '1',
    transition: reducedMotion
      ? undefined
      : `transform ${DURATION.base}ms ${EASING.bounce}, scale ${DURATION.slow}ms ${EASING.bounce}`,
  };
}

const PATH = {
  prev: 'M15 18l-6-6 6-6',
  next: 'M9 6l6 6-6 6',
} as const;

interface NavArrowButtonProps {
  direction: 'prev' | 'next';
  /** The accessible name — "Previous spread", etc. */
  label: string;
  onClick: () => void;
  /** At the first view (Previous) or the last (Next): dimmed and inert, but still focusable. */
  atEnd?: boolean;
  /**
   * The small disc for the spread's outer edge (owner, 2026-10-22), `EDGE_DISC_SIZE` across,
   * which grows while a pointer rests on it or the keyboard's focus is on it.
   */
  edge?: boolean;
  /** Size and placement, and anything else the consumer needs to override. */
  style?: CSSProperties;
}

/** Whether an edge disc is grown: pointed at or focused from the keyboard, and not at the binder's end. */
function useGrowth(edge: boolean, atEnd: boolean) {
  const {hovered, hoverProps} = useHover();
  const [keyboard, setKeyboard] = useState(false);
  return {
    grown: edge && !atEnd && (hovered || keyboard),
    growthProps: edge
      ? {
          ...hoverProps,
          onFocus: (e: FocusEvent<HTMLButtonElement>) => setKeyboard(focusedByKeyboard(e.currentTarget)),
          onBlur: () => setKeyboard(false),
        }
      : {},
  };
}

export function NavArrowButton({direction, label, onClick, atEnd = false, edge = false, style}: NavArrowButtonProps) {
  const reducedMotion = usePrefersReducedMotion();
  const {grown, growthProps} = useGrowth(edge, atEnd);
  const glyph = edge ? ICON_SIZE.sm : 22;
  return (
    <CtaButton
      type="button"
      variant="filled"
      aria-label={label}
      aria-disabled={atEnd || undefined}
      onClick={atEnd ? undefined : onClick}
      {...growthProps}
      style={{...(edge ? edgeStyle(grown, reducedMotion) : ROUND), ...style}}>
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d={PATH[direction]}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </CtaButton>
  );
}
