import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {renderHook, waitFor} from '@testing-library/react';
import {useManifest, _resetManifestCache} from '../useManifest';

describe('useManifest', () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
    _resetManifestCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mockFetch.mockReset();
  });

  it('should fetch manifest and expose hasSynergies predicate', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({'content-type': 'application/json'}),
      json: () => Promise.resolve(['123', '456', '789']),
    });

    const {result} = renderHook(() => useManifest());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasSynergies('123')).toBe(true);
    expect(result.current.hasSynergies('999')).toBe(false);
  });

  it('should return hasSynergies: false for all cards when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({ok: false, status: 404});

    const {result} = renderHook(() => useManifest());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasSynergies('123')).toBe(false);
    expect(result.current.error).not.toBeNull();
  });

  it('should guard against SPA fallback (HTML content-type)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({'content-type': 'text/html'}),
      json: () => Promise.resolve('<html>...</html>'),
    });

    const {result} = renderHook(() => useManifest());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasSynergies('123')).toBe(false);
  });
});
