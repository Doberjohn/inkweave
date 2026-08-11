import type {CSSProperties, ReactNode} from 'react';
import {CtaButton} from '../../../shared/components';
import {blackRgba, COLORS, FONT_SIZES, RADIUS, SPACING} from '../../../shared/constants';

/**
 * The binder itself: two facing parchment pages, the ringed spine between them,
 * and the pager beneath. Presentational only — it owns how a binder LOOKS and
 * how big a card may be, and knows nothing about which cards are in it.
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
 * A page. Rows are `minmax(0, 1fr)` and each slot carries the card aspect, so
 * column width is DERIVED FROM ROW HEIGHT — the layout sizes itself from the
 * space it has rather than from a fixed card width.
 *
 * `minmax(0, 1fr)` is load-bearing, not stylistic. A bare `1fr` is
 * `minmax(auto, 1fr)`, whose auto floor is the item's min-content height, so
 * rows refuse to shrink: measured, three 249px cards overflowed a 561px page
 * instead of sizing down to fit it. That single keyword is the difference
 * between a spread that fits a 900px laptop and one that scrolls.
 */
function pageStyle(side: 'left' | 'right'): CSSProperties {
  return {
    height: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, auto)',
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
const spineStyle: CSSProperties = {
  width: SPACING.xxl,
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

/** `minHeight: 0` for the same reason as the rows: without it the slot's own
 *  min-content re-imposes the floor the row just gave up. */
const slotStyle: CSSProperties = {height: '100%', minHeight: 0, aspectRatio: `${CARD_ASPECT}`};

interface BinderSpreadProps {
  /** Absolute index of the first slot on the left page. */
  start: number;
  /**
   * Slot content for an absolute index, or null for an empty pocket. The empty
   * slot still occupies its cell: collapsing it would reflow the trailing spread
   * into a different shape from every other one.
   */
  renderSlot: (index: number) => ReactNode;
  /** Between the pager buttons. The consumer decides what is worth counting. */
  label: string;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  /** Optional line under the pager, e.g. a legend for the collection's states. */
  footnote?: ReactNode;
}

export function BinderSpread({
  start,
  renderSlot,
  label,
  onPrev,
  onNext,
  canPrev,
  canNext,
  footnote,
}: BinderSpreadProps) {
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
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          justifyContent: 'center',
          padding: `${SPACING.sm}px 32px 0`,
        }}>
        {page(start, 'left')}
        <div style={spineStyle} aria-hidden="true">
          <span style={ringStyle} />
          <span style={ringStyle} />
          <span style={ringStyle} />
        </div>
        {page(start + PER_PAGE, 'right')}
      </div>

      <nav
        aria-label="Binder pages"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: SPACING.lg,
          padding: `${SPACING.md}px 0 ${footnote ? SPACING.xs : SPACING.md}px`,
          flexShrink: 0,
        }}>
        <CtaButton variant="neutral" onClick={onPrev} disabled={!canPrev}>
          Previous
        </CtaButton>
        <span
          style={{
            color: COLORS.textMuted,
            fontSize: `${FONT_SIZES.sm}px`,
            minWidth: '26ch',
            textAlign: 'center',
          }}>
          {label}
        </span>
        <CtaButton variant="neutral" onClick={onNext} disabled={!canNext}>
          Next
        </CtaButton>
      </nav>

      {footnote && (
        <p
          style={{
            margin: 0,
            padding: `0 0 ${SPACING.md}px`,
            color: COLORS.textMuted,
            fontSize: `${FONT_SIZES.xs}px`,
            textAlign: 'center',
            flexShrink: 0,
          }}>
          {footnote}
        </p>
      )}
    </div>
  );
}
