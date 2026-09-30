import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {REVEAL_SET_CODE} from '../../../shared/constants';
import {fetchPreviewCards, _resetPreviewCardsCache} from '../previewCards';
import {fetchCardsFromLocal} from '../loader';
import {fetchRevealDates, _resetRevealDatesCache} from '../../reveals/revealDates';

const METADATA = {formatVersion: '1.0', generatedOn: '2026-09-30', language: 'en'};
const PREVIEW_CARD = {
  id: 14001,
  name: 'Preview',
  fullName: 'Preview Card',
  cost: 3,
  color: 'Amber',
  inkwell: true,
  type: 'Character',
  setCode: REVEAL_SET_CODE,
};
const PREVIEW = {
  metadata: METADATA,
  sets: {[REVEAL_SET_CODE]: {name: 'Reveal set', prereleaseDate: '2026-10-10', releaseDate: '2026-10-24'}},
  cards: [PREVIEW_CARD],
};
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

    const [loaded, dates] = await Promise.all([fetchCardsFromLocal(), fetchRevealDates()]);

    const previewRequests = mockFetch.mock.calls.filter(([url]) => url === '/data/previewCards.json');
    expect(previewRequests).toHaveLength(1);
    expect(loaded.cards.map((card) => card.fullName)).toEqual(['Preview Card']);
    expect(dates?.releaseDate).toEqual(new Date(2026, 9, 24));
  });

  it('forgets a failed request, so the next caller tries again', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(respond(PREVIEW));

    await expect(fetchPreviewCards()).resolves.toBeNull();
    await expect(fetchPreviewCards()).resolves.toEqual(PREVIEW);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('forgets a server error too, so a retry gets the preview cards', async () => {
    mockFetch.mockResolvedValueOnce({ok: false, status: 503}).mockResolvedValueOnce(respond(PREVIEW));

    await expect(fetchPreviewCards()).resolves.toBeNull();
    await expect(fetchPreviewCards()).resolves.toEqual(PREVIEW);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('keeps a missing file missing for the page, in one request', async () => {
    mockFetch.mockResolvedValue({ok: false, status: 404});

    await expect(fetchPreviewCards()).resolves.toBeNull();
    await expect(fetchPreviewCards()).resolves.toBeNull();
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
