import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {renderHook, waitFor} from '@testing-library/react';
import {startCardList} from '../cardListRequest';
import featuredCardIds from '../featuredCardIds.json';
import {
  FEATURED_IDS,
  fetchFeaturedCards,
  startFeaturedCards,
  useFeaturedCardsFile,
  _resetFeaturedCardsCache,
} from '../featured';

vi.mock('../cardListRequest', () => ({startCardList: vi.fn()}));

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
  vi.mocked(startCardList).mockReset();
});

describe('fetchFeaturedCards', () => {
  it('resolves the featured cards in display order, fetching the file once per page', async () => {
    mockFetch.mockResolvedValue(respond(featuredFile([...FEATURED_IDS].reverse())));

    const [first, second] = await Promise.all([fetchFeaturedCards(), fetchFeaturedCards()]);

    expect(first?.map((card) => card.id)).toEqual(FEATURED_IDS);
    expect(second).toBe(first);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith('/data/featuredCards.json');
  });

  it.each([
    ['is missing', () => mockFetch.mockResolvedValue({ok: false, status: 404})],
    ['lacks a featured card', () => mockFetch.mockResolvedValue(respond(featuredFile(FEATURED_IDS.slice(1))))],
    ['fails to load', () => mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))],
  ])('resolves null when the file %s, so the full list takes over', async (_label, setUp) => {
    setUp();
    await expect(fetchFeaturedCards()).resolves.toBeNull();
  });

  it('forgets a server error, so the next call fetches the file again', async () => {
    mockFetch
      .mockResolvedValueOnce({ok: false, status: 503})
      .mockResolvedValueOnce(respond(featuredFile(FEATURED_IDS)));

    await expect(fetchFeaturedCards()).resolves.toBeNull();
    const featured = await fetchFeaturedCards();

    expect(featured?.map((card) => card.id)).toEqual(FEATURED_IDS);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('keeps a missing file missing for the page, in one request', async () => {
    mockFetch.mockResolvedValue({ok: false, status: 404});

    await fetchFeaturedCards();
    await expect(fetchFeaturedCards()).resolves.toBeNull();
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});

describe('startFeaturedCards', () => {
  it("waits for the full card list when the file can't be used, since the page shows them from it", async () => {
    mockFetch.mockResolvedValue({ok: false, status: 404});
    let release!: () => void;
    const list = new Promise<void>((resolve) => (release = resolve));
    vi.mocked(startCardList).mockReturnValue(list as unknown as ReturnType<typeof startCardList>);
    let settled = false;
    void startFeaturedCards().then(() => (settled = true));

    await vi.waitFor(() => expect(startCardList).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve));
    expect(settled).toBe(false);
    release();
    await vi.waitFor(() => expect(settled).toBe(true));
  });

  it('leaves the card list for later when the file has the featured cards (#641)', async () => {
    mockFetch.mockResolvedValue(respond(featuredFile(FEATURED_IDS)));

    await startFeaturedCards();

    expect(startCardList).not.toHaveBeenCalled();
  });
});

describe('useFeaturedCardsFile', () => {
  /** Renders the hook, keeping what each render returned. */
  function renderFile() {
    const byRender: (unknown[] | null | undefined)[] = [];
    const view = renderHook(() => {
      const cards = useFeaturedCardsFile(true);
      byRender.push(cards);
      return cards;
    });
    return {...view, byRender};
  }

  it('starts from a file main.tsx already loaded, with no loading render (#915)', async () => {
    mockFetch.mockResolvedValue(respond(featuredFile(FEATURED_IDS)));
    await fetchFeaturedCards();

    const {byRender} = renderFile();

    expect(byRender[0]).toHaveLength(FEATURED_IDS.length);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('gives nothing while disabled, though the file has loaded', async () => {
    mockFetch.mockResolvedValue(respond(featuredFile(FEATURED_IDS)));
    await fetchFeaturedCards();

    const {result} = renderHook(() => useFeaturedCardsFile(false));

    expect(result.current).toBeUndefined();
  });

  it('loads on its first render while the file is still on its way', async () => {
    mockFetch.mockResolvedValue(respond(featuredFile(FEATURED_IDS)));

    const {result, byRender} = renderFile();

    expect(byRender[0]).toBeUndefined();
    await waitFor(() => expect(result.current).toHaveLength(FEATURED_IDS.length));
  });
});

describe('FEATURED_IDS', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // featuredCardIds.json is the only source (#957): admin's Featured cards page commits it
  // (Doberjohn/inkweave-admin#95), so a Vercel variable left set must never override it.
  it("is featuredCardIds.json's list even when VITE_FEATURED_CARD_IDS is set", async () => {
    vi.stubEnv('VITE_FEATURED_CARD_IDS', '1,2,3');
    vi.resetModules();

    const fresh = await import('../featured');

    expect(fresh.FEATURED_IDS).toEqual(featuredCardIds.map((entry) => entry.id));
  });
});
