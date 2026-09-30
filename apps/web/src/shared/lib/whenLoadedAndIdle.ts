/** Where `requestIdleCallback` is missing (Safari), run this long after `load` instead. */
const IDLE_FALLBACK_MS = 200;
/** Upper bound on the idle wait, so a page that never goes idle still gets there. */
const IDLE_TIMEOUT_MS = 2000;

/**
 * Runs `callback` once the page has fired `load` and the main thread is idle (right away if
 * `load` already happened). Returns a function that cancels whatever is still pending.
 * For work that must stay off the critical path: the hero logo's animation (#639), Sentry (#640).
 */
export function whenLoadedAndIdle(callback: () => void): () => void {
  let idleId: number | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const scheduleIdle = () => {
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(callback, {timeout: IDLE_TIMEOUT_MS});
    } else {
      timeoutId = setTimeout(callback, IDLE_FALLBACK_MS);
    }
  };
  if (document.readyState === 'complete') scheduleIdle();
  else window.addEventListener('load', scheduleIdle, {once: true});
  return () => {
    window.removeEventListener('load', scheduleIdle);
    if (idleId !== undefined) window.cancelIdleCallback(idleId);
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  };
}
