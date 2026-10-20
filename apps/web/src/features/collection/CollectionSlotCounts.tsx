import type {MouseEvent} from 'react';
import {QuantityStepper} from '../../shared/components';
import type {CollectionEntry, Finish} from './collectionParser';
import {SPACING} from '../../shared/constants';

/**
 * What a binder slot holds, per finish: pills at rest (owner, 2026-10-07), opened into
 * steppers while a mouse points at the pocket (#826, option A of
 * `public/mockups/collection-counts.html`).
 *
 * THE LOOK IS THE SPIKE'S RESTING PILL, deliberately: `QuantityStepper` in its
 * `collapsed` mode, where the − and + have zero width, `tabIndex -1` and
 * `aria-hidden`, so nothing here is focusable or clickable at rest. Reusing it rather
 * than drawing a badge keeps the owner-approved surface (normal on the dark ground,
 * foil on `FOIL_SHEEN`'s brushed gold), and editing came back by un-collapsing the
 * same control instead of replacing this one.
 *
 * AT REST ONLY FINISHES YOU HOLD ARE SHOWN, and an unowned slot shows nothing. The
 * card's own greyscale already says "you do not have this", so a `0` pair on every
 * unowned card would only repeat it, 48 times on a sparse spread.
 *
 * POINTED AT, every finish the card is printed in opens into − count +: an unheld one
 * at 0, so a first copy is one click, and the Foil one alone for Enchanted, Epic and
 * Iconic (owner, 2026-10-19). Only the − and + take the pointer, so a click anywhere
 * else on the card, its counts included, still opens its window. They stay out of the
 * Tab order, which keeps a spread one Tab stop (#790): the card window's "Your copies"
 * is the keyboard's way in.
 *
 * WHERE THE PAIR DOES NOT FIT, IT STACKS (owner, 2026-10-20): opened, the two pills take
 * 110px, and a 1440px screen's pockets are 84px wide, so Foil wraps under Normal there,
 * inside the pocket, while a 1920px screen's 144px pockets keep them side by side. On a
 * 1280px screen's 64px pockets the stack covers the card's middle, which is why a click
 * on a count still reaches the card.
 *
 * The finish is the background, not a letter (owner, 2026-08-14); the words
 * survive only in the aria-label, where they cost no pixels.
 */

const FINISHES: Finish[] = ['normal', 'foil'];

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
  /** Set while a mouse points at the pocket and its counts can change: the pills open. */
  editor?: SlotCountsEditor;
}

/** The finishes on show: at rest those held; pointed at, every one the card is printed in. */
function shownFinishes(counts: CollectionEntry, editor: SlotCountsEditor | undefined): Finish[] {
  if (editor === undefined) return FINISHES.filter((finish) => counts[finish] > 0);
  return editor.foilOnly ? ['foil'] : FINISHES;
}

export function CollectionSlotCounts({counts, editor}: CollectionSlotCountsProps) {
  const shown = shownFinishes(counts, editor);
  if (shown.length === 0) return null;
  return (
    <div
      role="group"
      aria-label={shown.map((finish) => `${counts[finish]} ${finish}`).join(', ')}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: SPACING.xxs,
        display: 'flex',
        // Only an opened pair is ever wider than its pocket. It wraps within the first
        // frames of the steppers' snappy open, so the stack reads as part of opening.
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xxs,
        zIndex: 3,
        // A click anywhere but an open − or + reaches the card, which opens its window:
        // the counts too, which a stacked pair lays over a narrow card's middle.
        pointerEvents: 'none',
      }}>
      {shown.map((finish) => (
        <SlotPill key={finish} finish={finish} count={counts[finish]} editor={editor} />
      ))}
    </div>
  );
}

/**
 * A click on a − or + leaves the focus where it was. A mouse click focuses even a button out
 * of the Tab order, and there the focus would sit inside `aria-hidden`, with the next Tab
 * starting from it rather than from the spread's one stop (#790).
 */
const keepFocus = (e: MouseEvent) => e.preventDefault();

interface SlotPillProps {
  finish: Finish;
  count: number;
  editor: SlotCountsEditor | undefined;
}

/** One finish's pill: its count at rest, − count + while the pocket is pointed at. */
function SlotPill({finish, count, editor}: SlotPillProps) {
  const open = editor !== undefined;
  return (
    // The group carries the label. Each pill's own would announce its hidden − and + a
    // second time.
    <span aria-hidden="true" onMouseDown={keepFocus}>
      <QuantityStepper
        value={count}
        size="xs"
        collapsed={!open}
        tabbable={false}
        tone={finish === 'foil' ? 'foil' : 'default'}
        label={finish}
        // The pointed-at foil pill sweeps its light band; the resting ones stay parked.
        shimmer={open}
        decrementDisabled={count === 0}
        onIncrement={() => editor?.onChange(finish, count + 1)}
        onDecrement={() => editor?.onChange(finish, count - 1)}
      />
    </span>
  );
}
