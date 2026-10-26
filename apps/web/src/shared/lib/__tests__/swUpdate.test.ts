import {beforeEach, describe, expect, it, vi} from 'vitest';

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

/** A container whose registration has `waiting` waiting, or no worker waiting at all. */
function containerWith(waiting: FakeWorker | null) {
  return {getRegistration: async () => ({waiting})} as unknown as ServiceWorkerContainer;
}

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

  it('reloads when a newer worker replaces the waiting one', async () => {
    const worker = new FakeWorker();
    await swUpdate.applyWaitingUpdate(containerWith(worker));

    worker.become('redundant');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // Another tab asked first, so the worker took over before this page's toast was done.
  it('reloads at once when no worker waits any more', async () => {
    await swUpdate.applyWaitingUpdate(containerWith(null));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  // main.tsx's controllerchange reload and the worker's activation both arrive on a controlled page.
  it('reloads once however many signals arrive', async () => {
    const worker = new FakeWorker();
    await swUpdate.applyWaitingUpdate(containerWith(worker));

    swUpdate.reloadOnce();
    worker.become('activated');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
