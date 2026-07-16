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
 * Returns true if a mouse/click/focus event is likely synthetic (fired by iOS
 * within 1000ms of a touchstart). Use this to guard onMouseEnter, onClick,
 * onFocus, etc. on elements that could receive ghost interactions after navigation.
 */
export function isSyntheticMouseEvent(): boolean {
  return Date.now() - lastTouchTime < 1000;
}

/** The subset of a click event needed to tell a plain left-click from a link-following one. */
type ClickIntent = {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  button: number;
};

/**
 * True when a click on a crawlable `<a href>` should be left to the browser's native
 * navigation (open in a new tab / window / download) rather than intercepted for in-app
 * behavior: any modifier key held (Ctrl/Cmd new tab, Shift new window, Alt download), or a
 * middle-click. Shared by the card tiles (issue #486) so the "modified click follows the
 * link" rule lives in exactly one place.
 */
export function isModifiedClick(e: ClickIntent): boolean {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1;
}
