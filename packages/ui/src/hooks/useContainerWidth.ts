import {useState, useEffect, type RefObject} from 'react';

/**
 * Tracks the client width of a container element via ResizeObserver.
 * Returns 0 until the element is measured.
 */
export function useContainerWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);

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
