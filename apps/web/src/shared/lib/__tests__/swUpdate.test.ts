import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {UPDATE_TOAST_LEAD_MS, showUpdateToast} from '../swUpdateToast';

let swUpdate: typeof import('../swUpdate');

/** A service worker as the page sees one: its state, its statechange events, its messages. */
class FakeWorker extends EventTarget {
  state: ServiceWorkerState = 'installed';
  postMessage = vi.fn();

  become(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

/** A registration as the page reads it: whichever worker waits now, or none, and one installing. */
type Registration = {waiting: FakeWorker | null; installing?: FakeWorker | null};

/** A container that hands out `registration` as it stands at each call, as the browser's does. */
function containerFor(registration: Registration) {
  return {getRegistration: async () => registration} as unknown as ServiceWorkerContainer;
}

/** A container whose registration has `waiting` waiting, or no worker waiting at all. */
function containerWith(waiting: FakeWorker | null) {
  return containerFor({waiting});
}

/** Lets the page's pending promises run, as the browser's answer to getRegistration() would. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('applyWaitingUpdate', () => {
  const reload = vi.fn();

  beforeEach(async () => {
    // A fresh page, as a reload gives one: the reload guard starts unset.
    vi.resetModules();
    swUpdate = await import('../swUpdate');
    reload.mockClear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {...window.location, reload},
    });
    // main.tsx's onNeedRefresh shows the toast before it asks the worker to take over.
    showUpdateToast();
  });

  afterEach(() => {
    document.getElementById('sw-update-toast')?.remove();
    vi.useRealTimers();
  });

  it('asks the waiting worker to take over, and waits for it before reloading', async () => {
    const worker = new FakeWorker();
    await swUpdate.applyWaitingUpdate(containerWith(worker));

    expect(worker.postMessage).toHaveBeenCalledWith({type: 'SKIP_WAITING'});
    worker.become('activating');
    expect(reload).not.toHaveBeenCalled();
  });

  // A page with no controller gets no controllerchange: the worker's own state is its only signal.
  it('reloads once the worker is activated', async () => {
    const worker = new FakeWorker();
    await swUpdate.applyWaitingUpdate(containerWith(worker));

    worker.become('activating');
    worker.become('activated');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // A newer deploy's worker that finishes installing takes the waiting one's place, still waiting.
  it('asks the newer worker that replaces the waiting one, and reloads once it is activated', async () => {
    const worker = new FakeWorker();
    const registration: Registration = {waiting: worker};
    await swUpdate.applyWaitingUpdate(containerFor(registration));

    const newer = new FakeWorker();
    registration.waiting = newer;
    worker.become('redundant');
    await settle();

    expect(reload).not.toHaveBeenCalled();
    expect(newer.postMessage).toHaveBeenCalledWith({type: 'SKIP_WAITING'});
    newer.become('activated');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // Another tab asked first, so the worker took over before this page's toast was done.
  it('reloads at once when no worker waits any more', async () => {
    await swUpdate.applyWaitingUpdate(containerWith(null));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  // Chrome can hold the swap for minutes, past the toast's cap: the reload never comes unannounced.
  it('shows the toast again before a reload that comes after it went', async () => {
    const worker = new FakeWorker();
    await swUpdate.applyWaitingUpdate(containerWith(worker));
    vi.useFakeTimers();
    document.getElementById('sw-update-toast')?.remove();

    worker.become('activated');
    expect(document.getElementById('sw-update-toast')).not.toBeNull();
    vi.advanceTimersByTime(UPDATE_TOAST_LEAD_MS - 1);
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // main.tsx's controllerchange, vite-plugin-pwa's onNeedReload and the worker's activation all
  // arrive on a controlled page.
  it('reloads once however many signals arrive', async () => {
    const worker = new FakeWorker();
    await swUpdate.applyWaitingUpdate(containerWith(worker));

    swUpdate.reloadOntoNewVersion();
    swUpdate.reloadOntoNewVersion();
    worker.become('activated');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // A stale chunk's reload (staleChunkReload.ts) is taking the page onto the new version already.
  it('leaves a page that is already reloading as it is', async () => {
    document.getElementById('sw-update-toast')?.remove();
    const {reloadOnce} = await import('../pageReload');
    reloadOnce();

    swUpdate.reloadOntoNewVersion();
    expect(document.getElementById('sw-update-toast')).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('reloadOntoNewestVersion', () => {
  const reload = vi.fn();
  const toast = () => document.getElementById('sw-update-toast');

  beforeEach(async () => {
    vi.resetModules();
    swUpdate = await import('../swUpdate');
    reload.mockClear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {...window.location, reload},
    });
  });

  afterEach(() => {
    toast()?.remove();
  });

  it('reloads at once when the browser holds no newer worker', async () => {
    await swUpdate.reloadOntoNewestVersion(containerWith(null));

    expect(reload).toHaveBeenCalledTimes(1);
    expect(toast()).toBeNull();
  });

  it('reloads at once in a browser with no service worker', async () => {
    await swUpdate.reloadOntoNewestVersion(undefined);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  // A reload alone would leave the old worker in control, serving the old version again.
  it('asks a waiting worker to take over, with the toast up, and reloads once it is activated', async () => {
    const worker = new FakeWorker();
    await swUpdate.reloadOntoNewestVersion(containerWith(worker));
    await settle();

    expect(toast()).not.toBeNull();
    expect(worker.postMessage).toHaveBeenCalledWith({type: 'SKIP_WAITING'});
    expect(reload).not.toHaveBeenCalled();
    worker.become('activated');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // The worker the failed card list's look found can still be installing when Reload is pressed.
  it('waits for a worker still installing, then asks it to take over', async () => {
    const worker = new FakeWorker();
    worker.state = 'installing';
    const registration: Registration = {waiting: null, installing: worker};
    await swUpdate.reloadOntoNewestVersion(containerFor(registration));

    expect(toast()).not.toBeNull();
    expect(worker.postMessage).not.toHaveBeenCalled();
    registration.installing = null;
    registration.waiting = worker;
    worker.become('installed');
    await settle();

    expect(worker.postMessage).toHaveBeenCalledWith({type: 'SKIP_WAITING'});
    worker.become('activated');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads as it is when the installing worker fails', async () => {
    const worker = new FakeWorker();
    worker.state = 'installing';
    await swUpdate.reloadOntoNewestVersion(containerFor({waiting: null, installing: worker}));

    worker.become('redundant');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('checkForNewVersion', () => {
  beforeEach(async () => {
    // A fresh page, whose worker hasn't registered yet.
    vi.resetModules();
    swUpdate = await import('../swUpdate');
  });

  // A worker found before vite-plugin-pwa listens would never reach onNeedRefresh.
  it('waits for the page to register its worker, then asks the registration to look', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const looked = swUpdate.checkForNewVersion();
    await settle();
    expect(update).not.toHaveBeenCalled();

    swUpdate.onWorkerRegistered({update} as unknown as ServiceWorkerRegistration);
    await looked;
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the page registered no worker', async () => {
    swUpdate.onWorkerRegistered(undefined);
    await expect(swUpdate.checkForNewVersion()).resolves.toBeUndefined();
  });

  // Offline, the worker script fails to load: the caller's own failure is what the page shows.
  it('never throws when the look fails', async () => {
    const update = vi.fn().mockRejectedValue(new TypeError('Failed to update a ServiceWorker'));
    swUpdate.onWorkerRegistered({update} as unknown as ServiceWorkerRegistration);
    await expect(swUpdate.checkForNewVersion()).resolves.toBeUndefined();
  });
});
