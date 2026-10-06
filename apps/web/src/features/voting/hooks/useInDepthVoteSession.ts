import {useState} from 'react';
import {isSupabaseConfigured, submitVote, type Accuracy, type Score, type InDepthVote} from '../../../shared/lib/supabase';
import type {InDepthFormState, VotingPair} from '../types';
import {writeInDepthVote} from '../lib/voteStorage';
import {trackPairVote} from '../lib/voteAnalytics';

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

  const isSupabaseAvailable = isSupabaseConfigured();

  const hasAnyAnswer = hasAnyFormAnswer(formState);

  const setIsReal = (value: boolean | null) => {
    setFormState((prev) => ({...prev, isReal: value}));
  };

  const setAccuracy = (value: Accuracy) => {
    setFormState((prev) => ({...prev, accuracy: value}));
  };

  const setScore = (value: Score) => {
    setFormState((prev) => ({...prev, score: value}));
  };

  const setWouldPlay = (value: boolean | null) => {
    setFormState((prev) => ({...prev, wouldPlay: value}));
  };

  const setWhoCarries = (value: 'a' | 'b' | 'both') => {
    setFormState((prev) => ({...prev, whoCarries: value}));
  };

  const setDifficulty = (value: 1 | 2 | 3) => {
    setFormState((prev) => ({...prev, difficulty: value}));
  };

  const resetForm = () => {
    setFormState(INITIAL_STATE);
    setLastResult(null);
  };

  const submit = async () => {
    if (isSubmitGated({currentPair, isRateLimited, hasAnyAnswer})) return;
    // Redundant with isSubmitGated's !currentPair check, but narrows the opaque
    // boolean gate to VotingPair for buildInDepthVote/applySubmitResult below.
    if (!currentPair) return;
    setIsSubmitting(true);
    setLastResult(null);
    try {
      const vote = buildInDepthVote(currentPair, formState);
      const result = await submitVote(vote);
      applySubmitResult({result, currentPair, formState, setLastResult, setIsRateLimited});
    } catch (err) {
      console.error('[useInDepthVoteSession] Unexpected error:', err);
      setLastResult('error');
    } finally {
      setIsSubmitting(false);
    }
  };

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

function hasAnyFormAnswer(formState: InDepthFormState): boolean {
  if (formState.isReal !== null) return true;
  if (formState.accuracy !== null) return true;
  if (formState.score !== null) return true;
  if (formState.wouldPlay !== null) return true;
  if (formState.whoCarries !== null) return true;
  if (formState.difficulty !== null) return true;
  return false;
}

interface SubmitGateInput {
  currentPair: VotingPair | null;
  isRateLimited: boolean;
  hasAnyAnswer: boolean;
}

/** True when the form can't be submitted yet — missing pair, rate-limited, or no answers. */
function isSubmitGated({currentPair, isRateLimited, hasAnyAnswer}: SubmitGateInput): boolean {
  if (!currentPair) return true;
  if (isRateLimited) return true;
  if (!hasAnyAnswer) return true;
  return false;
}

/** Compose the wire-format vote object — only the dimensions the user answered are included. */
function buildInDepthVote(currentPair: VotingPair, formState: InDepthFormState): InDepthVote {
  const vote: InDepthVote = {cardA: currentPair.cardA.id, cardB: currentPair.cardB.id};
  if (formState.isReal !== null) vote.isReal = formState.isReal;
  if (formState.accuracy !== null) vote.accuracy = formState.accuracy;
  if (formState.score !== null) vote.score = formState.score;
  if (formState.wouldPlay !== null) vote.wouldPlay = formState.wouldPlay;
  if (formState.whoCarries !== null) vote.whoCarries = formState.whoCarries;
  if (formState.difficulty !== null) vote.difficulty = formState.difficulty;
  return vote;
}

interface ApplySubmitResultInput {
  result: Awaited<ReturnType<typeof submitVote>>;
  currentPair: VotingPair;
  formState: InDepthFormState;
  setLastResult: (r: 'success' | 'rate_limited' | 'error' | null) => void;
  setIsRateLimited: (v: boolean) => void;
}

/** Branch on the submit result, persist on success, and surface the right last-result label. */
function applySubmitResult({result, currentPair, formState, setLastResult, setIsRateLimited}: ApplySubmitResultInput): void {
  if (result.error === null) {
    writeInDepthVote(
      {cardA: currentPair.cardA.id, cardB: currentPair.cardB.id},
      {accuracy: formState.accuracy ?? undefined, score: formState.score ?? undefined},
    );
    // Headline signal is the 1-10 score; fall back to accuracy when the user left score blank.
    trackPairVote('in_depth', currentPair, formState.score ?? formState.accuracy ?? null);
    setLastResult('success');
    return;
  }
  if (result.error === 'rate_limited') {
    setLastResult('rate_limited');
    setIsRateLimited(true);
    return;
  }
  setLastResult('error');
}
