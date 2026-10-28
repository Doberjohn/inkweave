import {useLayoutEffect, type RefObject} from 'react';

/**
 * A mark drawn over a binder pocket takes its zoom before it first paints, as a pocket's copies
 * stripe and its friends badge do (owner, 2026-10-26: each page a turn mounted drew its counts
 * full size for a frame, then shrank). The width `useContainerWidth` measures renders after the
 * paint, so an observer started in the commit puts the first width's zoom straight onto the
 * row, before the paint, and the render that follows writes the same zoom.
 *
 * It renders nothing there: a render inside the observer's step (React's `flushSync`) also ran
 * the page's other pending work, such as a page turn under way, and a box observed there that
 * changed size was left for the next frame, which the browser reports as an error ("ResizeObserver
 * loop completed with undelivered notifications", uncaught in WebKit). Only the row changes
 * size, and nothing observes it. A mark in its container's flow, as the card window's stripe
 * is, keeps to the render (`zoom` undefined): there its zoom moves what is round it.
 */
export function useZoomBeforePaint(
  sizer: RefObject<HTMLElement | null>,
  row: RefObject<HTMLElement | null>,
  zoom: ((width: number) => number) | undefined,
) {
  useLayoutEffect(() => {
    const measured = sizer.current;
    const zoomed = row.current;
    if (!zoom || !measured || !zoomed || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      if (width <= 0) return;
      zoomed.style.zoom = String(zoom(width));
      observer.disconnect();
    });
    observer.observe(measured);
    return () => observer.disconnect();
  }, [sizer, row, zoom]);
}
