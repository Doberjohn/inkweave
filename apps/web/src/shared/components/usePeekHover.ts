import {useEffect, useRef, useState, type PointerEvent} from 'react';
import type {PeekSide} from './PrintingPeek';

/** The share of the card at each side whose hover opens the peek and whose click turns to it. */
export const PEEK_ZONE = 0.3;
/** How long a pointer rests near a side before its peek opens: passing over the card opens none. */
const HOVER_DELAY_MS = 70;

/** The side a mouse at `e` is near: the card's outer share, or past it. */
function zoneAt(e: PointerEvent<HTMLElement>, card: {width: number; height: number}): PeekSide | null {
  const rect = e.currentTarget.getBoundingClientRect();
  // The box's own size, which the window's opening scale can shrink for a moment.
  const scale = rect.width / card.width || 1;
  const x = (e.clientX - rect.left) / scale;
  const y = (e.clientY - rect.top) / scale;
  if (y < 0 || y > card.height) return null;
  if (x < card.width * PEEK_ZONE) return 'prev';
  return x > card.width * (1 - PEEK_ZONE) ? 'next' : null;
}

/** The side a mouse rests near, whose peek opens once the pointer has rested there a moment. */
function useRestingSide() {
  const [hover, setHover] = useState<PeekSide | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const point = (next: PeekSide | null) => {
    clearTimeout(timerRef.current);
    if (next === null) setHover(null);
    else if (next !== hover) timerRef.current = setTimeout(() => setHover(next), HOVER_DELAY_MS);
  };
  return {hover, point, clear: () => point(null)};
}

interface PeekHoverInput {
  /** The card's size, in its own pixels. */
  size: {width: number; height: number};
  /** Whether the card turns: two printings or more, and not held still. */
  turnable: boolean;
  /** A mouse or trackpad is the primary pointer (`useFinePointer`). */
  fine: boolean;
  /** Loads the printings' art. */
  reach: () => void;
}

/**
 * A mouse over a card whose printings stack behind it (`PrintingCarousel`): arriving, it loads
 * their art (`reach`); resting near a side of a card that turns, it opens that side's peek.
 * `follow` takes the card's pointer moves, and `handlers` go on the card's box.
 */
export function usePeekHover({size, turnable, fine, reach}: PeekHoverInput) {
  const {hover, point, clear} = useRestingSide();
  // Only a mouse or a trackpad hovers, and only a card that turns has printings to peek at: a
  // card that stops turning under the mouse (a comparison holds it) lets its peek go.
  const peeks = fine && turnable;
  const follow = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse') point(peeks ? zoneAt(e, size) : null);
  };
  const onPointerEnter = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse') reach();
  };
  return {hover, clear, follow, handlers: {onPointerEnter, onPointerLeave: clear}};
}
