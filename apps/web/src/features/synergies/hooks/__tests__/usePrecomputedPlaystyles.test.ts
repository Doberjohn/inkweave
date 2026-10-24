import {afterEach, beforeEach, describe, it, expect, vi} from 'vitest';
import {act, renderHook, waitFor} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useAllPlaystyleCards} from '../usePrecomputedPlaystyles';
import {_resetPlaystyleCardIds, fetchPlaystyleCardIds} from '../playstyleCardIds';

const cardsById: Record<string, LorcanaCard> = {
  '1': {id: '1', fullName: 'Ariel - Spectacular Singer'} as LorcanaCard,
  '2': {id: '2', fullName: 'Belle - Bookworm'} as LorcanaCard,
};

vi.mock('../../../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({getCardById: (id: string) => cardsById[id]}),
}));

const IDS = {'lore-denial': ['2', '1']};
const json = (body: unknown) => ({
  ok: true,
  headers: {get: () => 'application/json'},
  json: async () => body,
});

beforeEach(() => {
  _resetPlaystyleCardIds();
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
