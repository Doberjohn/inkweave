import {useEffect, useState} from 'react';
import {getPairScore, type PairScore} from '../../../shared/lib/supabase';

export interface UsePairScoreReturn {
  score: PairScore | null;
  isLoading: boolean;
  error: Error | null;
}

// ── Module-level cache + invalidation listeners ──
// Single source of truth for `pair_scores` rows across all consumers in a session.
// `useQuickVote` reads the same row this hook caches (via `deriveAccuracyDistribution`),
// so the previous separate `getAccuracyDistribution` query was a duplicate fetch.
// After a successful vote, `invalidatePairScore(cardA, cardB)` busts the slot and
// notifies subscribers to refetch — both this hook and `useQuickVote` re-derive
// from the fresh aggregate without each calling Supabase independently.
//
// `pairScoreRequests` deduplicates in-flight fetches: when two consumers mount in
// the same commit (e.g. CommunityColumn + useQuickVote on first modal open), both
// see a cache miss but the second one reuses the first's promise instead of firing
// a second `getPairScore()` call.

const pairScoreCache = new Map<string, PairScore | null>();
const pairScoreRequests = new Map<string, Promise<PairScore | null>>();
const listeners = new Map<string, Set<() => void>>();

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
 * Bust the cached pair-score row and notify subscribers to refetch.
 * Call after a write (vote submission) so the aggregate reflects the new vote.
 */
export function invalidatePairScore(cardA: string, cardB: string): void {
  const key = cacheKey(cardA, cardB);
  pairScoreCache.delete(key);
  // Also drop any in-flight fetch promise: if the initial getPairScore is still
  // resolving when a vote lands, listener-triggered subscribers would otherwise
  // reuse the stale promise and populate the cache with pre-vote data. Deleting
  // the slot forces the next subscriber to start a fresh fetch; the prior
  // promise's `.then` handlers no-op via each consumer's `cancelled` flag.
  pairScoreRequests.delete(key);
  const set = listeners.get(key);
  if (set) set.forEach((fn) => fn());
}

/** @internal Test-only — drop all cache entries, listeners, and in-flight requests. */
export function _resetPairScoreCache(): void {
  pairScoreCache.clear();
  pairScoreRequests.clear();
  listeners.clear();
}

/**
 * Subscribes the calling hook to `invalidatePairScore(key)` events so that
 * after a peer write (e.g. another component submitted a vote) the hook
 * refetches. Returns an incrementing tick the caller can put into its fetch
 * effect's dep array.
 */
function usePairScoreInvalidationListener(
  key: string,
  onInvalidate: () => void,
): number {
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    const fn = () => {
      onInvalidate();
      setRefreshTick((t) => t + 1);
    };
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) listeners.delete(key);
    };
  }, [key, onInvalidate]);
  return refreshTick;
}

/**
 * Read-side hook for `pair_scores` Supabase view aggregates.
 *
 * Returns the aggregated scores for a pair (avg_score, pct_real, pct_would_play,
 * avg_difficulty, carries_*, vote counts, accuracy_lower/right/higher). Caches
 * per pair at module level so multiple consumers hitting the same pair within
 * a session share one fetch. Subscribes to `invalidatePairScore` so writes
 * trigger a refetch.
 */
export function usePairScore(cardA: string, cardB: string): UsePairScoreReturn {
  const key = cacheKey(cardA, cardB);
  const [state, setState] = useState<UsePairScoreReturn>(() => fromCache(key));
  const [prevKey, setPrevKey] = useState(key);

  if (key !== prevKey) {
    setPrevKey(key);
    setState(fromCache(key));
  }

  const refreshTick = usePairScoreInvalidationListener(key, () => {
    setState({score: null, isLoading: true, error: null});
  });

  // Fetch when key changes, when invalidated, or when starting fresh.
  // Cache hits during render are handled by `fromCache` in the lazy init + pair-change
  // branch above — no setState-in-effect needed here.
  //
  // In-flight dedup: when two consumers mount in the same commit, the second one
  // reuses the first's promise from `pairScoreRequests` instead of firing a duplicate
  // `getPairScore()` call. The map is cleared in `.finally()` so a settled fetch
  // doesn't keep blocking a later refetch (e.g. after `invalidatePairScore`).
  useEffect(() => {
    if (pairScoreCache.has(key)) return;
    let cancelled = false;

    let request = pairScoreRequests.get(key);
    if (!request) {
      request = getPairScore(cardA, cardB).finally(() => {
        pairScoreRequests.delete(key);
      });
      pairScoreRequests.set(key, request);
    }

    request
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
  }, [key, cardA, cardB, refreshTick]);

  return state;
}
