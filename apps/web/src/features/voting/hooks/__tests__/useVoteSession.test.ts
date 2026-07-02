import {describe, it, expect, vi, beforeEach} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useVoteSession} from '../useVoteSession';
import {getSupabase, submitVote} from '../../../../shared/lib/supabase';
import {trackPairVote} from '../../lib/voteAnalytics';
import {createVotingPair} from '../../../../shared/test-utils';

vi.mock('../../../../shared/lib/supabase', () => ({
  getSupabase: vi.fn(),
  submitVote: vi.fn(),
}));

vi.mock('../../lib/voteAnalytics', () => ({
  trackPairVote: vi.fn(),
}));

const mockPair = createVotingPair({
  cardA: {id: 'card-a', fullName: 'Card A - Hero'},
  cardB: {id: 'card-b', fullName: 'Card B - Villain'},
  aggregateScore: 8,
});

describe('useVoteSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial state ──

  describe('initial state', () => {
    it('score is null, whoCarries is both', () => {
      vi.mocked(getSupabase).mockReturnValue(null);
      const {result} = renderHook(() => useVoteSession(mockPair));

      expect(result.current.formState.score).toBeNull();
      expect(result.current.formState.whoCarries).toBe('both');
    });

    it('isSubmitting is false', () => {
      vi.mocked(getSupabase).mockReturnValue(null);
      const {result} = renderHook(() => useVoteSession(mockPair));

      expect(result.current.isSubmitting).toBe(false);
    });

    it('lastResult is null', () => {
      vi.mocked(getSupabase).mockReturnValue(null);
      const {result} = renderHook(() => useVoteSession(mockPair));

      expect(result.current.lastResult).toBeNull();
    });
  });

  // ── setScore ──

  describe('setScore', () => {
    it('updates formState.score', () => {
      vi.mocked(getSupabase).mockReturnValue(null);
      const {result} = renderHook(() => useVoteSession(mockPair));

      act(() => {
        result.current.setScore(7);
      });

      expect(result.current.formState.score).toBe(7);
    });
  });

  // ── resetForm ──

  describe('resetForm', () => {
    it('clears score and lastResult', async () => {
      vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
      vi.mocked(submitVote).mockResolvedValue({error: null});
      const {result} = renderHook(() => useVoteSession(mockPair));

      // Set score first
      act(() => {
        result.current.setScore(5);
      });

      expect(result.current.formState.score).toBe(5);

      // Submit to get a lastResult
      await act(async () => {
        await result.current.submitWithScore(5);
      });

      expect(result.current.lastResult).toBe('success');

      // Reset
      act(() => {
        result.current.resetForm();
      });

      expect(result.current.formState.score).toBeNull();
      expect(result.current.formState.whoCarries).toBe('both');
      expect(result.current.lastResult).toBeNull();
    });
  });

  // ── submitWithScore (Supabase available) ──

  describe('submitWithScore (Supabase available)', () => {
    beforeEach(() => {
      vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    });

    it('calls submitVote with correct params', async () => {
      vi.mocked(submitVote).mockResolvedValue({error: null});
      const {result} = renderHook(() => useVoteSession(mockPair));

      await act(async () => {
        await result.current.submitWithScore(8);
      });

      expect(submitVote).toHaveBeenCalledWith({
        cardA: 'card-a',
        cardB: 'card-b',
        score: 8,
        whoCarries: 'both',
      });
    });

    it('sets lastResult to success on success', async () => {
      vi.mocked(submitVote).mockResolvedValue({error: null});
      const {result} = renderHook(() => useVoteSession(mockPair));

      await act(async () => {
        await result.current.submitWithScore(7);
      });

      expect(result.current.lastResult).toBe('success');
    });

    it('tracks vote_submitted with voteType score on success', async () => {
      vi.mocked(submitVote).mockResolvedValue({error: null});
      const {result} = renderHook(() => useVoteSession(mockPair));

      await act(async () => {
        await result.current.submitWithScore(8);
      });

      expect(trackPairVote).toHaveBeenCalledWith('score', mockPair, 8);
    });

    it('does not track when submission fails', async () => {
      vi.mocked(submitVote).mockResolvedValue({error: 'Something went wrong'});
      const {result} = renderHook(() => useVoteSession(mockPair));

      await act(async () => {
        await result.current.submitWithScore(5);
      });

      expect(trackPairVote).not.toHaveBeenCalled();
    });

    it('sets lastResult to rate_limited on rate limit', async () => {
      vi.mocked(submitVote).mockResolvedValue({error: 'rate_limited'});
      const {result} = renderHook(() => useVoteSession(mockPair));

      await act(async () => {
        await result.current.submitWithScore(6);
      });

      expect(result.current.lastResult).toBe('rate_limited');
    });

    it('sets isRateLimited on rate limit', async () => {
      vi.mocked(submitVote).mockResolvedValue({error: 'rate_limited'});
      const {result} = renderHook(() => useVoteSession(mockPair));

      expect(result.current.isRateLimited).toBe(false);

      await act(async () => {
        await result.current.submitWithScore(6);
      });

      expect(result.current.isRateLimited).toBe(true);
    });

    it('sets lastResult to error on error', async () => {
      vi.mocked(submitVote).mockResolvedValue({error: 'Something went wrong'});
      const {result} = renderHook(() => useVoteSession(mockPair));

      await act(async () => {
        await result.current.submitWithScore(5);
      });

      expect(result.current.lastResult).toBe('error');
    });

    it('sets isSubmitting during submission', async () => {
      let resolveSubmit: (value: {error: null}) => void;
      vi.mocked(submitVote).mockImplementation(
        () => new Promise((resolve) => { resolveSubmit = resolve; }),
      );

      const {result} = renderHook(() => useVoteSession(mockPair));

      expect(result.current.isSubmitting).toBe(false);

      // Start submission without awaiting
      let submitPromise: Promise<void>;
      act(() => {
        submitPromise = result.current.submitWithScore(8);
      });

      // isSubmitting should be true while waiting
      expect(result.current.isSubmitting).toBe(true);

      // Resolve the submission
      await act(async () => {
        resolveSubmit!({error: null});
        await submitPromise!;
      });

      expect(result.current.isSubmitting).toBe(false);
    });
  });

  // ── submitWithScore (Supabase unavailable) ──

  describe('submitWithScore (Supabase unavailable)', () => {
    beforeEach(() => {
      vi.mocked(getSupabase).mockReturnValue(null);
      vi.mocked(submitVote).mockResolvedValue({error: 'Supabase not configured'});
    });

    it('calls submitVote which returns error', async () => {
      const {result} = renderHook(() => useVoteSession(mockPair));

      await act(async () => {
        await result.current.submitWithScore(7);
      });

      expect(submitVote).toHaveBeenCalled();
      expect(result.current.lastResult).toBe('error');
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  // ── submitWithScore (no current pair) ──

  describe('submitWithScore (no current pair)', () => {
    it('does nothing when currentPair is null', async () => {
      vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
      const {result} = renderHook(() => useVoteSession(null));

      await act(async () => {
        await result.current.submitWithScore(5);
      });

      expect(submitVote).not.toHaveBeenCalled();
      expect(result.current.lastResult).toBeNull();
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  // ── isSupabaseAvailable ──

  describe('isSupabaseAvailable', () => {
    it('returns true when getSupabase returns a client', () => {
      vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
      const {result} = renderHook(() => useVoteSession(mockPair));

      expect(result.current.isSupabaseAvailable).toBe(true);
    });

    it('returns false when getSupabase returns null', () => {
      vi.mocked(getSupabase).mockReturnValue(null);
      const {result} = renderHook(() => useVoteSession(mockPair));

      expect(result.current.isSupabaseAvailable).toBe(false);
    });
  });
});
