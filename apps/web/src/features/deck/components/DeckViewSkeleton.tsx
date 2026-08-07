import Skeleton from 'react-loading-skeleton';
import {ICON_SIZE, RADIUS, SPACING, TOUCH_TARGET} from '../../../shared/constants';
import {DECK_GRID_COLUMN, DECK_GRID_GAP} from './DeckCardGrid';

/**
 * How many placeholder cards to draw.
 *
 * A real deck is 18-22 distinct cards; twelve fills the fold at every width without
 * pretending to know the count. Guessing high would make the page shrink when the
 * deck arrives, which is the shift this exists to prevent.
 */
const PLACEHOLDER_CARDS = 12;

/** A Lorcana card is 734x1024, and the grid's tiles hold that ratio. */
const CARD_ASPECT = 0.7168;

/**
 * The deck view's shape, drawn before its data arrives.
 *
 * Replaces a centred "Loading deck…" line. That was honest but it reflowed the whole
 * page on arrival: one line of text became a heading, a grid and a scrollbar, so the
 * page visibly jumped (owner, 2026-08-07). This holds the same boxes in the same
 * places, so the deck fades in rather than pushing the layout around.
 *
 * It borrows the grid's OWN column and gap constants rather than restating them.
 * A skeleton that drifts from the thing it stands in for is worse than no skeleton:
 * it promises a layout and then delivers a different one.
 *
 * No local `SkeletonTheme` — AppLayout provides the one for the whole app (#511).
 */
export function DeckViewSkeleton() {
  return (
    <div aria-hidden data-testid="deck-view-skeleton">
      {/* Heading row: name, two ink symbols, the count, and the owner's action. */}
      {/*
        `minHeight` and `lineHeight: 1` both matter. react-loading-skeleton renders
        inline spans, so without them the row inherits descender space the real
        header does not have — measured, that alone moved the grid 4px.
      */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACING.md,
          minHeight: TOUCH_TARGET,
          lineHeight: 1,
        }}>
        <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm}}>
          {/* 24, not a round 28: MEASURED against the real h1 line box, which is what
              decides whether the grid below moves when the deck arrives. */}
          <Skeleton width={220} height={24} borderRadius={RADIUS.sm} />
          <Skeleton circle width={ICON_SIZE.md} height={ICON_SIZE.md} />
          <Skeleton circle width={ICON_SIZE.md} height={ICON_SIZE.md} />
          <Skeleton width={64} height={18} borderRadius={RADIUS.sm} />
        </div>
        <Skeleton width={112} height={TOUCH_TARGET} borderRadius={RADIUS.lg} />
      </div>

      <div
        style={{
          marginTop: SPACING.xxl,
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${DECK_GRID_COLUMN}px, 1fr))`,
          gap: DECK_GRID_GAP,
        }}>
        {Array.from({length: PLACEHOLDER_CARDS}, (_, i) => (
          // `aspectRatio` on the wrapper rather than a fixed height: the columns are
          // fluid, so a pixel height would be right at exactly one viewport width.
          <div key={i} style={{aspectRatio: `${CARD_ASPECT}`}}>
            <Skeleton width="100%" height="100%" borderRadius={RADIUS.xl} style={{display: 'block'}} />
          </div>
        ))}
      </div>
    </div>
  );
}
