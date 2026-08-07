import Skeleton from 'react-loading-skeleton';
import {RADIUS, SPACING} from '../../../shared/constants';
import {FRAME} from './deckFrame';
import {DECK_TILE_GAP, DECK_TILE_MIN_WIDTH} from './deckGrid';

interface DeckListSkeletonProps {
  /**
   * How many placeholders to draw. Defaults to a screenful rather than a guess at
   * the real count: guessing high makes the page shrink when the decks arrive, which
   * is the shift this exists to prevent.
   */
  count?: number;
  /** Announced while the list loads, e.g. "Loading community decks". */
  ariaLabel: string;
}

const DEFAULT_COUNT = 8;

/**
 * The `/decks` grid, drawn before its data arrives.
 *
 * Replaces a centred "Loading decks…" line. That was honest but it reflowed the page
 * on arrival: one line of text became a grid of 335px-tall cards, so the content
 * below jumped (owner, 2026-08-07 — the same defect fixed on the deck view).
 *
 * It borrows `DECK_TILE_MIN_WIDTH`, `DECK_TILE_GAP` and the frame's own aspect rather
 * than restating them, so the placeholder cannot drift from the grid it stands in for.
 *
 * No local `SkeletonTheme` — AppLayout provides the one for the whole app (#511).
 */
export function DeckListSkeleton({count = DEFAULT_COUNT, ariaLabel}: DeckListSkeletonProps) {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      data-testid="deck-list-skeleton"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${DECK_TILE_MIN_WIDTH}px, 1fr))`,
        gap: DECK_TILE_GAP,
        // Matches DeckList's own offset from the tab strip above it.
        marginTop: SPACING.lg,
      }}>
      {Array.from({length: count}, (_, i) => (
        // `aspectRatio` on the wrapper, not a fixed height: the columns are fluid, so
        // a pixel height would be right at exactly one viewport width.
        <div key={i} style={{aspectRatio: `${FRAME.aspect}`, lineHeight: 1}}>
          <Skeleton width="100%" height="100%" borderRadius={RADIUS.xl} style={{display: 'block'}} />
        </div>
      ))}
    </div>
  );
}
