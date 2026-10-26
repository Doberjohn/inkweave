/**
 * Moves an open page onto a new version of the service worker.
 *
 * main.tsx shows the update toast when vite-plugin-pwa reports a new worker waiting, then calls
 * `applyWaitingUpdate`, and the page reloads once the new worker is active, so the reload loads
 * the new version. A page the old worker controls hears of the swap through `controllerchange`.
 * A page with no controller never does: a hard reload or a first visit leaves a page
 * uncontrolled, and the worker never claims one. Such a page still shows the toast when another
 * tab, or the installed app's window, finds the update, and it kept the toast for good. So the
 * page also watches the waiting worker itself.
 */

/** Set once this page has asked to reload; it is on its way out from then on. */
let reloadRequested = false;

/** Reloads the page, once however many of the swap's signals arrive. */
export function reloadOnce(): void {
  if (reloadRequested) return;
  reloadRequested = true;
  window.location.reload();
}

/**
 * Asks the waiting worker to take over (its SKIP_WAITING listener calls skipWaiting()) and
 * reloads once it has: when it is activated, or redundant because a newer worker replaced it.
 * Chrome holds it back until the old worker's requests finish, for up to five minutes. With no
 * worker waiting any more, it has taken over already (another tab asked first), so the page
 * reloads at once.
 */
export async function applyWaitingUpdate(container: ServiceWorkerContainer): Promise<void> {
  const waiting = (await container.getRegistration())?.waiting;
  if (!waiting) {
    reloadOnce();
    return;
  }
  waiting.addEventListener('statechange', () => {
    if (waiting.state === 'activated' || waiting.state === 'redundant') reloadOnce();
  });
  waiting.postMessage({type: 'SKIP_WAITING'});
}
