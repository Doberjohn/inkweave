import {afterEach, describe, expect, it, vi} from 'vitest';
import {renderHook, waitFor} from '@testing-library/react';
import {useVoteAnalytics} from '../useVoteAnalytics';

afterEach(() => vi.unstubAllGlobals());

describe('useVoteAnalytics', () => {
  it('returns data on a successful fetch', async () => {
    const payload = {generatedAt: 'x', hasRawVotes: false, global: {totalVotes: 5}, rules: [], pairs: []};
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: () => Promise.resolve(payload)}));
    const {result} = renderHook(() => useVoteAnalytics());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.global.totalVotes).toBe(5);
    expect(result.current.error).toBeNull();
  });

  it('surfaces an error on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: false, status: 404}));
    const {result} = renderHook(() => useVoteAnalytics());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
