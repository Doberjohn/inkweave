import {useEffect, useState} from 'react';
import {getPairScore, type PairScore} from '../../../shared/lib/supabase';

export interface UsePairScoreReturn {
  score: PairScore | null;
  isLoading: boolean;
  error: Error | null;
}

// ── Module-level cache ──
// Mirrors the synergy-fetch pattern: avoid refetching the same pair within a session.

const pairScoreCache = new Map<string, PairScore | null>();

function cacheKey(cardA: string, cardB: string): string {
  const [a, b] = [cardA, cardB].sort();
  return `${a}:${b}`;
}

function fromCache(key: string): UsePairScoreReturn {
  if (pairScoreCache.has(key)) {
    return {score: pairScoreCache.get(key) ?? null, isLoading: false, error: null};
  }
  return {score: null, isLoading: true, error: null};
}

/**
 * Read-side hook for `pair_scores` Supabase view aggregates.
 *
 * Returns the aggregated scores for a pair (avg_score, pct_real, pct_would_play,
 * avg_difficulty, carries_*, vote counts). Caches per pair so multiple consumers
 * hitting the same pair within a session don't refetch.
 */
export function usePairScore(cardA: string, cardB: string): UsePairScoreReturn {
  const key = cacheKey(cardA, cardB);
  const [state, setState] = useState<UsePairScoreReturn>(() => fromCache(key));
  const [prevKey, setPrevKey] = useState(key);

  // React 19 idiom: prev-value-during-render pair-change reset
  if (key !== prevKey) {
    setPrevKey(key);
    setState(fromCache(key));
  }

  useEffect(() => {
    if (pairScoreCache.has(key)) return;
    let cancelled = false;

    getPairScore(cardA, cardB)
      .then((data) => {
        if (cancelled) return;
        pairScoreCache.set(key, data);
        setState({score: data, isLoading: false, error: null});
      })
      .catch((err) => {
        if (cancelled) return;
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[usePairScore] Failed to fetch pair score:', err);
        setState({score: null, isLoading: false, error});
      });

    return () => {
      cancelled = true;
    };
  }, [key, cardA, cardB]);

  return state;
}
