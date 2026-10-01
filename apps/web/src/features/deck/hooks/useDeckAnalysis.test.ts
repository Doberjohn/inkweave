import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, renderHook} from '@testing-library/react';
import type {Deck, LorcanaCard} from '../types';
import {useDeckAnalysis} from './useDeckAnalysis';

// Mock the analyzer (test the hook's async plumbing, not analyzeDeck's logic) and
// the per-card synergy fetch. vi.hoisted lets the mock factories see these.
const {analyzeDeckMock, fetchCardSynergiesMock} = vi.hoisted(() => ({
  analyzeDeckMock: vi.fn(),
  fetchCardSynergiesMock: vi.fn(),
}));
vi.mock('../analysis/analyzeDeck', () => ({analyzeDeck: (...args: unknown[]) => analyzeDeckMock(...args)}));
vi.mock('../../synergies/hooks/usePrecomputedSynergies', () => ({
  fetchCardSynergies: (id: string) => fetchCardSynergiesMock(id),
}));

const deck = (cardIds: string[]): Deck => ({
  id: 'd',
  name: 'D',
  cards: cardIds.map((cardId) => ({cardId, quantity: 1})),
  inks: [],
  createdAt: 0,
  updatedAt: 0,
  schemaVersion: 1,
});

const getCardById = (): LorcanaCard | undefined => undefined; // unused: analyzeDeck is mocked

const flush = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  analyzeDeckMock.mockReset().mockReturnValue({stats: {}, synergy: {}, health: {}, quality: {score: 50}});
  fetchCardSynergiesMock.mockReset().mockResolvedValue({groups: [], pairs: {}});
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ok: true, headers: {get: () => 'application/json'}, json: async () => []}),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useDeckAnalysis', () => {
  it('produces no analysis for an empty deck', async () => {
    const {result} = renderHook(() => useDeckAnalysis(deck([]), getCardById, true, []));
    await flush(500);
    expect(analyzeDeckMock).not.toHaveBeenCalled();
    expect(result.current.analysis).toBeNull();
  });

  it('waits for card-DB readiness, then analyzes when ready flips true', async () => {
    const d = deck(['a', 'b']);
    const {result, rerender} = renderHook(({ready}) => useDeckAnalysis(d, getCardById, ready, []), {
      initialProps: {ready: false},
    });
    await flush(500);
    expect(analyzeDeckMock).not.toHaveBeenCalled(); // not ready → never runs on an empty resolver

    rerender({ready: true});
    await flush(500);
    expect(analyzeDeckMock).toHaveBeenCalledTimes(1); // ready flipped → re-ran and analyzed
    expect(result.current.analysis).not.toBeNull();
  });

  it('debounces rapid deck edits into a single analysis', async () => {
    const {rerender} = renderHook(({d}) => useDeckAnalysis(d, getCardById, true, []), {
      initialProps: {d: deck(['a'])},
    });
    for (const ids of [['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd']]) {
      rerender({d: deck(ids)});
      await flush(100); // each edit lands inside the 300ms debounce window
    }
    await flush(500); // let the last edit settle
    expect(analyzeDeckMock).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending analysis on unmount', async () => {
    const {unmount} = renderHook(() => useDeckAnalysis(deck(['a']), getCardById, true, []));
    unmount(); // before the 300ms debounce fires
    await flush(500);
    expect(analyzeDeckMock).not.toHaveBeenCalled();
  });
});
