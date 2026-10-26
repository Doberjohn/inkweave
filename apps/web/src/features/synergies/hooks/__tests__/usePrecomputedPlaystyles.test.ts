import {afterEach, beforeEach, describe, it, expect, vi} from 'vitest';
import {act, renderHook, waitFor} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {
  useAllPlaystyleCards,
  usePlaystyleGuides,
  usePrecomputedPlaystyleCards,
  usePreloadPlaystyleFiles,
} from '../usePrecomputedPlaystyles';
import {
  _resetPlaystyleFiles,
  fetchPlaystyleCardIds,
  fetchPlaystyleGuides,
  fetchPlaystyleMechanicIds,
} from '../playstyleFiles';

const cardsById: Record<string, LorcanaCard> = {
  '1': {id: '1', fullName: 'Ariel - Spectacular Singer'} as LorcanaCard,
  '2': {id: '2', fullName: 'Belle - Bookworm'} as LorcanaCard,
};

vi.mock('../../../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({getCardById: (id: string) => cardsById[id]}),
}));

const IDS = {'lore-denial': ['2', '1']};
const MECHANICS = {'lore-denial': {'1': ['lore-burn'], '2': ['draw']}};
const GUIDES = {'lore-denial': {paragraphs: ['How it wins.', 'How to build it.'], keyCards: ['1']}};
const MECHANICS_URL = '/data/synergies/_playstyleMechanics.json';
const GUIDES_URL = '/data/playstyleGuides.json';
const json = (body: unknown) => ({
  ok: true,
  headers: {get: () => 'application/json'},
  json: async () => body,
});

/**
 * A fetch that answers `_playstyles.json` with IDS, the mechanics file with `mechanics()` and the
 * guides with `guides()`.
 */
const byFile = (mechanics: () => unknown, guides: () => unknown = () => json(GUIDES)) =>
  vi.fn(async (url: string) => {
    if (url.endsWith('/_playstyles.json')) return json(IDS);
    return url === GUIDES_URL ? guides() : mechanics();
  });

beforeEach(() => {
  _resetPlaystyleFiles();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useAllPlaystyleCards', () => {
  it('starts from ids that have already loaded, with no loading render (#915)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(IDS)),
    );
    await fetchPlaystyleCardIds();
    const loadingByRender: boolean[] = [];

    const {result} = renderHook(() => {
      const playstyles = useAllPlaystyleCards();
      loadingByRender.push(playstyles.isLoading);
      return playstyles;
    });

    expect(loadingByRender).not.toContain(true);
    expect(result.current.data.get('lore-denial')?.allCards.map((c) => c.id)).toEqual(['1', '2']);
  });

  it('shares the request the hold started instead of fetching again', async () => {
    const fetchMock = vi.fn(async () => json(IDS));
    vi.stubGlobal('fetch', fetchMock);
    const held = fetchPlaystyleCardIds();

    const {result} = renderHook(() => useAllPlaystyleCards());
    await held;

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('fetches again on a retry after a failed load', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ok: false, status: 503})
      .mockResolvedValueOnce(json(IDS));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const {result} = renderHook(() => useAllPlaystyleCards());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.data.size).toBe(1));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('usePrecomputedPlaystyleCards', () => {
  it('loads until the mechanic ids arrive, so the cards and their tiles show in one render (#930)', async () => {
    let answer: (response: unknown) => void = () => {};
    const mechanics = new Promise((resolve) => (answer = resolve));
    vi.stubGlobal(
      'fetch',
      byFile(() => mechanics),
    );
    // How many cards have tiles in each render that shows the cards (one not loading).
    const tilesWhenShown: number[] = [];

    const {result} = renderHook(() => {
      const playstyle = usePrecomputedPlaystyleCards('lore-denial');
      if (!playstyle.isLoading) tilesWhenShown.push(Object.keys(playstyle.mechanicIds).length);
      return playstyle;
    });
    await act(() => fetchPlaystyleCardIds());

    expect(result.current.isLoading).toBe(true);
    answer(json(MECHANICS));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.mechanicIds).toEqual(MECHANICS['lore-denial']);
    expect(tilesWhenShown).not.toContain(0);
  });

  it('starts from mechanic ids that have already loaded, with no loading render (#913)', async () => {
    vi.stubGlobal(
      'fetch',
      byFile(() => json(MECHANICS)),
    );
    await Promise.all([fetchPlaystyleCardIds(), fetchPlaystyleMechanicIds()]);
    const loadingByRender: boolean[] = [];

    const {result} = renderHook(() => {
      const playstyle = usePrecomputedPlaystyleCards('lore-denial');
      loadingByRender.push(playstyle.isLoading);
      return playstyle;
    });

    expect(loadingByRender).not.toContain(true);
    expect(result.current.mechanicIds).toEqual(MECHANICS['lore-denial']);
  });

  it('shows the cards when the mechanic ids fail, says so, and logs why', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      byFile(() => ({ok: false, status: 503})),
    );

    const {result} = renderHook(() => usePrecomputedPlaystyleCards('lore-denial'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.cards.map((c) => c.id)).toEqual(['1', '2']);
    expect(result.current.mechanicIds).toEqual({});
    expect(result.current.mechanicsStatus).toBe('failed');
    expect(result.current.error).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to load playstyle mechanics:',
      expect.any(Error),
    );
  });

  it('asks for the mechanic ids alone on retryMechanics, with the cards still shown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const answers = [{ok: false, status: 503}, json(MECHANICS)];
    const fetchMock = byFile(() => answers.shift());
    vi.stubGlobal('fetch', fetchMock);
    const loadingByRender: boolean[] = [];

    const {result} = renderHook(() => {
      const playstyle = usePrecomputedPlaystyleCards('lore-denial');
      loadingByRender.push(playstyle.isLoading);
      return playstyle;
    });
    await waitFor(() => expect(result.current.mechanicsStatus).toBe('failed'));
    const fromRetry = loadingByRender.length;
    act(() => result.current.retryMechanics());
    expect(result.current.mechanicsStatus).toBe('reloading');

    await waitFor(() => expect(result.current.mechanicsStatus).toBe('loaded'));
    expect(result.current.mechanicIds).toEqual(MECHANICS['lore-denial']);
    // The page kept its cards through the retry, and asked for its card ids only once.
    expect(loadingByRender.slice(fromRetry)).not.toContain(true);
    const cardIdRequests = fetchMock.mock.calls.filter(([url]) =>
      url.endsWith('/_playstyles.json'),
    );
    expect(cardIdRequests).toHaveLength(1);
  });

  it('says the tiles failed again when a retry of the mechanic ids fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      byFile(() => ({ok: false, status: 503})),
    );

    const {result} = renderHook(() => usePrecomputedPlaystyleCards('lore-denial'));
    await waitFor(() => expect(result.current.mechanicsStatus).toBe('failed'));
    act(() => result.current.retryMechanics());

    await waitFor(() => expect(result.current.mechanicsStatus).toBe('failed'));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('asks for the mechanic ids again on the next visit after they failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const answers = [{ok: false, status: 503}, json(MECHANICS)];
    vi.stubGlobal(
      'fetch',
      byFile(() => answers.shift()),
    );

    const first = renderHook(() => usePrecomputedPlaystyleCards('lore-denial'));
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();
    const second = renderHook(() => usePrecomputedPlaystyleCards('lore-denial'));

    await waitFor(() =>
      expect(second.result.current.mechanicIds).toEqual(MECHANICS['lore-denial']),
    );
  });

  it('asks for the mechanic ids again on a retry after both files failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failed = {ok: false, status: 503};
    const answers: Record<string, unknown[]> = {
      '_playstyles.json': [failed, json(IDS)],
      '_playstyleMechanics.json': [failed, json(MECHANICS)],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => answers[url.split('/').pop() ?? '']?.shift()),
    );

    const {result} = renderHook(() => usePrecomputedPlaystyleCards('lore-denial'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.mechanicsStatus).toBe('loaded'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.cards.map((c) => c.id)).toEqual(['1', '2']);
    expect(result.current.mechanicIds).toEqual(MECHANICS['lore-denial']);
  });
});

describe('usePlaystyleGuides', () => {
  it('starts from guides that have already loaded, with no loading render (#913)', async () => {
    vi.stubGlobal('fetch', byFile(() => json(MECHANICS)));
    await fetchPlaystyleGuides();
    const statusByRender: string[] = [];

    const {result} = renderHook(() => {
      const guides = usePlaystyleGuides();
      statusByRender.push(guides.status);
      return guides;
    });

    expect(statusByRender).not.toContain('loading');
    expect(result.current.guides).toEqual(GUIDES);
  });

  it('shares the request the hold started instead of fetching again', async () => {
    const fetchMock = byFile(() => json(MECHANICS));
    vi.stubGlobal('fetch', fetchMock);
    const held = fetchPlaystyleGuides();

    const {result} = renderHook(() => usePlaystyleGuides());
    await held;

    await waitFor(() => expect(result.current.status).toBe('loaded'));
    expect(result.current.guides).toEqual(GUIDES);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(GUIDES_URL);
  });

  it('says the guides failed and logs why, and the next visit asks again', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const answers = [{ok: false, status: 500}, json(GUIDES)];
    vi.stubGlobal(
      'fetch',
      byFile(
        () => json(MECHANICS),
        () => answers.shift(),
      ),
    );

    const first = renderHook(() => usePlaystyleGuides());
    await waitFor(() => expect(first.result.current.status).toBe('failed'));
    expect(first.result.current.guides).toBeNull();
    expect(consoleError).toHaveBeenCalledWith('Failed to load playstyle guides:', expect.any(Error));
    first.unmount();
    const second = renderHook(() => usePlaystyleGuides());

    await waitFor(() => expect(second.result.current.guides).toEqual(GUIDES));
  });

  it('leaves the cards and their mechanic ids loaded when the guides fail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      byFile(
        () => json(MECHANICS),
        () => ({ok: false, status: 500}),
      ),
    );

    const {result} = renderHook(() => ({
      playstyle: usePrecomputedPlaystyleCards('lore-denial'),
      guides: usePlaystyleGuides(),
    }));

    await waitFor(() => expect(result.current.guides.status).toBe('failed'));
    await waitFor(() => expect(result.current.playstyle.isLoading).toBe(false));
    expect(result.current.playstyle.cards.map((c) => c.id)).toEqual(['1', '2']);
    expect(result.current.playstyle.mechanicsStatus).toBe('loaded');
    expect(result.current.playstyle.error).toBeNull();
  });
});

describe('usePreloadPlaystyleFiles', () => {
  it('starts the mechanic ids and the guides that a playstyle opened next starts from', async () => {
    const fetchMock = byFile(() => json(MECHANICS));
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => usePreloadPlaystyleFiles(true));

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([MECHANICS_URL, GUIDES_URL]);
    await expect(fetchPlaystyleMechanicIds()).resolves.toEqual(MECHANICS);
    await expect(fetchPlaystyleGuides()).resolves.toEqual(GUIDES);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('waits until the gallery is drawn, so the requests never compete with its own', () => {
    const fetchMock = byFile(() => json(MECHANICS));
    vi.stubGlobal('fetch', fetchMock);

    const {rerender} = renderHook(({drawn}) => usePreloadPlaystyleFiles(drawn), {
      initialProps: {drawn: false},
    });
    expect(fetchMock).not.toHaveBeenCalled();
    rerender({drawn: true});

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([MECHANICS_URL, GUIDES_URL]);
  });

  it('leaves a failure to the playstyle page, which asks again', async () => {
    const failed = {ok: false, status: 503};
    const mechanicsAnswers = [failed, json(MECHANICS)];
    const guidesAnswers = [failed, json(GUIDES)];
    const fetchMock = byFile(
      () => mechanicsAnswers.shift(),
      () => guidesAnswers.shift(),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => usePreloadPlaystyleFiles(true));
    // Lets the failures settle: a rejection the hook left unhandled would fail the run.
    await new Promise((resolve) => setTimeout(resolve));

    await expect(fetchPlaystyleMechanicIds()).resolves.toEqual(MECHANICS);
    await expect(fetchPlaystyleGuides()).resolves.toEqual(GUIDES);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
