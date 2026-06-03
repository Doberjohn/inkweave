import {beforeEach, describe, expect, it, vi} from 'vitest';
import {markStaleChunkRecovered, reloadForStaleChunk} from '../staleChunkReload';

describe('reloadForStaleChunk', () => {
  const reload = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    reload.mockClear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {...window.location, reload},
    });
  });

  it('reloads on the first stale-chunk failure', () => {
    reloadForStaleChunk();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload again within the same session (loop guard)', () => {
    reloadForStaleChunk();
    reloadForStaleChunk();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads again once a successful import has cleared the guard', () => {
    reloadForStaleChunk();
    markStaleChunkRecovered();
    reloadForStaleChunk();
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
