import {useState} from 'react';
import {isSupabaseConfigured, submitVote, type Score} from '../../../shared/lib/supabase';
import type {VoteFormState, VotingPair} from '../types';
import {trackPairVote} from '../lib/voteAnalytics';

export interface UseVoteSessionReturn {
  formState: VoteFormState;
  setScore: (score: Score) => void;
  /** Submit immediately with a specific score (bypasses async state) */
  submitWithScore: (score: Score) => Promise<void>;
  isSubmitting: boolean;
  lastResult: 'success' | 'rate_limited' | 'error' | null;
  isRateLimited: boolean;
  isSupabaseAvailable: boolean;
  resetForm: () => void;
}

export function useVoteSession(currentPair: VotingPair | null): UseVoteSessionReturn {
  const [formState, setFormState] = useState<VoteFormState>({score: null, whoCarries: 'both'});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<'success' | 'rate_limited' | 'error' | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const isSupabaseAvailable = isSupabaseConfigured();

  const setScore = (score: Score) => {
    setFormState((prev) => ({...prev, score}));
  };

  const resetForm = () => {
    setFormState({score: null, whoCarries: 'both'});
    setLastResult(null);
  };

  const submitWithScore = async (score: Score) => {
    if (!currentPair || isRateLimited) return;

    setFormState((prev) => ({...prev, score}));
    setIsSubmitting(true);
    setLastResult(null);

    try {
      const result = await submitVote({
        cardA: currentPair.cardA.id,
        cardB: currentPair.cardB.id,
        score,
        whoCarries: 'both',
      });

      if (result.error === null) {
        setLastResult('success');
        // The /vote one-click score surface was previously untracked; emit here so it
        // joins the modal-thumbs and in-depth surfaces under `vote_submitted`.
        trackPairVote('score', currentPair, score);
      } else if (result.error === 'rate_limited') {
        setLastResult('rate_limited');
        setIsRateLimited(true);
      } else {
        setLastResult('error');
      }
    } catch (err) {
      console.error('[useVoteSession] Unexpected error during vote submission:', err);
      setLastResult('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formState,
    setScore,
    submitWithScore,
    isSubmitting,
    lastResult,
    isRateLimited,
    isSupabaseAvailable,
    resetForm,
  };
}
