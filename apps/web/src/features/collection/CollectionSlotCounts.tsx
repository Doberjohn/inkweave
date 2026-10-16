import {QuantityStepper} from '../../shared/components';
import type {CollectionEntry, Finish} from './collectionParser';
import {SPACING} from '../../shared/constants';

/**
 * What a binder slot holds, per finish: READ-ONLY (owner, 2026-10-07).
 *
 * The 2026-08-14 spike made these editable steppers, but its edits were never
 * saved and two resting variants (`zeros` / `plus`) were never chosen between.
 * Phase C ships the counts alone; editing returns with its own write path. Until
 * then a collection changes by re-importing, which is the one write that exists.
 *
 * THE LOOK IS THE SPIKE'S RESTING PILL, deliberately: `QuantityStepper` in its
 * `collapsed` mode, where the − and + have zero width, `tabIndex -1` and
 * `aria-hidden`, so nothing here is focusable or clickable. Reusing it rather
 * than drawing a badge keeps the owner-approved surface (normal on the dark
 * ground, foil on `FOIL_SHEEN`'s brushed gold) and lets editing come back by
 * un-collapsing the same control instead of replacing this one.
 *
 * ONLY FINISHES YOU HOLD ARE SHOWN, and an unowned slot shows nothing. The
 * card's own greyscale already says "you do not have this", so a `0` pair on
 * every unowned card would only repeat it, 48 times on a sparse spread.
 *
 * The finish is the background, not a letter (owner, 2026-08-14); the words
 * survive only in the aria-label, where they cost no pixels.
 */

const FINISHES: Finish[] = ['normal', 'foil'];

interface CollectionSlotCountsProps {
  /** The parser's own type, not a parallel one: a third finish must land once. */
  counts: CollectionEntry;
}

const NOOP = () => {};

export function CollectionSlotCounts({counts}: CollectionSlotCountsProps) {
  const held = FINISHES.filter((finish) => counts[finish] > 0);
  if (held.length === 0) return null;
  return (
    <div
      role="group"
      aria-label={held.map((finish) => `${counts[finish]} ${finish}`).join(', ')}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: SPACING.xxs,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xxs,
        zIndex: 3,
        // Read-only: a click on the counts reaches the card, which opens its modal.
        pointerEvents: 'none',
      }}>
      {held.map((finish) => (
        // The group carries the label. Each pill's own would announce its hidden
        // − and + controls a second time.
        <span key={finish} aria-hidden="true">
          <QuantityStepper
            value={counts[finish]}
            size="xs"
            collapsed
            tone={finish === 'foil' ? 'foil' : 'default'}
            shimmer={false}
            onIncrement={NOOP}
            onDecrement={NOOP}
          />
        </span>
      ))}
    </div>
  );
}
