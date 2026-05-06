import {useState, useCallback, useMemo} from 'react';
import {getSupabase, submitVote, type Accuracy, type Score, type InDepthVote} from '../../../shared/lib/supabase';
import type {InDepthFormState, VotingPair} from '../types';
import {writeInDepthVote} from '../lib/voteStorage';

const INITIAL_STATE: InDepthFormState = {
  isReal: null,
  accuracy: null,
  score: null,
  wouldPlay: null,
  whoCarries: null,
  difficulty: null,
};

export interface UseInDepthVoteSessionReturn {
  formState: InDepthFormState;
  setIsReal: (value: boolean | null) => void;
  setAccuracy: (value: Accuracy) => void;
  setScore: (value: Score) => void;
  setWouldPlay: (value: boolean | null) => void;
  setWhoCarries: (value: 'a' | 'b' | 'both') => void;
  setDifficulty: (value: 1 | 2 | 3) => void;
  submit: () => Promise<void>;
  hasAnyAnswer: boolean;
  isSubmitting: boolean;
  lastResult: 'success' | 'rate_limited' | 'error' | null;
  isRateLimited: boolean;
  isSupabaseAvailable: boolean;
  resetForm: () => void;
}

export function useInDepthVoteSession(currentPair: VotingPair | null): UseInDepthVoteSessionReturn {
  const [formState, setFormState] = useState<InDepthFormState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<'success' | 'rate_limited' | 'error' | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const isSupabaseAvailable = useMemo(() => getSupabase() !== null, []);

  const hasAnyAnswer = formState.isReal !== null
    || formState.accuracy !== null
    || formState.score !== null
    || formState.wouldPlay !== null
    || formState.whoCarries !== null
    || formState.difficulty !== null;

  const setIsReal = useCallback((value: boolean | null) => {
    setFormState((prev) => ({...prev, isReal: value}));
  }, []);

  const setAccuracy = useCallback((value: Accuracy) => {
    setFormState((prev) => ({...prev, accuracy: value}));
  }, []);

  const setScore = useCallback((value: Score) => {
    setFormState((prev) => ({...prev, score: value}));
  }, []);

  const setWouldPlay = useCallback((value: boolean | null) => {
    setFormState((prev) => ({...prev, wouldPlay: value}));
  }, []);

  const setWhoCarries = useCallback((value: 'a' | 'b' | 'both') => {
    setFormState((prev) => ({...prev, whoCarries: value}));
  }, []);

  const setDifficulty = useCallback((value: 1 | 2 | 3) => {
    setFormState((prev) => ({...prev, difficulty: value}));
  }, []);

  const resetForm = useCallback(() => {
    setFormState(INITIAL_STATE);
    setLastResult(null);
  }, []);

  const submit = useCallback(async () => {
    if (!currentPair || isRateLimited || !hasAnyAnswer) return;

    setIsSubmitting(true);
    setLastResult(null);

    try {
      const vote: InDepthVote = {
        cardA: currentPair.cardA.id,
        cardB: currentPair.cardB.id,
      };

      // Only include non-null dimensions
      if (formState.isReal !== null) vote.isReal = formState.isReal;
      if (formState.accuracy !== null) vote.accuracy = formState.accuracy;
      if (formState.score !== null) vote.score = formState.score;
      if (formState.wouldPlay !== null) vote.wouldPlay = formState.wouldPlay;
      if (formState.whoCarries !== null) vote.whoCarries = formState.whoCarries;
      if (formState.difficulty !== null) vote.difficulty = formState.difficulty;

      const result = await submitVote(vote);

      if (result.error === null) {
        writeInDepthVote(currentPair.cardA.id, currentPair.cardB.id, {
          accuracy: formState.accuracy ?? undefined,
          score: formState.score ?? undefined,
        });
        setLastResult('success');
      } else if (result.error === 'rate_limited') {
        setLastResult('rate_limited');
        setIsRateLimited(true);
      } else {
        setLastResult('error');
      }
    } catch (err) {
      console.error('[useInDepthVoteSession] Unexpected error:', err);
      setLastResult('error');
    } finally {
      setIsSubmitting(false);
    }
  }, [currentPair, isRateLimited, hasAnyAnswer, formState]);

  return {
    formState,
    setIsReal,
    setAccuracy,
    setScore,
    setWouldPlay,
    setWhoCarries,
    setDifficulty,
    submit,
    hasAnyAnswer,
    isSubmitting,
    lastResult,
    isRateLimited,
    isSupabaseAvailable,
    resetForm,
  };
}
