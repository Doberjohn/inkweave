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
});
