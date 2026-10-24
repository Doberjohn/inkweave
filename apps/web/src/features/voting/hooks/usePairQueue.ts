import {useState, useEffect, useRef} from 'react';
import type {LorcanaCard, PairSynergyConnection} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../../shared/contexts/CardDataContext';
import {startCardList} from '../../cards/cardListRequest';
import {fetchCardSynergies} from '../../synergies/hooks/usePrecomputedSynergies';
import type {PairIndexEntry, VotingPair} from '../types';
import {PairQueueStore, pairKey} from '../PairQueueStore';
import {fetchPairsIndex} from '../pairsIndexRequest';

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

/** Set only by the prerender crawl, whose capture of /vote shows no pair: each visit draws its own (#915). */
function isPrerenderCrawl(): boolean {
  return window.__INKWEAVE_PRERENDER__ === true;
}

/** A queue's store, and the first pair drawn from it. */
interface DrawnQueue {
  store: PairQueueStore;
  first: LoadNextResult;
}

/** A store over the pairs index and the visitor's unseen pairs, with its first pair drawn. */
async function drawQueue(
  entries: PairIndexEntry[],
  getCardById: (id: string) => LorcanaCard | undefined,
): Promise<DrawnQueue> {
  const store = new PairQueueStore();
  store.init(entries, getSeenPairs());
  return {store, first: await loadNextPair(store, getCardById)};
}

let firstDraw: Promise<DrawnQueue> | null = null;
let untakenFirstDraw: DrawnQueue | null = null;

/**
 * The visit's queue and its first pair, drawn once for the page from the card list and the pairs
 * index: main.tsx's hold on a prerendered /vote waits for it (#915), and the queue that mounts
 * first takes it, so the app's first render shows that pair, never the loading view. A failure is
 * forgotten, so the queue draws again.
 */
export function startFirstPair(): Promise<DrawnQueue> {
  firstDraw ??= Promise.all([startCardList(), fetchPairsIndex()])
    .then(([{cards}, entries]) => {
      const byId = new Map(cards.map((card) => [card.id, card]));
      return drawQueue(entries, (id) => byId.get(id));
    })
    .then(
      (drawn) => (untakenFirstDraw = drawn),
      (error: unknown) => {
        firstDraw = null;
        throw error;
      },
    );
  return firstDraw;
}

/** @internal reset for testing */
export function _resetFirstPair(): void {
  firstDraw = null;
  untakenFirstDraw = null;
}

/** Marks the hold's draw taken by the queue showing it, so a later queue draws its own. */
function takeFirstDraw(drawn: DrawnQueue): void {
  if (untakenFirstDraw === drawn) untakenFirstDraw = null;
}

/** The hold's draw, once it has drawn, if no queue has taken it; else a queue drawn now. */
async function takeOrDrawQueue(
  getCardById: (id: string) => LorcanaCard | undefined,
): Promise<DrawnQueue> {
  await firstDraw?.catch(() => undefined);
  const drawn = untakenFirstDraw;
  if (!drawn) return drawQueue(await fetchPairsIndex(), getCardById);
  takeFirstDraw(drawn);
  return drawn;
}

/** Where a queue starts, and the store it draws from next. */
interface QueueStart {
  /** The hold's draw it starts from (#915), or null when it draws its own. */
  drawn: DrawnQueue | null;
  store: PairQueueStore;
  currentPair: VotingPair | null;
  error: Error | null;
  isEmpty: boolean;
  upcomingPreviews: PairPreview[];
}

/**
 * A queue starts from the pair main.tsx's hold drew, when the hold has drawn one no queue has
 * taken (#915), so its first render shows that pair; otherwise it starts loading.
 */
function queueStart(getCardById: (id: string) => LorcanaCard | undefined): QueueStart {
  const drawn = untakenFirstDraw;
  if (!drawn) {
    const store = new PairQueueStore();
    return {drawn, store, currentPair: null, error: null, isEmpty: false, upcomingPreviews: []};
  }
  const {store, first} = drawn;
  return {
    drawn,
    store,
    currentPair: first.pair,
    error: first.error,
    isEmpty: first.isEmpty,
    upcomingPreviews: first.pair ? entriesToPreviews(store.peekNext(3), getCardById) : [],
  };
}

/**
 * Take the hold's draw a queue started from, or draw the queue's own once card data is ready,
 * exactly once; never during the prerender crawl. Owns the init latch so `usePairQueue` doesn't
 * need to, keeping its lexical CC free of effect/try-catch branches.
 */
function useInitPairQueue(
  started: DrawnQueue | null,
  cardsLoading: boolean,
  draw: () => void,
): void {
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    if (started) {
      initializedRef.current = true;
      takeFirstDraw(started);
      return;
    }
    if (cardsLoading || isPrerenderCrawl()) return;
    initializedRef.current = true;
    draw();
  }, [started, cardsLoading, draw]);
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
  const [start] = useState(() => queueStart(getCardById));
  const [store, setStore] = useState(start.store);
  const [currentPair, setCurrentPair] = useState<VotingPair | null>(start.currentPair);
  const [isLoading, setIsLoading] = useState(start.drawn === null);
  const [error, setError] = useState<Error | null>(start.error);
  const [isEmpty, setIsEmpty] = useState(start.isEmpty);
  const [stats, setStats] = useState({voted: 0, skipped: 0});
  const [upcomingPreviews, setUpcomingPreviews] = useState<PairPreview[]>(start.upcomingPreviews);
  const [previousPreviews, setPreviousPreviews] = useState<PairPreview[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const lastVotedPairRef = useRef<VotingPair | null>(null);

  const showDraw = (result: LoadNextResult, from: PairQueueStore) => {
    if (result.error) {
      setError(result.error);
    } else if (result.pair) {
      setCurrentPair(result.pair);
      setUpcomingPreviews(entriesToPreviews(from.peekNext(3), getCardById));
    } else if (result.isEmpty) {
      setCurrentPair(null);
      setIsEmpty(true);
    }
    setIsLoading(false);
  };

  const loadNext = async () => {
    setIsLoading(true);
    showDraw(await loadNextPair(store, getCardById), store);
  };

  // One-shot init: the hold's draw when the queue started from it, else its own draw, gated on
  // card data being ready so getCardById can resolve entries. Effect body lives in the custom
  // hook above; keeps this hook's lexical CC low.
  useInitPairQueue(start.drawn, cardsLoading, () => {
    takeOrDrawQueue(getCardById)
      .then((drawn) => {
        setStore(drawn.store);
        showDraw(drawn.first, drawn.store);
      })
      .catch((err) => {
        setError(toError(err));
        setIsLoading(false);
      });
  });

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
    store.pushBack([currentPair.cardA.id, currentPair.cardB.id, currentPair.aggregateScore]);

    setCurrentPair(lastPair);
    setPreviousPreviews((prev) => prev.slice(1));
    setStats((prev) => ({...prev, voted: Math.max(0, prev.voted - 1)}));
    setUpcomingPreviews(entriesToPreviews(store.peekNext(3), getCardById));

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
