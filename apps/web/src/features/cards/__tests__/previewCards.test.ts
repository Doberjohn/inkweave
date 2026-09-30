import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {fetchPreviewCards, _resetPreviewCardsCache} from '../previewCards';
import {fetchCardsFromLocal} from '../loader';
import {fetchRevealDates, _resetRevealDatesCache} from '../../reveals/revealDates';

const METADATA = {formatVersion: '1.0', generatedOn: '2026-09-30', language: 'en'};
const PREVIEW = {metadata: METADATA, sets: {}, cards: []};
const ALL_CARDS = {metadata: METADATA, sets: {}, cards: []};

const mockFetch = vi.fn();
const respond = (body: unknown) => ({ok: true, json: () => Promise.resolve(body)});

beforeEach(() => {
  _resetPreviewCardsCache();
  _resetRevealDatesCache();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

describe('fetchPreviewCards', () => {
  it('serves the card loader and the reveal dates from one request (#641)', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(respond(url === '/data/previewCards.json' ? PREVIEW : ALL_CARDS)),
    );

    await Promise.all([fetchCardsFromLocal(), fetchRevealDates()]);

    const previewRequests = mockFetch.mock.calls.filter(([url]) => url === '/data/previewCards.json');
    expect(previewRequests).toHaveLength(1);
  });

  it('forgets a failed request, so the next caller tries again', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(respond(PREVIEW));

    await expect(fetchPreviewCards()).resolves.toBeNull();
    await expect(fetchPreviewCards()).resolves.toEqual(PREVIEW);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
