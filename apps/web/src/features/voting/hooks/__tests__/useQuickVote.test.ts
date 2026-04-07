import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useQuickVote} from '../useQuickVote';
import {getSupabase, submitVote, getAccuracyDistribution} from '../../../../shared/lib/supabase';

vi.mock('../../../../shared/lib/supabase', () => ({
  getSupabase: vi.fn(),
  submitVote: vi.fn(),
  getAccuracyDistribution: vi.fn(),
}));

const CARD_A = 'card-aaa';
const CARD_B = 'card-bbb';
const STORAGE_KEY = `inkweave:vote:${CARD_A}:${CARD_B}`;

describe('useQuickVote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
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

  it('returns result state when pair found in localStorage', async () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    vi.mocked(getAccuracyDistribution).mockResolvedValue({
      lower: 3, right: 10, higher: 2, total: 15,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({accuracy: 0, timestamp: Date.now()}));

    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));
    expect(result.current.state).toBe('result');
    expect(result.current.userChoice).toBe(0);
  });

  it('submits vote, stores in localStorage, and fetches distribution', async () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    vi.mocked(submitVote).mockResolvedValue({error: null});
    vi.mocked(getAccuracyDistribution).mockResolvedValue({
      lower: 1, right: 5, higher: 0, total: 6,
    });

    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));
    expect(result.current.state).toBe('ready');

    await act(async () => {
      await result.current.vote(0);
    });

    expect(submitVote).toHaveBeenCalledWith({
      cardA: CARD_A,
      cardB: CARD_B,
      accuracy: 0,
    });
    expect(result.current.state).toBe('result');
    expect(result.current.userChoice).toBe(0);
    expect(result.current.distribution).toEqual({
      lower: 1, right: 5, higher: 0, total: 6,
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
    vi.mocked(getAccuracyDistribution).mockResolvedValue({
      lower: 0, right: 3, higher: 1, total: 4,
    });

    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));

    // First attempt fails
    await act(async () => {
      await result.current.vote(0);
    });
    expect(result.current.state).toBe('error');

    // Retry succeeds
    await act(async () => {
      await result.current.vote(0);
    });
    expect(result.current.state).toBe('result');
    expect(submitVote).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('finds stored vote regardless of card argument order', () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    vi.mocked(getAccuracyDistribution).mockResolvedValue({
      lower: 1, right: 5, higher: 0, total: 6,
    });
    // Store under canonical key (card-aaa comes first alphabetically)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({accuracy: 1, timestamp: Date.now()}));

    // Pass cards in REVERSED order
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

    // Start voting but don't resolve yet
    act(() => { result.current.vote(1); });
    expect(result.current.state).toBe('submitting');
    expect(result.current.userChoice).toBe(1);

    // Resolve and clean up
    vi.mocked(getAccuracyDistribution).mockResolvedValue({lower: 0, right: 0, higher: 1, total: 1});
    await act(async () => { resolveVote!({error: null}); });
    expect(result.current.state).toBe('result');
  });

  it('ignores vote() calls from result state (double-submit guard)', async () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    vi.mocked(submitVote).mockResolvedValue({error: null});
    vi.mocked(getAccuracyDistribution).mockResolvedValue({lower: 0, right: 1, higher: 0, total: 1});

    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));

    await act(async () => { await result.current.vote(0); });
    expect(result.current.state).toBe('result');

    // Try voting again from result state — should be a no-op
    await act(async () => { await result.current.vote(-1); });
    expect(submitVote).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('result');
    expect(result.current.userChoice).toBe(0);
  });
});
