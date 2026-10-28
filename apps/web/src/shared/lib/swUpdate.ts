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

import {isReloading, reloadOnce} from './pageReload';
import {announceReload} from './swUpdateToast';

/**
 * Reloads the page onto the new version, with the update toast on screen first, once however
 * many of the swap's signals arrive (pageReload.ts).
 */
export function reloadOntoNewVersion(): void {
  if (isReloading()) return;
  reloadOnce(announceReload());
}

let workerRegistered: (registration: ServiceWorkerRegistration | undefined) => void = () => {};
/** The page's worker registration, once the update flow listens to it; never where none registers. */
const registration = new Promise<ServiceWorkerRegistration | undefined>((resolve) => {
  workerRegistered = resolve;
});

/**
 * main.tsx's onRegisteredSW. From here on vite-plugin-pwa hears of every new worker the
 * registration finds. A worker found before that, still installing when the page registers, it
 * never hears of, so checkForNewVersion waits for this.
 */
export function onWorkerRegistered(registered: ServiceWorkerRegistration | undefined): void {
  workerRegistered(registered);
}

/**
 * Looks for a newer worker now. The browser looks only when the page navigates, which a tab left
 * open, or an installed app the phone resumes, may not do for days. A newer one takes main.tsx's
 * usual path: onNeedRefresh shows the toast, then applyWaitingUpdate reloads onto it. Waits for
 * the page's registration (onWorkerRegistered), so with none (dev, E2E) it never looks. Never
 * throws: offline, there is nothing to find.
 */
export async function checkForNewVersion(): Promise<void> {
  try {
    await (await registration)?.update();
  } catch {
    // The worker script didn't load; the next navigation looks again.
  }
}

/**
 * Asks the waiting worker to take over (its SKIP_WAITING listener calls skipWaiting()) and
 * reloads once it is activated. Chrome holds it back until the old worker's requests finish, for
 * up to five minutes. A newer deploy's worker that takes its place makes it redundant, and gets
 * asked in turn. With no worker waiting any more, it has taken over already (another tab asked
 * first), so the page reloads at once.
 */
export async function applyWaitingUpdate(container: ServiceWorkerContainer): Promise<void> {
  const waiting = (await container.getRegistration())?.waiting;
  if (!waiting) {
    reloadOntoNewVersion();
    return;
  }
  waiting.addEventListener('statechange', () => {
    if (waiting.state === 'activated') reloadOntoNewVersion();
    else if (waiting.state === 'redundant') void applyWaitingUpdate(container);
  });
  waiting.postMessage({type: 'SKIP_WAITING'});
}
