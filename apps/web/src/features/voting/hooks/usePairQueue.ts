import {useState, useEffect, useRef} from 'react';
import type {LorcanaCard, PairSynergyConnection} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../../shared/contexts/CardDataContext';
import {fetchCardSynergies} from '../../synergies/hooks/usePrecomputedSynergies';
import type {PairIndexEntry, VotingPair} from '../types';
import {PairQueueStore, pairKey} from '../PairQueueStore';

const STORAGE_KEY = 'inkweave:voted-pairs';

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

/** Resolve a pair index entry into a full VotingPair with card objects and connections. */
async function resolvePair(
  entry: PairIndexEntry,
  getCardById: (id: string) => LorcanaCard | undefined,
): Promise<VotingPair | null> {
  const [idA, idB, score] = entry;
  const cardA = getCardById(idA);
  const cardB = getCardById(idB);
  if (!cardA || !cardB) return null;

  // Try cardA's file first, fall back to cardB's (synergy may only be detected from one direction).
  let data = await fetchCardSynergies(idA);
  let pairData = data.pairs[idB];
  if (!pairData) {
    data = await fetchCardSynergies(idB);
    pairData = data.pairs[idA];
  }
  const connections: PairSynergyConnection[] = pairData?.connections ?? [];

  return {cardA, cardB, aggregateScore: score, connections};
}

/** Resolve a list of pair entries into lightweight previews, skipping any with missing card data. */
function entriesToPreviews(
  entries: PairIndexEntry[],
  getCardById: (id: string) => LorcanaCard | undefined,
): PairPreview[] {
  const previews: PairPreview[] = [];
  for (const entry of entries) {
    const cardA = getCardById(entry[0]);
    const cardB = getCardById(entry[1]);
    if (cardA && cardB) previews.push({cardA, cardB});
  }
  return previews;
}

interface LoadNextResult {
  pair: VotingPair | null;
  isEmpty: boolean;
  error: Error | null;
}

/** Draw entries from the store and resolve the first one whose cards load. Up to 10 attempts. */
async function loadNextPair(
  store: PairQueueStore,
  getCardById: (id: string) => LorcanaCard | undefined,
): Promise<LoadNextResult> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const entry = store.drawNext();
    if (!entry) return {pair: null, isEmpty: true, error: null};
    try {
      const pair = await resolvePair(entry, getCardById);
      if (!pair) continue;
      return {pair, isEmpty: false, error: null};
    } catch (err) {
      return {pair: null, isEmpty: false, error: err instanceof Error ? err : new Error(String(err))};
    }
  }
  console.warn('[usePairQueue] 10 consecutive pairs failed to resolve. Treating queue as empty.');
  return {pair: null, isEmpty: true, error: null};
}

/** Wrap an unknown throw in a proper Error instance. */
function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/** Fetch the pairs index, filter by seen-set, partition into buckets, ready the store. */
async function initializeStore(store: PairQueueStore): Promise<void> {
  const response = await fetch('/data/synergies/_pairs_index.json');
  if (!response.ok) throw new Error(`Failed to load pairs index: ${response.status}`);
  const entries: PairIndexEntry[] = await response.json();
  store.init(entries, getSeenPairs());
}

/**
 * Run store init exactly once, gated on card data being ready. Owns the init latch so
 * `usePairQueue` doesn't need to, keeping its lexical CC free of effect/try-catch branches.
 */
function useInitPairQueue(
  storeRef: React.RefObject<PairQueueStore | null>,
  cardsLoading: boolean,
  onReady: () => Promise<void>,
  onError: (err: Error) => void,
): void {
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    if (cardsLoading) return;
    const store = storeRef.current;
    if (!store) return;
    initializedRef.current = true;
    initializeStore(store)
      .then(onReady)
      .catch((err) => onError(toError(err)));
  }, [cardsLoading, storeRef, onReady, onError]);
}

/** Lightweight pair preview (just card objects, no connections loaded). */
export interface PairPreview {
  cardA: LorcanaCard;
  cardB: LorcanaCard;
}

export interface UsePairQueueReturn {
  currentPair: VotingPair | null;
  /** Next 3 upcoming pairs (for stack preview) */
  upcomingPreviews: PairPreview[];
  /** Last 3 voted pairs (for history stack) */
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
  const {getCardById, isLoading: cardsLoading} = useCardDataContext();
  const [currentPair, setCurrentPair] = useState<VotingPair | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [stats, setStats] = useState({voted: 0, skipped: 0});
  const [upcomingPreviews, setUpcomingPreviews] = useState<PairPreview[]>([]);
  const [previousPreviews, setPreviousPreviews] = useState<PairPreview[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const storeRef = useRef<PairQueueStore | null>(null);
  if (storeRef.current === null) storeRef.current = new PairQueueStore();
  const lastVotedPairRef = useRef<VotingPair | null>(null);

  const loadNext = async () => {
    setIsLoading(true);
    const result = await loadNextPair(storeRef.current, getCardById);
    if (result.error) {
      setError(result.error);
    } else if (result.pair) {
      setCurrentPair(result.pair);
      setUpcomingPreviews(entriesToPreviews(storeRef.current.peekNext(3), getCardById));
    } else if (result.isEmpty) {
      setCurrentPair(null);
      setIsEmpty(true);
    }
    setIsLoading(false);
  };

  // One-shot init — gated on card data being ready so getCardById can resolve entries.
  // Effect body lives in the custom hook above; keeps this hook's lexical CC low.
  useInitPairQueue(
    storeRef,
    cardsLoading,
    async () => {
      setStats({voted: 0, skipped: 0});
      await loadNext();
    },
    (err) => {
      setError(err);
      setIsLoading(false);
    },
  );

  const pushToPrevious = (pair: VotingPair) => {
    setPreviousPreviews((prev) => [{cardA: pair.cardA, cardB: pair.cardB}, ...prev].slice(0, 3));
  };

  const advance = () => {
    if (!currentPair) return;
    lastVotedPairRef.current = currentPair;
    setCanUndo(true);
    addSeenPair(pairKey(currentPair.cardA.id, currentPair.cardB.id));
    pushToPrevious(currentPair);
    setStats((prev) => ({...prev, voted: prev.voted + 1}));
    loadNext();
  };

  const skip = () => {
    if (!currentPair) return;
    lastVotedPairRef.current = null;
    setCanUndo(false);
    addSeenPair(pairKey(currentPair.cardA.id, currentPair.cardB.id));
    pushToPrevious(currentPair);
    setStats((prev) => ({...prev, skipped: prev.skipped + 1}));
    loadNext();
  };

  const undo = () => {
    const lastPair = lastVotedPairRef.current;
    if (!lastPair || !currentPair) return;

    removeSeenPair(pairKey(lastPair.cardA.id, lastPair.cardB.id));
    storeRef.current.pushBack([
      currentPair.cardA.id,
      currentPair.cardB.id,
      currentPair.aggregateScore,
    ]);

    setCurrentPair(lastPair);
    setPreviousPreviews((prev) => prev.slice(1));
    setStats((prev) => ({...prev, voted: Math.max(0, prev.voted - 1)}));
    setUpcomingPreviews(entriesToPreviews(storeRef.current.peekNext(3), getCardById));

    lastVotedPairRef.current = null;
    setCanUndo(false);
  };

  return {
    currentPair,
    upcomingPreviews,
    previousPreviews,
    isLoading,
    error,
    advance,
    skip,
    undo,
    canUndo,
    stats,
    isEmpty,
  };
}
