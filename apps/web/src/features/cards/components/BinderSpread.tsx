import {useRef, type CSSProperties, type ReactNode} from 'react';
import {NavArrowButton} from '../../../shared/components';
import {useContainerWidth} from '../../../shared/hooks/useContainerWidth';
import {blackRgba, COLORS, RADIUS, SPACING} from '../../../shared/constants';

/**
 * The binder itself: two facing parchment pages, the ringed spine between them,
 * and a page arrow on each side. Presentational only — it owns how a binder
 * LOOKS and how big a card may be, and knows nothing about which cards are in it.
 *
 * NO CAPTION, NO LABEL, NO LEGEND (owner, 2026-08-14). The legend under the
 * spread went the same way as the pager row above it: the binder is height-driven,
 * so every band of chrome comes straight out of the card size, and a spread of
 * real cards explains itself better than a sentence about it does.
 *
 * THE ARROWS FLANK THE SPREAD (owner, 2026-08-14), replacing a Previous/Next row
 * with a "Spread 3 of 9" label beneath it. Turning a page is a gesture at the
 * edge of the page, not a button in a control strip; the row also spent vertical
 * space, and the binder is height-driven, so every pixel it took came off the
 * cards. The count it carried is coming back as part of the stats design.
 *
 * THE SEAM IS CHROME VS FILL, because the app has two binders that want opposite
 * fills from identical chrome. Browse COMPACTS (results flow into spreads, so 36
 * matches is 2 full spreads and gaps never appear), while the collection binder
 * holds FIXED SLOTS and dims in place, because "what am I missing?" is only
 * answerable if a card never moves. Folding those together behind a flag would
 * put two contradictory rules in one component; folding the chrome out shares
 * everything they genuinely have in common.
 */

/** Four columns x three rows, per page. A spread is two of these. */
export const PER_PAGE = 12;
export const PER_SPREAD = PER_PAGE * 2;

/** Lorcana cards are 0.72 wide-to-tall. Drives the whole layout. */
const CARD_ASPECT = 0.72;

const PARCHMENT = '/art/backgrounds/binder.webp';

/**
 * A page. Both axes are `minmax(0, 1fr)`, so the grid claims exactly the box it
 * is given and each slot fits the card aspect INSIDE its cell — the layout sizes
 * itself from the space it has rather than from a fixed card width.
 *
 * `minmax(0, 1fr)` is load-bearing on both axes, not stylistic. A bare `1fr` is
 * `minmax(auto, 1fr)`, whose auto floor is the item's min-content size, so tracks
 * refuse to shrink: measured, three 249px cards overflowed a 561px page instead
 * of sizing down to fit it.
 *
 * COLUMNS WERE `auto` UNTIL 2026-08-14, which made width derive from height with
 * no width constraint at all. On a tall window that is unbounded: measured on
 * /browse?view=binder the spread ran 88px past the viewport at 1440x900, 47px at
 * 2560x1440 and 588px at 1400x1400. Nobody noticed while the pager was a row
 * underneath, because the casualty was a clipped card edge; the moment the page
 * arrows moved beside the spread the casualty became the navigation itself,
 * pushed off-screen. `minmax(0, 1fr)` on the columns is what bounds it.
 */
function pageStyle(side: 'left' | 'right'): CSSProperties {
  return {
    height: '100%',
    // A page HUGS ITS CARDS, and that is safe only because the slots are sized
    // from the row height (see `slotStyle`), which is definite. It was briefly
    // `flex: 1 1 0` while the slots were width-driven, and the pages then filled
    // the row while the cards stayed height-bound — measured at 1920x855, 864px
    // pages holding 128px cards, so every pocket carried 88px of slack and the
    // spread read as a loose grid rather than a binder.
    //
    // The trap that forced that detour: with width-driven slots a page's width
    // came from the card IMAGES' intrinsic size, so a page turn collapsed both
    // pages from 642px to 48px until they decoded. Height-driven slots have no
    // such dependency — the width is derived from a definite row height and is
    // identical at zero images loaded and at twenty-four.
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gridTemplateRows: `repeat(3, minmax(0, 1fr))`,
    gap: SPACING.sm,
    padding: SPACING.md,
    justifyContent: 'center',
    backgroundImage: `url(${PARCHMENT})`,
    backgroundSize: 'cover',
    // Mirrored, so the two sheets are not visibly the same image. One
    // spread-wide copy would run a single contour line through the gutter.
    backgroundPosition: side === 'left' ? 'left center' : 'right center',
    borderRadius:
      side === 'left'
        ? `${RADIUS.card}px ${RADIUS.sm}px ${RADIUS.sm}px ${RADIUS.card}px`
        : `${RADIUS.sm}px ${RADIUS.card}px ${RADIUS.card}px ${RADIUS.sm}px`,
  };
}

/**
 * The spine. Wide enough to hold hardware, because a bare gap reads as two
 * separate panels rather than one bound object. Rings are the most legible
 * signal of "binder" and survive at any spread height, where stitching or a
 * leather texture would compete with the parchment and need its own asset.
 */
const SPINE_WIDTH = SPACING.xxl;
const ARROW_WIDTH = 44;

const spineStyle: CSSProperties = {
  width: SPINE_WIDTH,
  background: COLORS.background,
  alignSelf: 'stretch',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-evenly',
  alignItems: 'center',
  // Inner shadow on both page edges: the pages fall away into the gutter, which
  // is what makes it a valley rather than a painted stripe.
  boxShadow: `inset 6px 0 8px -6px ${blackRgba(0.85)}, inset -6px 0 8px -6px ${blackRgba(0.85)}`,
};

/**
 * One ring. An open pill rather than a filled dot — a ring is read by its hole,
 * and a solid circle reads as a rivet. The asymmetric border is what stops a
 * flat outline from looking like a drawn oval instead of metal.
 */
const ringStyle: CSSProperties = {
  width: 14,
  height: 22,
  borderRadius: `${RADIUS.pill}px`,
  border: `2px solid ${COLORS.gray400}`,
  borderRightColor: COLORS.gray300,
  borderBottomColor: COLORS.gray300,
  boxShadow: `0 1px 2px ${blackRgba(0.6)}`,
};

/**
 * A card-shaped box, sized from its row's height.
 *
 * HEIGHT IS THE FIXED AXIS and the width follows, which only works because the
 * row height is definite — `minHeight: 0` is what stops the slot's own
 * min-content re-imposing the floor the row just gave up.
 *
 * A version sized from WIDTH (`width: 100%` + `maxHeight: 100%`) was tried on
 * 2026-08-14 and reverted the same day. It looks like it fits both axes and does
 * not: `max-height` clamps the height but `aspect-ratio` does NOT re-derive the
 * width from the clamp, so on a short window the slot rendered 208x221 — ratio
 * 0.94 against a card's 0.72 — and the art overflowed into the row below. Fitting
 * BOTH axes is not expressible this way; that is what `spreadMaxHeight` is for.
 *
 * `margin: auto` centres the card when its column is wider than the card, which
 * happens whenever the pages have more width than the height budget can spend.
 */
const slotStyle: CSSProperties = {
  height: '100%',
  minHeight: 0,
  margin: 'auto',
  aspectRatio: `${CARD_ASPECT}`,
};

/**
 * The tallest the spread may be before its DERIVED width stops fitting `width`.
 *
 * The layout sizes cards from height, so height is the only knob; capping it is
 * what keeps a tall, narrow window from producing a spread wider than itself.
 * Measured against the real page before this existed: 88px past the viewport at
 * 1440x900, 47px at 2560x1440, 588px at 1400x1400.
 *
 * Solved in JS rather than CSS on purpose. The constraint is `min()` of two
 * axes with different constants on each, and neither `aspect-ratio` nor
 * `max-*` can express it — every CSS attempt distorted the box instead of
 * shrinking it.
 */
function spreadMaxHeight(width: number): number | undefined {
  if (width <= 0) return undefined;
  // Everything the eight cards do NOT get: two arrows, their gaps, the row's
  // own padding, the spine, and each page's padding and column gaps.
  const chrome = 2 * ARROW_WIDTH + 3 * SPACING.sm + SPINE_WIDTH + 2 * (2 * SPACING.md + 3 * SPACING.sm);
  const cardWidth = (width - chrome) / 8;
  if (cardWidth <= 0) return undefined;
  const cardHeight = cardWidth / CARD_ASPECT;
  // Three rows, two row gaps, and the page's own vertical padding.
  return 3 * cardHeight + 2 * SPACING.sm + 2 * SPACING.md;
}


/**
 * A card-shaped shimmer for one slot, so a binder that is still loading has the
 * SAME geometry as one that is not — the spread's chrome is rendered either way
 * and only the slot contents differ, which is what makes the swap shift-free.
 *
 * Uses the house `inkweave-shimmer-tile` class (one keyframe, one
 * reduced-motion override) rather than a second skeleton recipe.
 */
export function BinderSlotSkeleton() {
  return (
    <div
      className="inkweave-shimmer-tile"
      style={{
        borderRadius: `${RADIUS.sm}px`,
        background: `linear-gradient(110deg, ${COLORS.surfaceAlt} 0%, ${COLORS.surfaceHover} 50%, ${COLORS.surfaceAlt} 100%)`,
      }}
    />
  );
}

interface BinderSpreadProps {
  /** Absolute index of the first slot on the left page. */
  start: number;
  /**
   * Slot content for an absolute index, or null for an empty pocket. The empty
   * slot still occupies its cell: collapsing it would reflow the trailing spread
   * into a different shape from every other one.
   */
  renderSlot: (index: number) => ReactNode;
    onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}

export function BinderSpread({
  start,
  renderSlot,
  onPrev,
  onNext,
  canPrev,
  canNext,
}: BinderSpreadProps) {
  const rowRef = useRef<HTMLElement>(null);
  const maxHeight = spreadMaxHeight(useContainerWidth(rowRef));

  const page = (from: number, side: 'left' | 'right') => (
    <section className="binder-page" style={pageStyle(side)} aria-label={`${side} page`}>
      {Array.from({length: PER_PAGE}, (_, i) => (
        <div key={from + i} style={slotStyle}>
          {renderSlot(from + i)}
        </div>
      ))}
    </section>
  );

  return (
    <div style={{height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0}}>
      {/*
        The arrows are FLEX SIBLINGS of the pages, not an overlay. Overlaying
        them was tried and reverted the same hour: the spread's width is derived
        from its height, so on a tall window it is wider than the viewport, and
        absolutely-positioned arrows landed 80-580px inside the cards. Laid out
        in the row they are beside the pages at every size by construction.
      */}
      <nav
        ref={rowRef}
        aria-label="Binder pages"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: SPACING.sm,
          padding: `${SPACING.sm}px ${SPACING.sm}px 0`,
        }}>
        <NavArrowButton
          direction="prev"
          label="Previous spread"
          onClick={onPrev}
          disabled={!canPrev}
        />
        {/*
          The cap lives on this inner box, NOT on the nav. The nav keeps `flex: 1`
          and therefore a constant height, so the footnote below it never moves —
          which matters because the cap arrives one frame late (ResizeObserver
          runs after first paint). On the nav itself that late arrival shrank the
          row from 700px to 669px and scored a 0.036 layout shift; here the same
          measurement only re-centres content inside a box that never changed.
        */}
        <div
          style={{
            flex: '1 1 0',
            minWidth: 0,
            height: '100%',
            maxHeight,
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'center',
          }}>
          {page(start, 'left')}
          <div style={spineStyle} aria-hidden="true">
            <span style={ringStyle} />
            <span style={ringStyle} />
            <span style={ringStyle} />
          </div>
          {page(start + PER_PAGE, 'right')}
        </div>
        <NavArrowButton direction="next" label="Next spread" onClick={onNext} disabled={!canNext} />
      </nav>
    </div>
  );
}
