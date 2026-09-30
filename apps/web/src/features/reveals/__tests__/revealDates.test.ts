import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {REVEAL_SET_CODE} from '../../../shared/constants';
import {_resetPreviewCardsCache} from '../../cards/previewCards';
import {fetchRevealDates, _resetRevealDatesCache} from '../revealDates';

const mockFetch = vi.fn();

beforeEach(() => {
  _resetPreviewCardsCache();
  _resetRevealDatesCache();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

describe('fetchRevealDates', () => {
  it('resolves null for malformed dates instead of rejecting (#641)', async () => {
    const sets = {[REVEAL_SET_CODE]: {prereleaseDate: 20261010, releaseDate: 20261024}};
    mockFetch.mockResolvedValue({ok: true, json: () => Promise.resolve({sets})});

    await expect(fetchRevealDates()).resolves.toBeNull();
  });

  it('reads the dates on a later call once a failed preview request succeeds (#641)', async () => {
    const sets = {[REVEAL_SET_CODE]: {prereleaseDate: '2026-10-10', releaseDate: '2026-10-24'}};
    mockFetch
      .mockResolvedValueOnce({ok: false, status: 503})
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve({sets})});

    await expect(fetchRevealDates()).resolves.toBeNull();
    const dates = await fetchRevealDates();

    expect(dates?.releaseDate).toEqual(new Date(2026, 9, 24));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
