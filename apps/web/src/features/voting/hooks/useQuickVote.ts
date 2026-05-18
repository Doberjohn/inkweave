import {useState, useEffect, useCallback, useMemo, useRef, type MutableRefObject} from 'react';
import {
  getSupabase,
  submitVote,
  deriveAccuracyDistribution,
  type AccuracyDistribution,
  type Accuracy,
} from '../../../shared/lib/supabase';
import {usePairScore, invalidatePairScore} from './usePairScore';
import {readQuickVote, writeQuickVote} from '../lib/voteStorage';

export type {Accuracy};
export type QuickVoteState = 'hidden' | 'ready' | 'submitting' | 'result' | 'error';
export type QuickVoteError = 'submission_failed' | 'rate_limited' | null;

interface Pair {
  cardA: string;
  cardB: string;
}

// Storage parse/write helpers live in ../lib/voteStorage so the in-depth hook can share them.

// ── State resolution ──

interface ResolvedQuickVoteState {
  state: QuickVoteState;
  userChoice: Accuracy | null;
}

interface ResolveInputs {
  isAvailable: boolean;
  storedChoice: Accuracy | null;
}

/**
 * Initial / pair-reset state from the two inputs that decide it: whether
 * Supabase is reachable and whether a prior vote exists in localStorage.
 */
function resolveQuickVoteState({isAvailable, storedChoice}: ResolveInputs): ResolvedQuickVoteState {
  if (!isAvailable) return {state: 'hidden', userChoice: null};
  if (storedChoice !== null) return {state: 'result', userChoice: storedChoice};
  return {state: 'ready', userChoice: null};
}

// ── Vote submission helpers (pure) ──

interface VoteSlots {
  setState: (s: QuickVoteState) => void;
  setUserChoice: (c: Accuracy | null) => void;
  setError: (e: QuickVoteError) => void;
  submittingRef: MutableRefObject<boolean>;
}

function applyVoteFailure(slots: VoteSlots, error: NonNullable<QuickVoteError>): void {
  slots.setUserChoice(null);
  slots.setError(error);
  slots.setState('error');
}

async function performVote(slots: VoteSlots, pair: Pair, accuracy: Accuracy): Promise<void> {
  slots.setState('submitting');
  slots.setUserChoice(accuracy);
  slots.setError(null);
  try {
    const result = await submitVote({cardA: pair.cardA, cardB: pair.cardB, accuracy});
    if (!slots.submittingRef.current) return;
    if (result.error === null) {
      writeQuickVote(pair, accuracy);
      slots.setState('result');
      // Bust the shared pair-score cache so usePairScore subscribers (this hook +
      // CommunityColumn) refetch the aggregate that now includes the user's vote.
      invalidatePairScore(pair.cardA, pair.cardB);
      return;
    }
    if (result.error === 'rate_limited') {
      applyVoteFailure(slots, 'rate_limited');
      return;
    }
    console.error('[useQuickVote] Vote submission failed:', result.error, pair);
    applyVoteFailure(slots, 'submission_failed');
  } catch (err) {
    if (!slots.submittingRef.current) return;
    console.error('[useQuickVote] Unexpected error during vote submission:', err);
    applyVoteFailure(slots, 'submission_failed');
  } finally {
    slots.submittingRef.current = false;
  }
}

// ── Sub-hooks ──

interface QuickVoteSlots {
  state: QuickVoteState;
  setState: (s: QuickVoteState) => void;
  userChoice: Accuracy | null;
  setUserChoice: (c: Accuracy | null) => void;
  error: QuickVoteError;
  setError: (e: QuickVoteError) => void;
}

interface SlotsInputs {
  pair: Pair;
  isAvailable: boolean;
  storedChoice: Accuracy | null;
}

/**
 * Owns the state slots + the prev-value-during-render pair-change reset.
 * The submission-lock ref is owned by `useQuickVote` itself (refs created via
 * `useRef` should be mutated only in the hook that created them).
 */
function useQuickVoteSlots({pair, isAvailable, storedChoice}: SlotsInputs): QuickVoteSlots {
  const pairId = `${pair.cardA}:${pair.cardB}`;
  const initial = resolveQuickVoteState({isAvailable, storedChoice});
  const [state, setState] = useState<QuickVoteState>(initial.state);
  const [userChoice, setUserChoice] = useState<Accuracy | null>(initial.userChoice);
  const [error, setError] = useState<QuickVoteError>(null);
  const [prevPairId, setPrevPairId] = useState(pairId);

  if (pairId !== prevPairId) {
    setPrevPairId(pairId);
    setError(null);
    const next = resolveQuickVoteState({isAvailable, storedChoice});
    setState(next.state);
    setUserChoice(next.userChoice);
  }

  return {state, setState, userChoice, setUserChoice, error, setError};
}

/** Auto-recover from a rate-limit error after 30 seconds. */
function useRateLimitRecovery(slots: QuickVoteSlots): void {
  const {error, setState, setError} = slots;
  useEffect(() => {
    if (error !== 'rate_limited') return;
    const timer = setTimeout(() => { setState('ready'); setError(null); }, 30_000);
    return () => clearTimeout(timer);
  }, [error, setState, setError]);
}

// ── Public hook ──

export interface UseQuickVoteReturn {
  state: QuickVoteState;
  vote: (accuracy: Accuracy) => Promise<void>;
  distribution: AccuracyDistribution | null;
  distributionLoading: boolean;
  distributionFailed: boolean;
  userChoice: Accuracy | null;
  error: QuickVoteError;
}

export function useQuickVote(cardA: string, cardB: string): UseQuickVoteReturn {
  const pair = useMemo<Pair>(() => ({cardA, cardB}), [cardA, cardB]);
  const isAvailable = useMemo(() => getSupabase() !== null, []);
  const storedChoice = useMemo(() => readQuickVote(pair), [pair]);
  const slots = useQuickVoteSlots({pair, isAvailable, storedChoice});
  const submittingRef = useRef(false);
  // Single shared subscription — CommunityColumn reads the same row via usePairScore.
  const pairScore = usePairScore(cardA, cardB);

  // Reset submission lock after pair-change commit (refs can't be mutated during render).
  useEffect(() => { submittingRef.current = false; }, [pair]);

  useRateLimitRecovery(slots);

  const distribution = useMemo(
    () => deriveAccuracyDistribution(pairScore.score),
    [pairScore.score],
  );
  const distributionLoading = pairScore.isLoading;
  const distributionFailed = pairScore.error !== null;

  const {state, setState, setUserChoice, setError} = slots;
  const vote = useCallback(
    async (accuracy: Accuracy) => {
      if (state !== 'ready' && state !== 'error') return;
      if (submittingRef.current) return;
      submittingRef.current = true;
      await performVote(
        {setState, setUserChoice, setError, submittingRef},
        pair, accuracy,
      );
    },
    [pair, state, setState, setUserChoice, setError],
  );

  return {
    state: slots.state,
    vote,
    distribution,
    distributionLoading,
    distributionFailed,
    userChoice: slots.userChoice,
    error: slots.error,
  };
}
