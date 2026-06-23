import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {reloadForStaleChunk} from '../staleChunkReload';

describe('reloadForStaleChunk', () => {
  const reload = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    reload.mockClear();
    // Fake timers also mock Date.now(), which the time-window guard reads.
    vi.useFakeTimers();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {...window.location, reload},
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reloads on the first stale-chunk failure', () => {
    reloadForStaleChunk();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload again within the loop-guard window', () => {
    reloadForStaleChunk();
    vi.advanceTimersByTime(5_000); // well inside the 30s window
    reloadForStaleChunk();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // Regression for the #379 leak: previously every successful HomePage load
  // cleared the guard, so a *different* chunk failing on a loop could reload
  // forever. The time window caps it regardless of interleaved successes.
  it('caps at one reload even when imports keep failing inside the window', () => {
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(1_000);
      reloadForStaleChunk();
    }
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('allows another reload once the window has elapsed (new stale episode)', () => {
    reloadForStaleChunk();
    vi.advanceTimersByTime(60_000); // well past the 30s window
    reloadForStaleChunk();
    expect(reload).toHaveBeenCalledTimes(2);
  });

  // Fail-open guard: a non-finite or future stored timestamp must never wedge
  // recovery (a naive NaN-only check would block forever on "Infinity").
  it('fails open on a non-finite or future stored timestamp', () => {
    const KEY = 'stale-chunk-reload-at';

    sessionStorage.setItem(KEY, 'Infinity');
    reloadForStaleChunk();
    expect(reload).toHaveBeenCalledTimes(1);

    reload.mockClear();
    sessionStorage.setItem(KEY, String(Date.now() + 1_000_000)); // backward clock jump
    reloadForStaleChunk();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
