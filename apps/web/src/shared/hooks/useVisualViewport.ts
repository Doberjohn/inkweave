import {useState, useEffect} from 'react';

/**
 * The band of screen the user can actually see, and what is covering the rest.
 *
 * WHY THIS EXISTS. A `position: fixed` element is laid out against the LAYOUT
 * viewport, which does not shrink when the on-screen keyboard opens — only the
 * VISUAL viewport does. So a sheet pinned to `bottom: 0` keeps its geometry and
 * quietly renders its lower half behind the keyboard. Measured on an 812px
 * phone with a ~336px keyboard, a 568px search sheet had ~232px visible.
 *
 * Works the same on iOS Safari and Android Chrome: with no `interactive-widget`
 * in the viewport meta (this app sets none), both default to resizing the visual
 * viewport only. Where a browser resizes the layout viewport instead, the gap
 * below the visible band is zero and `keyboardInset` degrades to 0 on its own.
 */
export interface VisualViewportState {
  /** Height of the visible band. Falls back to the layout viewport height. */
  height: number;
  /** Pixels occluded at the bottom, i.e. the keyboard. 0 when nothing covers it. */
  keyboardInset: number;
}

function readViewport(): VisualViewportState {
  if (typeof window === 'undefined') return {height: 0, keyboardInset: 0};
  const layoutHeight = window.innerHeight;
  const vv = window.visualViewport;
  if (!vv) return {height: layoutHeight, keyboardInset: 0};
  return {
    height: vv.height,
    // `offsetTop` is how far the visible band has been pushed down (pinch-zoom
    // scroll), so it is part of the layout height that is NOT keyboard.
    // Clamped because Android transiently reports a visible band taller than the
    // layout viewport mid-rotation, and a negative inset would push a sheet
    // anchored to it clean off the bottom of the screen.
    keyboardInset: Math.max(0, layoutHeight - vv.height - vv.offsetTop),
  };
}

export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState(readViewport);

  useEffect(() => {
    const vv = typeof window === 'undefined' ? null : window.visualViewport;
    if (!vv) return;

    // Returning the PREVIOUS object when nothing moved is what stops a re-render:
    // React bails out on an identical reference, and `readViewport` mints a fresh
    // object every call. Without this, a pinch-zoom re-renders the sheet on every
    // frame of the gesture.
    const update = () =>
      setState((prev) => {
        const next = readViewport();
        return prev.height === next.height && prev.keyboardInset === next.keyboardInset
          ? prev
          : next;
      });

    vv.addEventListener('resize', update);
    // `scroll` matters as much as `resize`: pinch-zooming pans the visible band
    // without changing its height, which moves `offsetTop` and so the inset.
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return state;
}
