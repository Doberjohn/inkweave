import {describe, it, expect, vi, beforeEach} from 'vitest';
import {renderHook, waitFor} from '@testing-library/react';
import type {PairScore} from '../../../../shared/lib/supabase';

vi.mock('../../../../shared/lib/supabase', () => ({
  getPairScore: vi.fn(),
}));

import {getPairScore} from '../../../../shared/lib/supabase';
import {usePairScore} from '../usePairScore';

const getPairScoreMock = vi.mocked(getPairScore);

const score = (avg = 8.4): PairScore =>
  ({
    card_a_id: 'a',
    card_b_id: 'b',
    total_votes: 10,
    score_votes: 5,
    accuracy_votes: 8,
    avg_score: avg,
    accuracy_sentiment: 0,
    accuracy_lower: 2,
    accuracy_right: 4,
    accuracy_higher: 2,
    pct_real: 0.8,
    pct_would_play: 0.7,
    carries_a: 0,
    carries_b: 0,
    carries_both: 0,
    carries_neither: 0,
    avg_difficulty: 2.0,
  } as PairScore);

let counter = 0;
function uniquePair(): [string, string] {
  counter += 1;
  return [`pair-a-${counter}`, `pair-b-${counter}`];
}

describe('usePairScore', () => {
  beforeEach(() => {
    getPairScoreMock.mockReset();
  });

  it('returns loading state immediately on first render for an uncached pair', () => {
    const [a, b] = uniquePair();
    getPairScoreMock.mockResolvedValue(score());
    const {result} = renderHook(() => usePairScore(a, b));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.score).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('resolves to the fetched PairScore', async () => {
    const [a, b] = uniquePair();
    const data = score(7.2);
    getPairScoreMock.mockResolvedValue(data);
    const {result} = renderHook(() => usePairScore(a, b));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.score).toEqual(data);
    expect(result.current.error).toBeNull();
  });

  it('captures error when getPairScore rejects', async () => {
    const [a, b] = uniquePair();
    getPairScoreMock.mockRejectedValue(new Error('network down'));
    const {result} = renderHook(() => usePairScore(a, b));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.score).toBeNull();
    expect(result.current.error?.message).toBe('network down');
  });

  it('serves cached value immediately on second hook call for the same pair', async () => {
    const [a, b] = uniquePair();
    const data = score(9.1);
    getPairScoreMock.mockResolvedValue(data);
    const first = renderHook(() => usePairScore(a, b));
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));

    getPairScoreMock.mockClear();
    const second = renderHook(() => usePairScore(a, b));
    expect(second.result.current.isLoading).toBe(false);
    expect(second.result.current.score).toEqual(data);
    expect(getPairScoreMock).not.toHaveBeenCalled();
  });
});
