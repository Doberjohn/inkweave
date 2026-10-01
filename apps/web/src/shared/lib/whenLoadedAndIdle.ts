/** Where `requestIdleCallback` is missing (Safari), run this long after scheduling instead. */
const IDLE_FALLBACK_MS = 200;
/** Upper bound on the idle wait, so a page that never goes idle still gets there. */
const IDLE_TIMEOUT_MS = 2000;

/**
 * Runs `callback` the next time the main thread is idle. Returns a function that cancels it.
 * Uses the idle-callback API only when both halves exist: a request without its cancel would
 * throw on cleanup.
 */
export function whenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function' && typeof window.cancelIdleCallback === 'function') {
    const idleId = window.requestIdleCallback(callback, {timeout: IDLE_TIMEOUT_MS});
    return () => window.cancelIdleCallback(idleId);
  }
  const timeoutId = setTimeout(callback, IDLE_FALLBACK_MS);
  return () => clearTimeout(timeoutId);
}

/**
 * Runs `callback` once the page has fired `load` and the main thread is idle (right away if
 * `load` already happened). Returns a function that cancels whatever is still pending.
 * For work that must stay off the critical path: the hero logo's animation (#639), Sentry (#640).
 */
export function whenLoadedAndIdle(callback: () => void): () => void {
  let cancelIdle: (() => void) | undefined;
  const scheduleIdle = () => {
    cancelIdle = whenIdle(callback);
  };
  if (document.readyState === 'complete') scheduleIdle();
  else window.addEventListener('load', scheduleIdle, {once: true});
  return () => {
    window.removeEventListener('load', scheduleIdle);
    cancelIdle?.();
  };
}
