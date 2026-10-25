import {useEffect, useEffectEvent, type RefObject} from 'react';

interface TouchHoldOptions {
  enabled: boolean;
  /** Whether a drag has the touch: its moves are kept from the page's scroll. */
  holding: () => boolean;
}

/**
 * Whether the page can still keep a move from the scroll: one the browser has already given its
 * scroll can't be taken back, and two fingers are the browser's.
 */
const keepable = (e: TouchEvent) => e.cancelable && e.touches.length === 1;

/**
 * Keeps a drag's touch from the page's scroll. A drag that goes sideways leaves the page its
 * up-and-down scroll (`touch-action: pan-y`), and Chrome holds a touch to the way it set out, so
 * there a drag that drifts down still only drags. Safari on iOS doesn't: it starts the scroll as
 * the finger drifts down, wherever the touch set out, and the scroll's pointercancel drops the
 * drag. A touchmove whose default is prevented keeps the scroll from starting, so each one made
 * while `holding` is, with one finger down. Two fingers are the browser's to pinch or scroll, and
 * the pointercancel that follows ends the drag.
 *
 * The listener is on the element before any touch starts, and not passive, so that it can. It
 * goes on the element `ref` holds when the hook's effect runs, and moves only when `enabled`
 * changes, so that element must be rendered with the hook and stay.
 */
export function useTouchHold(ref: RefObject<HTMLElement | null>, {enabled, holding}: TouchHoldOptions) {
  const held = useEffectEvent(holding);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const onTouchMove = (e: TouchEvent) => {
      if (keepable(e) && held()) e.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMove, {passive: false});
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, [ref, enabled]);
}
