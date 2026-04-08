import {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {
  getSupabase,
  submitVote,
  getAccuracyDistribution,
  type AccuracyDistribution,
  type Accuracy,
} from '../../../shared/lib/supabase';

export type {Accuracy};
export type QuickVoteState = 'hidden' | 'ready' | 'submitting' | 'result' | 'error';
export type QuickVoteError = 'submission_failed' | 'rate_limited' | null;

function storageKey(cardA: string, cardB: string): string {
  const [a, b] = [cardA, cardB].sort();
  return `inkweave:vote:${a}:${b}`;
}

function getStoredVote(cardA: string, cardB: string): Accuracy | null {
  const key = storageKey(cardA, cardB);
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch (e) {
    console.warn('[getStoredVote] localStorage access denied:', e);
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const accuracy = parsed?.accuracy;
    if (accuracy === -1 || accuracy === 0 || accuracy === 1) return accuracy;
    console.error('[getStoredVote] Stored value has unexpected shape, clearing:', parsed);
    try { localStorage.removeItem(key); } catch (cleanupErr) { console.warn('[getStoredVote] localStorage cleanup failed:', cleanupErr); }
    return null;
  } catch (e) {
    console.error('[getStoredVote] Corrupted JSON in storage, clearing key:', key, e);
    try { localStorage.removeItem(key); } catch (cleanupErr) { console.warn('[getStoredVote] localStorage cleanup failed:', cleanupErr); }
    return null;
  }
}

function storeVote(cardA: string, cardB: string, accuracy: Accuracy): void {
  try {
    localStorage.setItem(
      storageKey(cardA, cardB),
      JSON.stringify({accuracy, timestamp: Date.now()}),
    );
  } catch (e) {
    console.error('[storeVote] Failed to persist vote to localStorage:', e);
  }
}

export interface UseQuickVoteReturn {
  state: QuickVoteState;
  vote: (accuracy: Accuracy) => Promise<void>;
  distribution: AccuracyDistribution | null;
  distributionFailed: boolean;
  userChoice: Accuracy | null;
  error: QuickVoteError;
}

export function useQuickVote(cardA: string, cardB: string): UseQuickVoteReturn {
  const isAvailable = useMemo(() => getSupabase() !== null, []);
  const storedChoice = useMemo(() => getStoredVote(cardA, cardB), [cardA, cardB]);

  const [state, setState] = useState<QuickVoteState>(() => {
    if (!isAvailable) return 'hidden';
    if (storedChoice !== null) return 'result';
    return 'ready';
  });
  const [userChoice, setUserChoice] = useState<Accuracy | null>(storedChoice);
  const [distribution, setDistribution] = useState<AccuracyDistribution | null>(null);
  const [error, setError] = useState<QuickVoteError>(null);
  const [distributionFailed, setDistributionFailed] = useState(false);
  const submittingRef = useRef(false);

  // Reset state when the pair changes (modal stays mounted across pairs)
  useEffect(() => {
    submittingRef.current = false;
    setDistribution(null);
    setDistributionFailed(false);
    setError(null);
    if (!isAvailable) {
      setState('hidden');
      setUserChoice(null);
    } else if (storedChoice !== null) {
      setState('result');
      setUserChoice(storedChoice);
    } else {
      setState('ready');
      setUserChoice(null);
    }
  }, [cardA, cardB, isAvailable, storedChoice]);

  // Fetch distribution for returning voters
  useEffect(() => {
    if (state !== 'result' || distribution || distributionFailed) return;
    let cancelled = false;
    getAccuracyDistribution(cardA, cardB)
      .then((dist) => {
        if (!cancelled && dist) setDistribution(dist);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[useQuickVote] Failed to fetch accuracy distribution:', err);
          setDistributionFailed(true);
        }
      });
    return () => { cancelled = true; };
  }, [state, distribution, distributionFailed, cardA, cardB]);

  // Auto-recover from rate limit after 30s
  useEffect(() => {
    if (error !== 'rate_limited') return;
    const timer = setTimeout(() => {
      setState('ready');
      setError(null);
    }, 30_000);
    return () => clearTimeout(timer);
  }, [error]);

  const vote = useCallback(
    async (accuracy: Accuracy) => {
      if (state !== 'ready' && state !== 'error') return;
      if (submittingRef.current) return;
      submittingRef.current = true;

      setState('submitting');
      setUserChoice(accuracy);
      setError(null);

      try {
        const result = await submitVote({cardA, cardB, accuracy});

        // Bail if pair changed during the await (reset effect sets ref to false)
        if (!submittingRef.current) return;

        if (result.error === null) {
          storeVote(cardA, cardB, accuracy);
          setState('result');
          try {
            const dist = await getAccuracyDistribution(cardA, cardB);
            if (!submittingRef.current) return;
            if (dist) setDistribution(dist);
          } catch (distErr) {
            console.error('[useQuickVote] Failed to fetch distribution after vote:', distErr);
            setDistributionFailed(true);
          }
        } else if (result.error === 'rate_limited') {
          setUserChoice(null);
          setError('rate_limited');
          setState('error');
        } else {
          console.error('[useQuickVote] Vote submission failed:', result.error, {cardA, cardB});
          setUserChoice(null);
          setError('submission_failed');
          setState('error');
        }
      } catch (err) {
        if (!submittingRef.current) return;
        console.error('[useQuickVote] Unexpected error during vote submission:', err);
        setUserChoice(null);
        setError('submission_failed');
        setState('error');
      } finally {
        submittingRef.current = false;
      }
    },
    [cardA, cardB, state],
  );

  return {state, vote, distribution, distributionFailed, userChoice, error};
}
