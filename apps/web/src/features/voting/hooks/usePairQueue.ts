import {useState, useEffect, useCallback, useRef} from 'react';
import type {LorcanaCard, PairSynergyConnection} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../../shared/contexts/CardDataContext';
import {fetchCardSynergies} from '../../synergies/hooks/usePrecomputedSynergies';
import type {PairIndexEntry, VotingPair} from '../types';

const STORAGE_KEY = 'inkweave:voted-pairs';
const INTERESTING_THRESHOLD = 7;

/** Create a canonical pair key from two card IDs (sorted). */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Read voted/skipped pairs from localStorage. */
function getSeenPairs(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch (err) {
    console.warn('[usePairQueue] Failed to read voted pairs from localStorage:', err);
    return new Set();
  }
}

/** Persist a pair key to localStorage. */
function addSeenPair(key: string): void {
  try {
    const seen = getSeenPairs();
    seen.add(key);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch (err) {
    console.warn('[usePairQueue] Failed to save voted pair to localStorage:', err);
  }
}

/** Remove a pair key from localStorage (for undo). */
function removeSeenPair(key: string): void {
  try {
    const seen = getSeenPairs();
    seen.delete(key);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch (err) {
    console.warn('[usePairQueue] Failed to update localStorage for undo:', err);
  }
}

/** Fisher-Yates in-place shuffle — O(n), unbiased. */
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/** Resolve a pair index entry into a full VotingPair with card objects and connections. */
async function resolvePair(
  entry: PairIndexEntry,
  getCardById: (id: string) => LorcanaCard | undefined,
): Promise<VotingPair | null> {
  const [idA, idB, score] = entry;
  const cardA = getCardById(idA);
  const cardB = getCardById(idB);
  if (!cardA || !cardB) return null;

  // Try cardA's file first, fall back to cardB's (synergy may only be detected from one direction)
  let data = await fetchCardSynergies(idA);
  let pairData = data.pairs[idB];
  if (!pairData) {
    data = await fetchCardSynergies(idB);
    pairData = data.pairs[idA];
  }
  const connections: PairSynergyConnection[] = pairData?.connections ?? [];

  return {cardA, cardB, aggregateScore: score, connections};
}

/** Lightweight pair preview (just card objects, no connections loaded) */
export interface PairPreview {
  cardA: LorcanaCard;
  cardB: LorcanaCard;
}

export interface UsePairQueueReturn {
  currentPair: VotingPair | null;
  /** Next 2 upcoming pairs (for stack preview) */
  upcomingPreviews: PairPreview[];
  /** Last 2 voted pairs (for history stack) */
  previousPreviews: PairPreview[];
  isLoading: boolean;
  error: Error | null;
  advance: () => void;
  skip: () => void;
  undo: () => void;
  canUndo: boolean;
  stats: {voted: number; skipped: number};
  isEmpty: boolean;
}

export function usePairQueue(): UsePairQueueReturn {
  const {getCardById} = useCardDataContext();
  const [currentPair, setCurrentPair] = useState<VotingPair | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [stats, setStats] = useState({voted: 0, skipped: 0});
  const [upcomingPreviews, setUpcomingPreviews] = useState<PairPreview[]>([]);
  const [previousPreviews, setPreviousPreviews] = useState<PairPreview[]>([]);

  // Mutable queue state (doesn't trigger re-renders)
  const queueRef = useRef<{
    interesting: PairIndexEntry[];
    other: PairIndexEntry[];
    nextBucket: 'interesting' | 'other';
    initialized: boolean;
  }>({interesting: [], other: [], nextBucket: 'interesting', initialized: false});

  /** Draw the next entry from the alternating buckets. */
  const drawNext = useCallback((): PairIndexEntry | null => {
    const q = queueRef.current;
    const primary = q.nextBucket === 'interesting' ? q.interesting : q.other;
    const fallback = q.nextBucket === 'interesting' ? q.other : q.interesting;
    const entry = primary.length > 0 ? primary.pop() : fallback.pop();

    // Alternate bucket for next draw
    q.nextBucket = q.nextBucket === 'interesting' ? 'other' : 'interesting';

    return entry ?? null;
  }, []);

  /** Peek at the next N entries without consuming — simulates alternating draw order. */
  const peekUpcoming = useCallback(
    (count: number): PairPreview[] => {
      const q = queueRef.current;
      // Track read positions independently (top of each stack, counting down)
      const readPos = {
        interesting: q.interesting.length - 1,
        other: q.other.length - 1,
      };
      let bucket = q.nextBucket;
      const previews: PairPreview[] = [];

      while (previews.length < count && (readPos.interesting >= 0 || readPos.other >= 0)) {
        const alt: typeof bucket = bucket === 'interesting' ? 'other' : 'interesting';

        // Try preferred bucket first, fall back to the other
        let entry: PairIndexEntry | undefined;
        if (readPos[bucket] >= 0) {
          entry = q[bucket][readPos[bucket]--];
        } else if (readPos[alt] >= 0) {
          entry = q[alt][readPos[alt]--];
        }

        if (entry) {
          const cardA = getCardById(entry[0]);
          const cardB = getCardById(entry[1]);
          if (cardA && cardB) previews.push({cardA, cardB});
        }

        bucket = alt;
      }

      return previews;
    },
    [getCardById],
  );

  /** Load and resolve the next pair, retrying up to 10 times for missing cards. */
  const loadNext = useCallback(async () => {
    setIsLoading(true);

    for (let attempt = 0; attempt < 10; attempt++) {
      const entry = drawNext();
      if (!entry) {
        setCurrentPair(null);
        setIsEmpty(true);
        setIsLoading(false);
        return;
      }

      try {
        const pair = await resolvePair(entry, getCardById);
        if (!pair) continue; // Card not found — try next entry
        setCurrentPair(pair);
        setUpcomingPreviews(peekUpcoming(3));
        setIsLoading(false);
        return;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
        return;
      }
    }

    // Exhausted retries — treat as empty
    console.warn('[usePairQueue] 10 consecutive pairs failed to resolve — treating queue as empty');
    setCurrentPair(null);
    setIsEmpty(true);
    setIsLoading(false);
  }, [drawNext, getCardById, peekUpcoming]);

  // Initialize: fetch pairs index, partition, shuffle, load first pair
  useEffect(() => {
    if (queueRef.current.initialized) return;
    queueRef.current.initialized = true;

    (async () => {
      try {
        const response = await fetch('/data/synergies/_pairs_index.json');
        if (!response.ok) throw new Error(`Failed to load pairs index: ${response.status}`);
        const entries: PairIndexEntry[] = await response.json();

        const seen = getSeenPairs();

        const interesting: PairIndexEntry[] = [];
        const other: PairIndexEntry[] = [];

        for (const entry of entries) {
          const key = pairKey(entry[0], entry[1]);
          if (seen.has(key)) continue;

          if (entry[2] >= INTERESTING_THRESHOLD) {
            interesting.push(entry);
          } else {
            other.push(entry);
          }
        }

        shuffleArray(interesting);
        shuffleArray(other);

        queueRef.current.interesting = interesting;
        queueRef.current.other = other;

        setStats({voted: 0, skipped: 0});

        await loadNext();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      }
    })();
  }, [loadNext]);

  // Track last voted pair for undo (single-level)
  const lastVotedPairRef = useRef<VotingPair | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const pushToPrevious = useCallback((pair: VotingPair) => {
    setPreviousPreviews((prev) => [{cardA: pair.cardA, cardB: pair.cardB}, ...prev].slice(0, 3));
  }, []);

  const advance = useCallback(() => {
    if (!currentPair) return;
    lastVotedPairRef.current = currentPair;
    setCanUndo(true);
    addSeenPair(pairKey(currentPair.cardA.id, currentPair.cardB.id));
    pushToPrevious(currentPair);
    setStats((prev) => ({...prev, voted: prev.voted + 1}));
    loadNext();
  }, [currentPair, loadNext, pushToPrevious]);

  const skip = useCallback(() => {
    if (!currentPair) return;
    lastVotedPairRef.current = null;
    setCanUndo(false);
    addSeenPair(pairKey(currentPair.cardA.id, currentPair.cardB.id));
    pushToPrevious(currentPair);
    setStats((prev) => ({...prev, skipped: prev.skipped + 1}));
    loadNext();
  }, [currentPair, loadNext, pushToPrevious]);

  const undo = useCallback(() => {
    const lastPair = lastVotedPairRef.current;
    if (!lastPair || !currentPair) return;

    // Remove last pair from seen set
    removeSeenPair(pairKey(lastPair.cardA.id, lastPair.cardB.id));

    // Push current pair back into the appropriate bucket
    const entry: PairIndexEntry = [currentPair.cardA.id, currentPair.cardB.id, currentPair.aggregateScore];
    const q = queueRef.current;
    if (currentPair.aggregateScore >= INTERESTING_THRESHOLD) {
      q.interesting.push(entry);
    } else {
      q.other.push(entry);
    }

    // Restore last pair as current
    setCurrentPair(lastPair);
    setPreviousPreviews((prev) => prev.slice(1));
    setStats((prev) => ({...prev, voted: Math.max(0, prev.voted - 1)}));
    setUpcomingPreviews(peekUpcoming(3));

    // Clear — only one undo allowed
    lastVotedPairRef.current = null;
    setCanUndo(false);
  }, [currentPair, peekUpcoming]);

  return {currentPair, upcomingPreviews, previousPreviews, isLoading, error, advance, skip, undo, canUndo, stats, isEmpty};
}
