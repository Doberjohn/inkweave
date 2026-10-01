import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {prefersReducedMotion} from '../utils/prefersReducedMotion';

/** Which slide the scroll-snap viewport is centered on, or null if it has no width yet. */
function indexFromScroll(root: HTMLElement): number | null {
  const width = root.clientWidth;
  if (!width) return null;
  return Math.round(root.scrollLeft / width);
}

/** Input that moves the strip itself, taking over from a `scrollToIndex` still in flight. */
const TAKE_OVER_EVENTS = ['touchstart', 'wheel', 'keydown'] as const;

/** Where a browser lacks `scrollend`, the strip is at rest once scroll events stop this long. */
const SETTLE_QUIET_MS = 150;

/**
 * Calls `onRest` each time the strip stops moving. Chrome, Firefox and Safari 26.2+ fire
 * `scrollend` once a scroll is over: the gesture ended (every finger up, or the trackpad
 * released) and any fling or snap finished. Older Safari lacks it, so there a pause of
 * SETTLE_QUIET_MS in scroll events with no finger down stands in. Only there: a trackpad
 * swipe held mid-way pauses the events too, with no finger to tell, and one of its touches
 * can fail to report its end (a touch whose element left the page no longer reaches the
 * strip), which is why `scrollend` never waits on `touching`. A lift also counts, so a tap
 * that moved nothing still ends. Returns the cleanup.
 */
function watchForRest(root: HTMLElement, onRest: () => void): () => void {
  const pauseMeansRest = !('onscrollend' in window);
  let touching = false;
  let quiet: ReturnType<typeof setTimeout> | undefined;
  const rest = () => {
    clearTimeout(quiet);
    onRest();
  };
  const restAfterPause = () => {
    clearTimeout(quiet);
    quiet = setTimeout(() => {
      if (!touching) onRest();
    }, SETTLE_QUIET_MS);
  };
  const scrolled = () => {
    if (pauseMeansRest) restAfterPause();
    else clearTimeout(quiet);
  };
  const press = () => {
    touching = true;
  };
  const lift = (e: Event) => {
    touching = (e as TouchEvent).touches.length > 0;
    restAfterPause();
  };
  const listeners: [string, (e: Event) => void][] = [
    ['scroll', scrolled],
    ['scrollend', rest],
    ['touchstart', press],
    ['touchend', lift],
    ['touchcancel', lift],
  ];
  for (const [type, listener] of listeners) root.addEventListener(type, listener, {passive: true});
  return () => {
    clearTimeout(quiet);
    for (const [type, listener] of listeners) root.removeEventListener(type, listener);
  };
}

interface ScrollSnapOptions {
  /** A swipe crossed into another slide. */
  onIndexChange?: (index: number) => void;
  /** The strip came to rest on another slide after the user moved it. */
  onSettle?: (index: number) => void;
  /** The slide the strip shows when it mounts. */
  initialIndex?: number;
}

/**
 * Wires a horizontal scroll-snap viewport of full-width slides to an index, so a control
 * (tab pills, printing pills) can act as an indicator over the scroll position rather than
 * a switch: swiping the strip moves the index, and `scrollToIndex` moves the strip. Both
 * paths converge on the same `activeIndex`.
 *
 * Each slide is exactly the viewport's width. `onIndexChange` fires for a swipe the user
 * made, once per slide whose midpoint it crosses, and never for `scrollToIndex` (its caller
 * already knows the index): the slides that scroll passes and the one it lands on stay
 * quiet, unless the user takes the strip over mid-scroll with a touch, wheel or key.
 *
 * `onSettle` fires once the strip comes to rest after the user moved it, with the slide it
 * rests on, and only when that is not the slide it last rested on: a swipe released back
 * onto its starting slide reports nothing, and neither does `scrollToIndex`, even right after
 * a tap on the strip. So it counts the slides a user actually stopped to look at.
 *
 * The strip mounts showing `initialIndex` at once. A strip that remounts on a later slide
 * (the card modal's expanded group view unmounts it) would otherwise show the first slide,
 * then animate across.
 */
export function useScrollSnapIndex({
  onIndexChange,
  onSettle,
  initialIndex = 0,
}: ScrollSnapOptions = {}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  // The latest callbacks, read from the listeners without re-subscribing them.
  const onIndexChangeRef = useRef(onIndexChange);
  const onSettleRef = useRef(onSettle);
  useEffect(() => {
    onIndexChangeRef.current = onIndexChange;
    onSettleRef.current = onSettle;
  });
  // The slide the strip is on or was last sent to, so each slide is reported once.
  const lastRef = useRef(initialIndex);
  // The slide a `scrollToIndex` call is still scrolling to; null while the user has the strip.
  const targetRef = useRef<number | null>(null);
  // Whether the user has moved the strip since it last came to rest, and the slide it rested on.
  const userMovedRef = useRef(false);
  const restRef = useRef(initialIndex);

  // Before paint, so a later initial slide never flashes the first one.
  useLayoutEffect(() => {
    const root = viewportRef.current;
    if (root && lastRef.current) root.scrollLeft = lastRef.current * root.clientWidth;
  }, []);

  useEffect(() => {
    const root = viewportRef.current;
    if (!root) return;
    // Before layout gives the strip a width, trust the slide it mounted on.
    lastRef.current = indexFromScroll(root) ?? lastRef.current;
    const update = () => {
      const next = indexFromScroll(root);
      if (next === null) return;
      if (targetRef.current !== null) {
        if (next === targetRef.current) targetRef.current = null;
        return;
      }
      if (next === lastRef.current) return;
      lastRef.current = next;
      // A swipe, including one no touch, wheel or key started (assistive tech scrolling it).
      userMovedRef.current = true;
      setActiveIndex(next);
      onIndexChangeRef.current?.(next);
    };
    const takeOver = () => {
      targetRef.current = null;
      userMovedRef.current = true;
    };
    const settle = () => {
      const at = indexFromScroll(root);
      if (!userMovedRef.current || at === null) return;
      userMovedRef.current = false;
      if (at === restRef.current) return;
      restRef.current = at;
      onSettleRef.current?.(at);
    };
    root.addEventListener('scroll', update, {passive: true});
    for (const type of TAKE_OVER_EVENTS) root.addEventListener(type, takeOver, {passive: true});
    const stopWatching = watchForRest(root, settle);
    return () => {
      root.removeEventListener('scroll', update);
      for (const type of TAKE_OVER_EVENTS) root.removeEventListener(type, takeOver);
      stopWatching();
    };
  }, []);

  const scrollToIndex = (index: number) => {
    const root = viewportRef.current;
    if (!root) return;
    setActiveIndex(index);
    lastRef.current = index;
    // Its own scroll is not the user's: its caller knows where it lands, and a tap on the
    // strip before it (which marked the strip as moved) is over.
    userMovedRef.current = false;
    restRef.current = index;
    // Already on that slide, the scroll may never fire, so there is nothing to wait out.
    targetRef.current = indexFromScroll(root) === index ? null : index;
    // Scroll the strip itself. scrollIntoView would also scroll every scrollable ancestor,
    // so a page that overflows sideways would jump each time a pill is tapped.
    root.scrollTo({
      left: index * root.clientWidth,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  return {viewportRef, activeIndex, scrollToIndex};
}
