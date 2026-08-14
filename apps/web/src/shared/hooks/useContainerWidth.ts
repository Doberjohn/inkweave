import {useState, useEffect, useLayoutEffect, type RefObject} from 'react';

/**
 * Tracks the client width of a container element via ResizeObserver.
 * Returns 0 until the element is measured.
 */
export function useContainerWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);

  /**
   * The FIRST measurement is synchronous, before the browser paints. A
   * ResizeObserver alone reports after first paint, so anything sized from this
   * width renders once unsized and then jumps — the binder scored a 0.20 layout
   * shift on a tall window that way, purely from that one frame. React flushes
   * layout effects (and the re-render they schedule) before paint, so this makes
   * the first painted frame the correct one.
   */
  useLayoutEffect(() => {
    const w = ref.current?.clientWidth ?? 0;
    if (w > 0) setWidth(w);
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const w = entry.contentRect.width;
        // Ignore 0-width observations from detached elements (React Strict Mode
        // double-mounts can leave observers watching unmounted placeholders)
        if (w > 0) setWidth(w);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
