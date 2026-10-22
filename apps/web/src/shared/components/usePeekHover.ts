import {useEffect, useRef, useState, type PointerEvent} from 'react';
import {SPACING} from '../constants';
import type {PeekSide} from './PrintingPeek';

/** The share of the card at each side whose hover opens the peek and whose click turns to it. */
export const PEEK_ZONE = 0.3;
/** How long a pointer rests near a side before its peek opens: passing over the card opens none. */
const HOVER_DELAY_MS = 70;

export interface PeekHover {
  side: PeekSide;
  /** The pointer's height on the card, rounded so the tag follows it in steps. */
  y: number;
}

/** The side a mouse at `e` is near, if a printing waits there: the card's outer share, or past it. */
function zoneAt(e: PointerEvent<HTMLElement>, card: {width: number; height: number}, canTurn: Record<PeekSide, boolean>): PeekHover | null {
  const rect = e.currentTarget.getBoundingClientRect();
  // The box's own size, which the window's opening scale can shrink for a moment.
  const scale = rect.width / card.width || 1;
  const x = (e.clientX - rect.left) / scale;
  const y = (e.clientY - rect.top) / scale;
  if (y < 0 || y > card.height) return null;
  const stepY = Math.round(y / SPACING.xs) * SPACING.xs;
  if (x < card.width * PEEK_ZONE && canTurn.prev) return {side: 'prev', y: stepY};
  if (x > card.width * (1 - PEEK_ZONE) && canTurn.next) return {side: 'next', y: stepY};
  return null;
}

/**
 * The side a mouse rests near, whose peek opens. A side's peek waits for the pointer to rest
 * there a moment; the tag naming it follows the pointer at once.
 */
function useRestingSide() {
  const [hover, setHover] = useState<PeekHover | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const point = (next: PeekHover | null) => {
    clearTimeout(timerRef.current);
    if (next && next.side !== hover?.side) timerRef.current = setTimeout(() => setHover(next), HOVER_DELAY_MS);
    else if (next?.y !== hover?.y) setHover(next);
  };
  return {hover, point, clear: () => point(null)};
}

interface PeekHoverInput {
  /** The card's size, in its own pixels. */
  size: {width: number; height: number};
  /** Whether a printing waits before the card, and one after it. */
  canTurn: Record<PeekSide, boolean>;
  /** A mouse or trackpad is the primary pointer (`useFinePointer`). */
  fine: boolean;
  /** Loads the printings' art. */
  reach: () => void;
}

/**
 * A mouse over a card whose printings stack behind it (`PrintingCarousel`): arriving, it loads
 * their art (`reach`); resting near a side where a printing waits, it opens that side's peek.
 * `follow` takes the card's pointer moves, and `handlers` go on the card's box.
 */
export function usePeekHover({size, canTurn, fine, reach}: PeekHoverInput) {
  const {hover, point, clear} = useRestingSide();
  const follow = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && fine) point(zoneAt(e, size, canTurn));
  };
  const onPointerEnter = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse') reach();
  };
  return {hover, clear, follow, handlers: {onPointerEnter, onPointerLeave: clear}};
}
