import {useState, useEffect, useCallback, useMemo} from 'react';
import {
  getSupabase,
  submitVote,
  getAccuracyDistribution,
  type AccuracyDistribution,
} from '../../../shared/lib/supabase';

export type QuickVoteState = 'hidden' | 'ready' | 'submitting' | 'result' | 'error';
export type QuickVoteError = 'error' | 'rate_limited' | null;
type Accuracy = -1 | 0 | 1;

function storageKey(cardA: string, cardB: string): string {
  const [a, b] = [cardA, cardB].sort();
  return `inkweave:vote:${a}:${b}`;
}

function getStoredVote(cardA: string, cardB: string): Accuracy | null {
  try {
    const raw = localStorage.getItem(storageKey(cardA, cardB));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.accuracy ?? null;
  } catch {
    return null;
  }
}

function storeVote(cardA: string, cardB: string, accuracy: Accuracy): void {
  localStorage.setItem(
    storageKey(cardA, cardB),
    JSON.stringify({accuracy, timestamp: Date.now()}),
  );
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
      getAccuracyDistribution(cardA, cardB).then((dist) => {
        if (dist) setDistribution(dist);
      });
    }
  }, [state, distribution, cardA, cardB]);

  const vote = useCallback(
    async (accuracy: Accuracy) => {
      if (state !== 'ready' && state !== 'error') return;

      setState('submitting');
      setError(null);

      const result = await submitVote({cardA, cardB, accuracy});

      if (result.error === null) {
        storeVote(cardA, cardB, accuracy);
        setUserChoice(accuracy);
        setState('result');
        const dist = await getAccuracyDistribution(cardA, cardB);
        if (dist) setDistribution(dist);
      } else if (result.error === 'rate_limited') {
        setError('rate_limited');
        setState('error');
      } else {
        setError('error');
        setState('error');
      }
    },
    [cardA, cardB, state],
  );

  return {state, vote, distribution, userChoice, error};
}
