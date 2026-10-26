import {useState, useLayoutEffect, type RefObject} from 'react';
import {flushSync} from 'react-dom';

/**
 * Tracks the client width of a container element via ResizeObserver.
 * Returns 0 until the element is measured.
 *
 * THE FIRST WIDTH LANDS BEFORE THE FIRST PAINT. A ResizeObserver reports between layout and
 * paint, but a state update from it renders in a later task, after the paint: an element sized
 * by its width drew one frame at the size meant for no width. A binder pocket's copies stripe
 * drew its counts full size on every page turn, then shrank (owner, 2026-10-26). So it observes
 * from the commit (a layout effect, where a passive one may only start after the paint), and its
 * first report renders at once; later ones, a resize's, render as usual.
 */
export function useContainerWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    let measured = false;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const w = entry.contentRect.width;
        // Ignore 0-width observations from detached elements (React Strict Mode
        // double-mounts can leave observers watching unmounted placeholders)
        if (w <= 0) return;
        if (measured) setWidth(w);
        else flushSync(() => setWidth(w));
        measured = true;
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
