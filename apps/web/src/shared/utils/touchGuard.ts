/**
 * Detects synthetic mouse events fired by iOS after a touch tap.
 *
 * After a tap, iOS fires mouseenter/click at the same screen coordinates
 * on whatever page is now visible, causing ghost interactions after SPA
 * navigation. This module tracks the last touchstart globally and exposes
 * a check to suppress those synthetic events.
 *
 * Standard pattern used by Material UI, Hammer.js, etc.
 */

let lastTouchTime = 0;

if (typeof document !== 'undefined') {
  document.addEventListener(
    'touchstart',
    () => {
      lastTouchTime = Date.now();
    },
    {passive: true, capture: true},
  );
}

/**
 * Returns true if a mouse/click event is likely synthetic (fired by iOS
 * within 500ms of a touchstart). Use this to guard onMouseEnter, onClick,
 * etc. on elements that could receive ghost interactions after navigation.
 */
export function isSyntheticMouseEvent(): boolean {
  return Date.now() - lastTouchTime < 500;
}
