import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {renderHook, act, waitFor} from '@testing-library/react';
import {useQuickVote} from '../useQuickVote';
import {_resetPairScoreCache} from '../usePairScore';
import {getSupabase, submitVote, getPairScore, type PairScore} from '../../../../shared/lib/supabase';

vi.mock('../../../../shared/lib/supabase', () => ({
  getSupabase: vi.fn(),
  submitVote: vi.fn(),
  getPairScore: vi.fn(),
  deriveAccuracyDistribution: (score: PairScore | null) => {
    if (!score) return null;
    const lower = score.accuracy_lower ?? 0;
    const right = score.accuracy_right ?? 0;
    const higher = score.accuracy_higher ?? 0;
    return {lower, right, higher, total: lower + right + higher};
  },
}));

const CARD_A = 'card-aaa';
const CARD_B = 'card-bbb';
const STORAGE_KEY = `inkweave:vote:${CARD_A}:${CARD_B}`;

function makePairScore(lower: number, right: number, higher: number): PairScore {
  return {accuracy_lower: lower, accuracy_right: right, accuracy_higher: higher} as unknown as PairScore;
}

describe('useQuickVote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _resetPairScoreCache();
    // Default: no aggregate row yet (pair has no votes). Tests that need a populated
    // distribution override this with their own mock.
    vi.mocked(getPairScore).mockResolvedValue(null);
  });

  afterEach(() => {
    localStorage.clear();
    _resetPairScoreCache();
  });

  it('returns hidden state when Supabase is unavailable', () => {
    vi.mocked(getSupabase).mockReturnValue(null);
    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));
    expect(result.current.state).toBe('hidden');
  });

  it('returns ready state when Supabase is available and no prior vote', () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));
    expect(result.current.state).toBe('ready');
  });

  it('returns result state when pair found in localStorage', () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    vi.mocked(getPairScore).mockResolvedValue(makePairScore(3, 10, 2));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({accuracy: 0, timestamp: Date.now()}));

    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));
    expect(result.current.state).toBe('result');
    expect(result.current.userChoice).toBe(0);
  });

  it('submits vote, stores in localStorage, and refreshes distribution', async () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    vi.mocked(submitVote).mockResolvedValue({error: null});
    // Pre-vote aggregate; post-vote refetch returns the same shape (mock is the same).
    vi.mocked(getPairScore).mockResolvedValue(makePairScore(1, 5, 0));

    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));
    expect(result.current.state).toBe('ready');

    await act(async () => {
      await result.current.vote(0);
    });

    expect(submitVote).toHaveBeenCalledWith({cardA: CARD_A, cardB: CARD_B, accuracy: 0});
    expect(result.current.state).toBe('result');
    expect(result.current.userChoice).toBe(0);
    await waitFor(() => {
      expect(result.current.distribution).toEqual({lower: 1, right: 5, higher: 0, total: 6});
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('transitions to error state on submission failure', async () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    vi.mocked(submitVote).mockResolvedValue({error: 'Network error'});

    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));

    await act(async () => {
      await result.current.vote(1);
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('submission_failed');
    expect(result.current.userChoice).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('retries successfully from error state', async () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    vi.mocked(submitVote).mockResolvedValueOnce({error: 'Network error'});
    vi.mocked(submitVote).mockResolvedValueOnce({error: null});
    vi.mocked(getPairScore).mockResolvedValue(makePairScore(0, 3, 1));

    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));

    await act(async () => {
      await result.current.vote(0);
    });
    expect(result.current.state).toBe('error');

    await act(async () => {
      await result.current.vote(0);
    });
    expect(result.current.state).toBe('result');
    expect(submitVote).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('finds stored vote regardless of card argument order', () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    vi.mocked(getPairScore).mockResolvedValue(makePairScore(1, 5, 0));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({accuracy: 1, timestamp: Date.now()}));

    const {result} = renderHook(() => useQuickVote(CARD_B, CARD_A));
    expect(result.current.state).toBe('result');
    expect(result.current.userChoice).toBe(1);
  });

  it('transitions to rate-limited state', async () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    vi.mocked(submitVote).mockResolvedValue({error: 'rate_limited'});

    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));

    await act(async () => {
      await result.current.vote(-1);
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('rate_limited');
    expect(result.current.userChoice).toBeNull();
  });

  it('sets userChoice optimistically during submitting', async () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    let resolveVote: (v: {error: null}) => void;
    vi.mocked(submitVote).mockReturnValue(new Promise((r) => { resolveVote = r; }));

    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));

    act(() => { result.current.vote(1); });
    expect(result.current.state).toBe('submitting');
    expect(result.current.userChoice).toBe(1);

    vi.mocked(getPairScore).mockResolvedValue(makePairScore(0, 0, 1));
    await act(async () => { resolveVote!({error: null}); });
    expect(result.current.state).toBe('result');
  });

  it('resets state when card pair changes', async () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    vi.mocked(submitVote).mockResolvedValue({error: null});
    vi.mocked(getPairScore).mockResolvedValue(makePairScore(0, 1, 0));

    let pairA = CARD_A;
    let pairB = CARD_B;
    const {result, rerender} = renderHook(() => useQuickVote(pairA, pairB));

    await act(async () => { await result.current.vote(0); });
    expect(result.current.state).toBe('result');
    expect(result.current.userChoice).toBe(0);

    // Switch to a different pair (no votes mocked → distribution null).
    vi.mocked(getPairScore).mockResolvedValue(null);
    pairA = 'card-ccc';
    pairB = 'card-ddd';
    rerender();

    expect(result.current.state).toBe('ready');
    expect(result.current.userChoice).toBeNull();
    await waitFor(() => {
      expect(result.current.distribution).toBeNull();
    });
  });

  it('auto-recovers from rate-limited state after 30 seconds', async () => {
    vi.useFakeTimers();
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    vi.mocked(submitVote).mockResolvedValue({error: 'rate_limited'});

    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));

    await act(async () => {
      await result.current.vote(-1);
    });
    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('rate_limited');

    act(() => { vi.advanceTimersByTime(30_000); });
    expect(result.current.state).toBe('ready');
    expect(result.current.error).toBeNull();

    vi.useRealTimers();
  });

  it('prevents concurrent double-submission via ref guard', async () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    let resolveVote!: (v: {error: null}) => void;
    vi.mocked(submitVote).mockReturnValue(new Promise((r) => { resolveVote = r; }));

    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));

    act(() => { result.current.vote(1); });
    act(() => { result.current.vote(-1); });

    expect(submitVote).toHaveBeenCalledTimes(1);

    vi.mocked(getPairScore).mockResolvedValue(makePairScore(0, 0, 1));
    await act(async () => { resolveVote({error: null}); });
  });

  it('ignores vote() calls from result state (double-submit guard)', async () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    vi.mocked(submitVote).mockResolvedValue({error: null});
    vi.mocked(getPairScore).mockResolvedValue(makePairScore(0, 1, 0));

    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));

    await act(async () => { await result.current.vote(0); });
    expect(result.current.state).toBe('result');

    await act(async () => { await result.current.vote(-1); });
    expect(submitVote).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('result');
    expect(result.current.userChoice).toBe(0);
  });

});
