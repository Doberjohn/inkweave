import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {DEFAULT_FEATURED_IDS, fetchFeaturedCards, _resetFeaturedCardsCache} from '../featured';

/** The featured-cards file as precompute writes it: raw cards in allCards.json's shape. */
function featuredFile(ids: string[]) {
  return {
    metadata: {formatVersion: '1.0', generatedOn: '2026-09-30', language: 'en'},
    sets: {},
    cards: ids.map((id) => ({
      id: Number(id),
      name: `Card ${id}`,
      fullName: `Card ${id}`,
      cost: 3,
      color: 'Amber',
      inkwell: true,
      type: 'Character',
      setCode: '13',
    })),
  };
}

const mockFetch = vi.fn();
const respond = (body: unknown) => ({ok: true, json: () => Promise.resolve(body)});

beforeEach(() => {
  _resetFeaturedCardsCache();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

describe('fetchFeaturedCards', () => {
  it('resolves the featured cards in display order, fetching the file once per page', async () => {
    mockFetch.mockResolvedValue(respond(featuredFile([...DEFAULT_FEATURED_IDS].reverse())));

    const [first, second] = await Promise.all([fetchFeaturedCards(), fetchFeaturedCards()]);

    expect(first?.map((card) => card.id)).toEqual(DEFAULT_FEATURED_IDS);
    expect(second).toBe(first);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith('/data/featuredCards.json');
  });

  it.each([
    ['is missing', () => mockFetch.mockResolvedValue({ok: false, status: 404})],
    ['lacks a featured card', () => mockFetch.mockResolvedValue(respond(featuredFile(DEFAULT_FEATURED_IDS.slice(1))))],
    ['fails to load', () => mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))],
  ])('resolves null when the file %s, so the full list takes over', async (_label, setUp) => {
    setUp();
    await expect(fetchFeaturedCards()).resolves.toBeNull();
  });
});
