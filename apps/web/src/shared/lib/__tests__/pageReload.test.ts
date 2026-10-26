import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

let pageReload: typeof import('../pageReload');

describe('reloadOnce', () => {
  const reload = vi.fn();

  beforeEach(async () => {
    // A fresh page, as a reload gives one: the guard starts unset.
    vi.resetModules();
    pageReload = await import('../pageReload');
    reload.mockClear();
    vi.useFakeTimers();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {...window.location, reload},
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('says the page is not reloading until something asks', () => {
    expect(pageReload.isReloading()).toBe(false);
  });

  // A stale chunk and a new service worker can each ask in the same page.
  it('reloads once however many callers ask', () => {
    pageReload.reloadOnce();
    pageReload.reloadOnce();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(pageReload.isReloading()).toBe(true);
  });

  it('waits afterMs, and counts as reloading from the ask', () => {
    pageReload.reloadOnce(600);

    expect(pageReload.isReloading()).toBe(true);
    vi.advanceTimersByTime(599);
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // The update's reload waits for its toast to be read; a later ask doesn't cut it short.
  it('ignores an ask while a reload waits', () => {
    pageReload.reloadOnce(600);
    pageReload.reloadOnce();

    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
