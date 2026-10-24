import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useCardData} from '../useCardData';
import {fetchCardsFromLocal} from '../../../cards/loader';
import {_resetCardListRequest, startCardList} from '../../../cards/cardListRequest';
import {createCard} from '../../../../shared/test-utils';

vi.mock('../../../cards/loader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../cards/loader')>()),
  fetchCardsFromLocal: vi.fn(() => Promise.resolve({cards: [], sets: []})),
}));

/** Lets the mocked fetch resolve and its state updates land inside act. */
const settle = () => act(async () => {});

const LIST = {cards: [createCard({id: '1936'})], sets: [{code: '9', name: 'Fabled', number: 9}]};

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(fetchCardsFromLocal).mockClear();
  _resetCardListRequest();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCardData', () => {
  it('loads at once by default', async () => {
    renderHook(() => useCardData());

    expect(fetchCardsFromLocal).toHaveBeenCalledOnce();
    await settle();
  });

  it('holds a deferred load until requestLoad(), then loads once (#641)', async () => {
    const {result} = renderHook(() => useCardData({deferInitialLoad: true}));
    expect(fetchCardsFromLocal).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);

    act(() => result.current.requestLoad());
    act(() => result.current.requestLoad());

    expect(fetchCardsFromLocal).toHaveBeenCalledOnce();
    await settle();
  });

  it('starts a deferred load on its own 2 s after load and idle', async () => {
    renderHook(() => useCardData({deferInitialLoad: true}));

    // jsdom has already fired load and has no requestIdleCallback, so the idle wait falls back
    // to a 200 ms timer, and the 2 s delay runs after it.
    await act(() => vi.advanceTimersByTimeAsync(2150));
    expect(fetchCardsFromLocal).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(fetchCardsFromLocal).toHaveBeenCalledOnce();
  });

  // main.tsx's hold loads the list before the app renders (#915): the page's first render must
  // be the loaded one, or the prerendered page gives way to a skeleton for a frame.
  it('starts from a card list that has already loaded, with no loading render', async () => {
    vi.mocked(fetchCardsFromLocal).mockResolvedValueOnce(LIST);
    await startCardList();
    const loadingRenders: boolean[] = [];

    const {result} = renderHook(() => {
      const data = useCardData();
      loadingRenders.push(data.isLoading);
      return data;
    });
    await settle();

    expect(loadingRenders).not.toContain(true);
    expect(result.current.cards).toBe(LIST.cards);
    expect(result.current.sets).toBe(LIST.sets);
    expect(fetchCardsFromLocal).toHaveBeenCalledOnce();
  });

  it('shares the request the hold started instead of fetching again', async () => {
    vi.mocked(fetchCardsFromLocal).mockResolvedValueOnce(LIST);
    void startCardList();

    const {result} = renderHook(() => useCardData());
    await settle();

    expect(result.current.cards).toBe(LIST.cards);
    expect(fetchCardsFromLocal).toHaveBeenCalledOnce();
  });

  it('fetches again on a retry after a failed load', async () => {
    vi.mocked(fetchCardsFromLocal).mockRejectedValueOnce(new Error('offline'));
    vi.mocked(fetchCardsFromLocal).mockResolvedValueOnce(LIST);
    const {result} = renderHook(() => useCardData());
    await settle();
    expect(result.current.error?.message).toBe('offline');

    act(() => result.current.retryLoad());
    await settle();

    expect(result.current.error).toBeNull();
    expect(result.current.cards).toBe(LIST.cards);
    expect(fetchCardsFromLocal).toHaveBeenCalledTimes(2);
  });
});
