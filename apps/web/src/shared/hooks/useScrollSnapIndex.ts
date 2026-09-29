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
 * The strip mounts showing `initialIndex` at once. A strip that remounts on a later slide
 * (the card modal's expanded group view unmounts it) would otherwise show the first slide,
 * then animate across.
 */
export function useScrollSnapIndex(onIndexChange?: (index: number) => void, initialIndex = 0) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  // The latest callback, read from the scroll listener without re-subscribing it.
  const onIndexChangeRef = useRef(onIndexChange);
  useEffect(() => {
    onIndexChangeRef.current = onIndexChange;
  });
  // The slide the strip is on or was last sent to, so each slide is reported once.
  const lastRef = useRef(initialIndex);
  // The slide a `scrollToIndex` call is still scrolling to; null while the user has the strip.
  const targetRef = useRef<number | null>(null);

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
      setActiveIndex(next);
      onIndexChangeRef.current?.(next);
    };
    const takeOver = () => {
      targetRef.current = null;
    };
    root.addEventListener('scroll', update, {passive: true});
    for (const type of TAKE_OVER_EVENTS) root.addEventListener(type, takeOver, {passive: true});
    return () => {
      root.removeEventListener('scroll', update);
      for (const type of TAKE_OVER_EVENTS) root.removeEventListener(type, takeOver);
    };
  }, []);

  const scrollToIndex = (index: number) => {
    const root = viewportRef.current;
    if (!root) return;
    setActiveIndex(index);
    lastRef.current = index;
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
