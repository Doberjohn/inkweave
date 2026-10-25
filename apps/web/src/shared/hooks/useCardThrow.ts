import {useRef, useState, type MouseEvent, type PointerEvent, type RefObject} from 'react';
import {useTouchHold} from './useTouchHold';

/** How far, in the card's own pixels, a pointer moves across before it drags the card. */
const DRAG_START_PX = 6;
/** How far a touch or a pen may move down first before the page's scroll takes it instead. */
const SCROLL_FIRST_PX = 10;
/** The share of the card's width a drag must pass to throw the card. */
const THROW_SHARE = 0.22;
/** The pointer's speed, in px per ms, that throws the card however short the drag. */
const FLICK_SPEED = 0.4;
/** The span of the drag's latest moves that its speed is read over. */
const FLICK_WINDOW_MS = 90;

/** -1 throws the card to the printing before it, 1 to the one after. */
export type ThrowStep = -1 | 1;

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  /** The card's offset, in its own pixels. */
  dx: number;
  /** The latest moves' times and positions, and the release's, for its speed. */
  samples: Array<[time: number, x: number]>;
}

interface CardThrowOptions {
  /** The card's width, in its own pixels. */
  width: number;
  enabled: boolean;
  /** A drag let go far enough, or fast enough. */
  onThrow: (step: ThrowStep) => void;
}

/** The card's scale on screen, which the window's opening animation shrinks for a moment. */
function scaleOf(el: Element, width: number): number {
  return el.getBoundingClientRect().width / width || 1;
}

/**
 * A drag's start: across far enough drags the card. A touch or a pen that moves down first is the
 * page's scroll; a mouse never scrolls the page by dragging, so its press waits to go across.
 */
function dragStart(dx: number, dy: number, pointerType: string): 'drag' | 'wait' | 'scroll' {
  if (pointerType !== 'mouse' && Math.abs(dy) > SCROLL_FIRST_PX && Math.abs(dy) > Math.abs(dx)) return 'scroll';
  return Math.abs(dx) < DRAG_START_PX ? 'wait' : 'drag';
}

function stepOf(dx: number): ThrowStep {
  return dx < 0 ? 1 : -1;
}

/** A drag from where `e` presses. A mouse's other buttons drag nothing. */
function dragFrom(e: PointerEvent<HTMLElement>): Drag | null {
  if (e.pointerType === 'mouse' && e.button !== 0) return null;
  return {pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, dx: 0, samples: [[e.timeStamp, e.clientX]]};
}

/** The drag under way, if `e` is its pointer's. */
function dragOf(drag: Drag | null, e: PointerEvent<HTMLElement>): Drag | null {
  return drag?.pointerId === e.pointerId ? drag : null;
}

/**
 * A drag's first moves: across far enough, it takes the pointer and the card follows; a touch's
 * down first is the page's scroll's. Capture keeps a mouse dragging past the card's edge.
 */
function begin(drag: Drag, e: PointerEvent<HTMLElement>, scale: number): 'drag' | 'wait' | 'scroll' {
  const start = dragStart((e.clientX - drag.startX) / scale, (e.clientY - drag.startY) / scale, e.pointerType);
  if (start !== 'drag') return start;
  drag.moved = true;
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    // Without it the drag still turns the card; it ends at the card's edge.
  }
  return start;
}

/** Notes the drag's move, or its release, keeping only the latest for the release's speed. */
function sample(drag: Drag, e: PointerEvent<HTMLElement>) {
  drag.samples.push([e.timeStamp, e.clientX]);
  while (drag.samples.length > 2 && e.timeStamp - drag.samples[0][0] > FLICK_WINDOW_MS) drag.samples.shift();
}

/** Whether a drag let go turns the card: past a share of its width, or flicked its way. */
function thrown(drag: Drag, width: number, scale: number): boolean {
  const [t0, x0] = drag.samples[0];
  const [t1, x1] = drag.samples[drag.samples.length - 1];
  const speed = t1 > t0 ? (x1 - x0) / scale / (t1 - t0) : 0;
  const flick = Math.abs(speed) > FLICK_SPEED && Math.sign(speed) === Math.sign(drag.dx);
  return flick || Math.abs(drag.dx) > width * THROW_SHARE;
}

/**
 * A card thrown aside by hand, a finger or a mouse (owner, 2026-10-22: the printings stack
 * behind the card, and a swipe turns it as on a phone). The card follows the drag, and a drag
 * let go past a fifth of the card, or flicked, throws it; anything less springs back, and so does
 * a drag that rests before it is let go. A touch that moves down first is left to the page's
 * scroll (the caller's `touch-action: pan-y`), and once the card follows a finger the touch is
 * the card's (`useTouchHold`): on an iPhone a drift down would scroll the page and drop the card.
 *
 * `dx` is the drag's offset in the card's own pixels, null when none is under way. Spread
 * `handlers` on the card's box, the element `ref` holds: they also swallow the click a drag ends
 * with, which would otherwise enlarge the card or turn a peek.
 */
export function useCardThrow(ref: RefObject<HTMLElement | null>, {width, enabled, onThrow}: CardThrowOptions) {
  const dragRef = useRef<Drag | null>(null);
  const swallowClickRef = useRef(false);
  const [dx, setDx] = useState<number | null>(null);
  useTouchHold(ref, {enabled, holding: () => dragRef.current?.moved === true});

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    swallowClickRef.current = false;
    if (enabled) dragRef.current = dragFrom(e);
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const drag = dragOf(dragRef.current, e);
    if (!drag) return;
    const scale = scaleOf(e.currentTarget, width);
    if (!drag.moved) {
      const start = begin(drag, e, scale);
      if (start === 'scroll') dragRef.current = null;
      if (start !== 'drag') return;
    }
    drag.dx = (e.clientX - drag.startX) / scale;
    sample(drag, e);
    setDx(drag.dx);
  };

  const release = (e: PointerEvent<HTMLElement>, cancelled: boolean) => {
    const drag = dragOf(dragRef.current, e);
    if (!drag) return;
    dragRef.current = null;
    if (!drag.moved) return;
    swallowClickRef.current = true;
    setDx(null);
    if (cancelled) return;
    // The release's own moment: a drag that rested before it was let go has no speed left.
    sample(drag, e);
    if (thrown(drag, width, scaleOf(e.currentTarget, width))) onThrow(stepOf(drag.dx));
  };

  const onClickCapture = (e: MouseEvent<HTMLElement>) => {
    if (!swallowClickRef.current) return;
    swallowClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return {
    dx,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: PointerEvent<HTMLElement>) => release(e, false),
      onPointerCancel: (e: PointerEvent<HTMLElement>) => release(e, true),
      onClickCapture,
    },
  };
}
