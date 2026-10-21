import type {MouseEvent} from 'react';
import {CopiesStripe} from '../../shared/components';
import type {CollectionEntry, Finish} from './collectionParser';

/**
 * What a binder slot holds, per finish: a stripe across the card's foot (owner, 2026-10-20:
 * the pills went), black like the card's own bottom bar, normal copies on the left and foil
 * on the right in brushed gold (`CopiesStripe`).
 *
 * AT REST ONLY FINISHES YOU HOLD ARE SHOWN, each its count, side by side at the middle, and an
 * unowned slot shows nothing. The card's own greyscale already says "you do not have this",
 * so a `0` pair on every unowned card would only repeat it, 48 times on a sparse spread.
 *
 * POINTED AT, THE STRIPE OPENS FROM THE MIDDLE TO THE CARD'S EDGES, as the pills opened: every
 * finish the card is printed in takes its half, − count +, an unheld one at 0, so a first copy
 * is one click, and Foil alone takes the whole stripe for Enchanted, Epic and Iconic (owner,
 * 2026-10-19). A narrower pocket draws the stripe smaller, scaled with its card (owner,
 * 2026-10-20). The open stripe takes every press on the card's foot, between and around its
 * buttons too (owner, 2026-10-20), so only a press above it opens the card's window. The
 * − and + stay out of the Tab order, which keeps a spread one Tab stop (#790): the keyboard
 * changes a count in the card window's stripe (`WindowCopies`).
 *
 * The finish is the background, not a letter (owner, 2026-08-14); the words survive only in
 * the aria-label, where they cost no pixels.
 */

const FINISHES: Finish[] = ['normal', 'foil'];
const FOIL_ONLY: Finish[] = ['foil'];

/** A pocket a mouse points at, whose counts can change (#826). */
export interface SlotCountsEditor {
  /** Printed only in foil (Enchanted, Epic, Iconic): only the Foil count opens. */
  foilOnly: boolean;
  /** Set one finish's count. Never asked for less than 0: the − is disabled at 0. */
  onChange: (finish: Finish, count: number) => void;
}

interface CollectionSlotCountsProps {
  /** The parser's own type, not a parallel one: a third finish must land once. */
  counts: CollectionEntry;
  /** Set while a mouse points at the pocket and its counts can change: the stripe opens. */
  editor?: SlotCountsEditor;
}

/**
 * A click on a − or + leaves the focus where it was. A mouse click focuses even a button out
 * of the Tab order, and there the focus would sit inside `aria-hidden`, with the next Tab
 * starting from it rather than from the spread's one stop (#790).
 */
const keepFocus = (e: MouseEvent) => e.preventDefault();

export function CollectionSlotCounts({counts, editor}: CollectionSlotCountsProps) {
  const open = editor !== undefined;
  // The stripe holds every finish the card is printed in, at rest too, so an unheld one can
  // open out of the middle rather than appear: there it is no width at all.
  const printed = editor?.foilOnly ? FOIL_ONLY : FINISHES;
  const named = open ? printed : printed.filter((finish) => counts[finish] > 0);
  return (
    <div
      role={named.length > 0 ? 'group' : undefined}
      aria-label={named.length > 0 ? named.map((finish) => `${counts[finish]} ${finish}`).join(', ') : undefined}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 3,
        // Open, the card's foot is the stripe's (owner, 2026-10-20): no press there reaches the
        // card. Closed, a tap on a count opens the card.
        pointerEvents: open ? 'auto' : 'none',
      }}>
      {/*
        The group carries the label. The stripe's own buttons would announce it a second time.
        Edge to edge across the card's foot (owner, 2026-10-20: inset inside the tile's hover
        ring, the card's edge showed round it as gaps), over the ring's lowest stretch.
      */}
      <div aria-hidden="true" onMouseDown={keepFocus}>
        <CopiesStripe
          open={open}
          tabbable={false}
          parts={printed.map((finish) => ({
            label: finish,
            count: counts[finish],
            tone: finish === 'foil' ? 'foil' : 'default',
            onChange: (count: number) => editor?.onChange(finish, count),
          }))}
        />
      </div>
    </div>
  );
}
