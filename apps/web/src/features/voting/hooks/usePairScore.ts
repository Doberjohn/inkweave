import {useEffect, useRef, useState} from 'react';
import {getPairScore, type PairScore} from '../../../shared/lib/supabase';

export interface UsePairScoreReturn {
  score: PairScore | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Resolved + sorted lookup descriptor for a pair. Bundling `key` + the original
 * card IDs into one object keeps internal helpers from each accepting three
 * string args (CodeScene's primitive-obsession + string-heavy metrics flagged
 * the previous shape).
 */
interface PairKey {
  key: string;
  cardA: string;
  cardB: string;
}

function makePairKey(cardA: string, cardB: string): PairKey {
  const [a, b] = [cardA, cardB].sort();
  return {key: `${a}:${b}`, cardA, cardB};
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
//
// `pairScoreVersions` is a per-key generation counter. Each `getPairScore` request
// captures the current version at creation. On resolve, the `.then` / `.catch` /
// `.finally` callbacks compare against the latest version — if `invalidatePairScore`
// ran in between, the version is now stale and the callbacks no-op. Without this,
// an in-flight initial fetch could resolve in the microtask gap between
// `setRefreshTick` firing and React's commit (cancelled-flag check), writing stale
// pre-vote data back into the cache and tricking the new effect into an early return.

const pairScoreCache = new Map<string, PairScore | null>();
const pairScoreRequests = new Map<string, Promise<PairScore | null>>();
const pairScoreVersions = new Map<string, number>();
const listeners = new Map<string, Set<() => void>>();

function fromCache({key}: PairKey): UsePairScoreReturn {
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
  const {key} = makePairKey(cardA, cardB);
  pairScoreVersions.set(key, (pairScoreVersions.get(key) ?? 0) + 1);
  pairScoreCache.delete(key);
  pairScoreRequests.delete(key);
  const set = listeners.get(key);
  if (set) set.forEach((fn) => fn());
}

/** @internal Test-only — drop all cache entries, listeners, in-flight requests, and version counters. */
export function _resetPairScoreCache(): void {
  pairScoreCache.clear();
  pairScoreRequests.clear();
  pairScoreVersions.clear();
  listeners.clear();
}

/**
 * Subscribes the calling hook to `invalidatePairScore(key)` events so that
 * after a peer write (e.g. another component submitted a vote) the hook
 * refetches. Returns an incrementing tick the caller can put into its fetch
 * effect's dep array.
 */
function usePairScoreInvalidationListener(
  pk: PairKey,
  onInvalidate: () => void,
): number {
  const [refreshTick, setRefreshTick] = useState(0);
  // "Latest ref" pattern: callers typically pass an inline arrow that closes
  // over render-fresh state. Storing the callback in a ref lets the subscribe
  // effect depend on `key` only — no churning the listener Set on every
  // render of usePairScore. Mutation lives in a post-commit effect to satisfy
  // React 19's "no ref access during render" rule.
  const onInvalidateRef = useRef(onInvalidate);
  useEffect(() => {
    onInvalidateRef.current = onInvalidate;
  });

  const {key} = pk;
  useEffect(() => {
    const fn = () => {
      onInvalidateRef.current();
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
  }, [key]);
  return refreshTick;
}

function isStaleVersion({key}: PairKey, version: number): boolean {
  return (pairScoreVersions.get(key) ?? 0) !== version;
}

/**
 * Look up or create the in-flight `getPairScore` promise for `pk.key`. Returns
 * the promise plus the version captured at creation. The `.finally()` cleanup
 * is guarded so a stale promise resolving late doesn't delete a newer in-flight
 * request that took the slot after invalidation.
 */
function pickPairScoreFetch(pk: PairKey): {
  request: Promise<PairScore | null>;
  version: number;
} {
  const {key, cardA, cardB} = pk;
  const version = pairScoreVersions.get(key) ?? 0;
  const existing = pairScoreRequests.get(key);
  if (existing) return {request: existing, version};

  const created: Promise<PairScore | null> = getPairScore(cardA, cardB).finally(() => {
    if (isStaleVersion(pk, version)) return;
    if (pairScoreRequests.get(key) !== created) return;
    pairScoreRequests.delete(key);
  });
  pairScoreRequests.set(key, created);
  return {request: created, version};
}

interface FetchApplyContext {
  setState: (next: UsePairScoreReturn) => void;
  pk: PairKey;
  version: number;
}

function applyResolvedFetch(ctx: FetchApplyContext, data: PairScore | null): void {
  if (isStaleVersion(ctx.pk, ctx.version)) return;
  pairScoreCache.set(ctx.pk.key, data);
  ctx.setState({score: data, isLoading: false, error: null});
}

function applyRejectedFetch(ctx: FetchApplyContext, rawErr: unknown): void {
  if (isStaleVersion(ctx.pk, ctx.version)) return;
  const error = rawErr instanceof Error ? rawErr : new Error(String(rawErr));
  console.error('[usePairScore] Failed to fetch pair score:', rawErr);
  ctx.setState({score: null, isLoading: false, error});
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
  const pk = makePairKey(cardA, cardB);
  const [state, setState] = useState<UsePairScoreReturn>(() => fromCache(pk));
  const [prevKey, setPrevKey] = useState(pk.key);

  if (pk.key !== prevKey) {
    setPrevKey(pk.key);
    setState(fromCache(pk));
  }

  const refreshTick = usePairScoreInvalidationListener(pk, () => {
    setState({score: null, isLoading: true, error: null});
  });

  // Fetch when key changes, when invalidated, or when starting fresh.
  // Cache hits during render are handled by `fromCache` in the lazy init + pair-change
  // branch above — no setState-in-effect needed here. `pk` is recomputed inside the
  // effect (instead of captured from outer scope) so the dep array stays stable
  // primitives and the effect doesn't re-fire on every parent render.
  useEffect(() => {
    const effectPk = makePairKey(cardA, cardB);
    if (pairScoreCache.has(effectPk.key)) return;
    let cancelled = false;
    const {request, version} = pickPairScoreFetch(effectPk);
    const ctx: FetchApplyContext = {setState, pk: effectPk, version};

    request
      .then((data) => {
        if (cancelled) return;
        applyResolvedFetch(ctx, data);
      })
      .catch((rawErr) => {
        if (cancelled) return;
        applyRejectedFetch(ctx, rawErr);
      });

    return () => {
      cancelled = true;
    };
  }, [cardA, cardB, refreshTick]);

  return state;
}
