import {useState, useEffect, useCallback, useMemo} from 'react';
import {
  getSupabase,
  submitVote,
  getAccuracyDistribution,
  type AccuracyDistribution,
} from '../../../shared/lib/supabase';

export type QuickVoteState = 'hidden' | 'ready' | 'submitting' | 'result' | 'error';
export type QuickVoteError = 'error' | 'rate_limited' | null;
export type Accuracy = -1 | 0 | 1;

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
    localStorage.removeItem(key);
    return null;
  } catch (e) {
    console.error('[getStoredVote] Corrupted JSON in storage, clearing key:', key, e);
    localStorage.removeItem(key);
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

  // Fetch distribution for returning voters
  useEffect(() => {
    if (state === 'result' && !distribution) {
      getAccuracyDistribution(cardA, cardB)
        .then((dist) => {
          if (dist) setDistribution(dist);
        })
        .catch((err) => {
          console.error('[useQuickVote] Failed to fetch accuracy distribution:', err);
        });
    }
  }, [state, distribution, cardA, cardB]);

  const vote = useCallback(
    async (accuracy: Accuracy) => {
      if (state !== 'ready' && state !== 'error') return;

      setState('submitting');
      setError(null);

      try {
        const result = await submitVote({cardA, cardB, accuracy});

        if (result.error === null) {
          storeVote(cardA, cardB, accuracy);
          setUserChoice(accuracy);
          setState('result');
          try {
            const dist = await getAccuracyDistribution(cardA, cardB);
            if (dist) setDistribution(dist);
          } catch (distErr) {
            console.error('[useQuickVote] Failed to fetch distribution after vote:', distErr);
          }
        } else if (result.error === 'rate_limited') {
          setError('rate_limited');
          setState('error');
        } else {
          console.error('[useQuickVote] Vote submission failed:', result.error, {cardA, cardB});
          setError('error');
          setState('error');
        }
      } catch (err) {
        console.error('[useQuickVote] Unexpected error during vote submission:', err);
        setError('error');
        setState('error');
      }
    },
    [cardA, cardB, state],
  );

  return {state, vote, distribution, userChoice, error};
}
