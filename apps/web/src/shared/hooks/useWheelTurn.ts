import {useEffect, useEffectEvent, type RefObject} from 'react';

/** How far a sideways scroll, a trackpad's two-finger swipe, goes before it turns the card. */
const WHEEL_TURN_PX = 40;
/**
 * How long the wheel must rest before another swipe can turn the card: a trackpad's momentum
 * keeps scrolling for a while after the fingers lift.
 */
const WHEEL_REST_MS = 200;

interface WheelTurnOptions {
  enabled: boolean;
  /** -1 turns to the printing before, 1 to the one after. */
  onTurn: (step: -1 | 1) => void;
}

/**
 * A trackpad's two-finger swipe across the card turns it one printing, as it scrolled the strip
 * the printings sat in before they stacked behind the card (#625). The swipe stays the card's
 * at its first and last printing too: the browser would take it for Back or Forward.
 */
export function useWheelTurn(ref: RefObject<HTMLElement | null>, {enabled, onTurn}: WheelTurnOptions) {
  const turn = useEffectEvent(onTurn);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let travel = 0;
    let spent = false;
    let restTimer: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      clearTimeout(restTimer);
      restTimer = setTimeout(() => {
        travel = 0;
        spent = false;
      }, WHEEL_REST_MS);
      if (spent) return;
      // A mouse's tilt wheel scrolls by lines, each enough on its own.
      travel += e.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? e.deltaX : Math.sign(e.deltaX) * WHEEL_TURN_PX;
      if (Math.abs(travel) < WHEEL_TURN_PX) return;
      spent = true;
      turn(travel > 0 ? 1 : -1);
    };
    // Not passive, so the swipe can be kept from the browser's history gesture.
    el.addEventListener('wheel', onWheel, {passive: false});
    return () => {
      el.removeEventListener('wheel', onWheel);
      clearTimeout(restTimer);
    };
  }, [ref, enabled]);
}
