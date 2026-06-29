import {renderHook, waitFor} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

// Stable card references (mirrors CardDataContext.getCardById, which returns the
// same object per id from a map built once).
const cardA = {id: '2730', fullName: 'Card A'} as never;
const cardB = {id: '2718', fullName: 'Card B'} as never;

vi.mock('../../../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({
    getCardById: (id: string) => (id === '2730' ? cardA : id === '2718' ? cardB : undefined),
  }),
}));

vi.mock('../../../synergies/hooks/usePrecomputedSynergies', () => ({
  fetchCardSynergies: vi.fn(async () => ({
    pairs: {'2718': {connections: [], aggregateScore: 5}},
  })),
}));

import {fetchCardSynergies} from '../../../synergies/hooks/usePrecomputedSynergies';
import {useSpecificPair} from '../useSpecificPair';

describe('useSpecificPair', () => {
  beforeEach(() => {
    vi.mocked(fetchCardSynergies).mockClear();
  });

  // Regression guard for the in-depth-vote render loop (#386 fallout): the fetch
  // effect must key on stable values, not a fresh `resolved` object each render.
  // With the bug the effect re-fires every render, re-calling fetchCardSynergies
  // (and tripping React's "Maximum update depth exceeded").
  it('resolves the pair with a single fetch and does not loop', async () => {
    const {result} = renderHook(() => useSpecificPair('2730', '2718'));

    await waitFor(() => expect(result.current.pair).not.toBeNull());

    expect(result.current.pair?.cardA).toBe(cardA);
    expect(result.current.pair?.cardB).toBe(cardB);
    expect(fetchCardSynergies).toHaveBeenCalledTimes(1);
  });

  it('reports an error without fetching when a card id is unknown', () => {
    const {result} = renderHook(() => useSpecificPair('2730', 'nope'));

    expect(result.current.error).toBe('One or both cards not found');
    expect(fetchCardSynergies).not.toHaveBeenCalled();
  });
});
