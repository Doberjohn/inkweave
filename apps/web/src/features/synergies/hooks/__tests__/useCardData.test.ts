import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useCardData} from '../useCardData';
import {fetchCardsFromLocal} from '../../../cards';

vi.mock('../../../cards', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../cards')>()),
  fetchCardsFromLocal: vi.fn(() => Promise.resolve({cards: [], sets: []})),
}));

/** Lets the mocked fetch resolve and its state updates land inside act. */
const settle = () => act(async () => {});

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(fetchCardsFromLocal).mockClear();
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

  it('starts a deferred load on its own at the next idle moment', async () => {
    renderHook(() => useCardData({deferInitialLoad: true}));
    expect(fetchCardsFromLocal).not.toHaveBeenCalled();

    // jsdom has no requestIdleCallback, so whenIdle falls back to a 200 ms timer.
    await act(() => vi.advanceTimersByTimeAsync(250));

    expect(fetchCardsFromLocal).toHaveBeenCalledOnce();
  });
});
