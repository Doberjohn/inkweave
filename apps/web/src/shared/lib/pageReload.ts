/**
 * The page's one reload guard. A stale chunk (staleChunkReload.ts) and a new service worker
 * (swUpdate.ts) can each ask for a reload in the same page, and the page still goes once.
 */

/** Set once this page has asked to reload; it is on its way out from then on. */
let reloadRequested = false;

/** Reloads the page, at once or `afterMs` later, once however many callers ask. */
export function reloadOnce(afterMs = 0): void {
  if (reloadRequested) return;
  reloadRequested = true;
  if (afterMs > 0) window.setTimeout(() => window.location.reload(), afterMs);
  else window.location.reload();
}

/** Whether this page has asked to reload, through any caller. */
export function isReloading(): boolean {
  return reloadRequested;
}
