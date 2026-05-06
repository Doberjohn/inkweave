import {useState, useEffect, useCallback, useMemo, useRef, type MutableRefObject} from 'react';
import {
  getSupabase,
  submitVote,
  getAccuracyDistribution,
  type AccuracyDistribution,
  type Accuracy,
} from '../../../shared/lib/supabase';
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
  setDistribution: (d: AccuracyDistribution | null) => void;
  setDistributionFailed: (f: boolean) => void;
  submittingRef: MutableRefObject<boolean>;
}

async function fetchPostVoteDistribution(slots: VoteSlots, pair: Pair): Promise<void> {
  try {
    const dist = await getAccuracyDistribution(pair.cardA, pair.cardB);
    if (!slots.submittingRef.current) return;
    if (dist) slots.setDistribution(dist);
  } catch (err) {
    console.error('[useQuickVote] Failed to fetch distribution after vote:', err);
    slots.setDistributionFailed(true);
  }
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
      writeQuickVote(pair.cardA, pair.cardB, accuracy);
      slots.setState('result');
      await fetchPostVoteDistribution(slots, pair);
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

// ── Distribution-fetch predicate ──

interface FetchDistributionInputs {
  state: QuickVoteState;
  distribution: AccuracyDistribution | null;
  distributionFailed: boolean;
}

function shouldFetchDistribution({state, distribution, distributionFailed}: FetchDistributionInputs): boolean {
  // Eager fetch — dist bar is shown alongside the vote prompt (mockup phase 2 combined view).
  if (state === 'hidden') return false;
  if (distribution) return false;
  if (distributionFailed) return false;
  return true;
}

// ── Sub-hooks ──

type StateSlots = Omit<VoteSlots, 'submittingRef'>;

interface QuickVoteSlots extends StateSlots {
  state: QuickVoteState;
  userChoice: Accuracy | null;
  distribution: AccuracyDistribution | null;
  distributionFailed: boolean;
  error: QuickVoteError;
}

interface SlotsInputs {
  pair: Pair;
  isAvailable: boolean;
  storedChoice: Accuracy | null;
}

/**
 * Owns all useState slots + the prev-value-during-render pair-change reset.
 * The submission-lock ref is owned by `useQuickVote` itself (refs created via
 * `useRef` should be mutated only in the hook that created them).
 */
function useQuickVoteSlots({pair, isAvailable, storedChoice}: SlotsInputs): QuickVoteSlots {
  const pairId = `${pair.cardA}:${pair.cardB}`;
  const initial = resolveQuickVoteState({isAvailable, storedChoice});
  const [state, setState] = useState<QuickVoteState>(initial.state);
  const [userChoice, setUserChoice] = useState<Accuracy | null>(initial.userChoice);
  const [distribution, setDistribution] = useState<AccuracyDistribution | null>(null);
  const [error, setError] = useState<QuickVoteError>(null);
  const [distributionFailed, setDistributionFailed] = useState(false);
  const [prevPairId, setPrevPairId] = useState(pairId);

  if (pairId !== prevPairId) {
    setPrevPairId(pairId);
    setDistribution(null);
    setDistributionFailed(false);
    setError(null);
    const next = resolveQuickVoteState({isAvailable, storedChoice});
    setState(next.state);
    setUserChoice(next.userChoice);
  }

  return {
    state, setState, userChoice, setUserChoice, distribution, setDistribution,
    error, setError, distributionFailed, setDistributionFailed,
  };
}

/** Fetch the accuracy distribution when a returning voter lands on the result state. */
function useDistributionFetch(slots: QuickVoteSlots, pair: Pair): void {
  const {state, distribution, distributionFailed, setDistribution, setDistributionFailed} = slots;
  useEffect(() => {
    if (!shouldFetchDistribution({state, distribution, distributionFailed})) return;
    let cancelled = false;
    getAccuracyDistribution(pair.cardA, pair.cardB)
      .then((dist) => { if (!cancelled && dist) setDistribution(dist); })
      .catch((err) => {
        if (cancelled) return;
        console.error('[useQuickVote] Failed to fetch accuracy distribution:', err);
        setDistributionFailed(true);
      });
    return () => { cancelled = true; };
  }, [state, distribution, distributionFailed, pair.cardA, pair.cardB, setDistribution, setDistributionFailed]);
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
  distributionFailed: boolean;
  userChoice: Accuracy | null;
  error: QuickVoteError;
}

export function useQuickVote(cardA: string, cardB: string): UseQuickVoteReturn {
  const pair = useMemo<Pair>(() => ({cardA, cardB}), [cardA, cardB]);
  const isAvailable = useMemo(() => getSupabase() !== null, []);
  const storedChoice = useMemo(() => readQuickVote(pair.cardA, pair.cardB), [pair]);
  const slots = useQuickVoteSlots({pair, isAvailable, storedChoice});
  const submittingRef = useRef(false);

  // Reset submission lock after pair-change commit (refs can't be mutated during render).
  useEffect(() => { submittingRef.current = false; }, [pair]);

  useDistributionFetch(slots, pair);
  useRateLimitRecovery(slots);

  const {state, setState, setUserChoice, setError, setDistribution, setDistributionFailed} = slots;
  const vote = useCallback(
    async (accuracy: Accuracy) => {
      if (state !== 'ready' && state !== 'error') return;
      if (submittingRef.current) return;
      submittingRef.current = true;
      await performVote(
        {setState, setUserChoice, setError, setDistribution, setDistributionFailed, submittingRef},
        pair, accuracy,
      );
    },
    [pair, state, setState, setUserChoice, setError, setDistribution, setDistributionFailed],
  );

  return {
    state: slots.state,
    vote,
    distribution: slots.distribution,
    distributionFailed: slots.distributionFailed,
    userChoice: slots.userChoice,
    error: slots.error,
  };
}
