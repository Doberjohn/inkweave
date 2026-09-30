import {useState, useEffect} from 'react';
import type {LorcanaCard, SetInfo} from '../../cards';
import {
  fetchCardsFromLocal,
  getUniqueKeywords,
  getUniqueClassifications,
  getUniqueSets,
} from '../../cards';
import {whenIdle} from '../../../shared/lib/whenLoadedAndIdle';

export interface UseCardDataReturn {
  cards: LorcanaCard[];
  isLoading: boolean;
  error: Error | null;
  totalCards: number;
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  uniqueSets: string[];
  /** Set info with names and codes */
  sets: SetInfo[];
  retryLoad: () => void;
  /** Starts a deferred load now (see `deferInitialLoad`); does nothing once it has started. */
  requestLoad: () => void;
}

export interface UseCardDataOptions {
  /**
   * Hold the load until requestLoad() or the first idle moment after the first render (#641).
   * Read once, at mount. The homepage defers: its featured cards come from a small file, and
   * nothing else there needs the full list until someone searches, presses a card or leaves.
   */
  deferInitialLoad?: boolean;
}

/** Whether the load may start: at once, or when deferred, at requestLoad() or the next idle moment. */
function useLoadRequest(deferInitialLoad: boolean): [boolean, () => void] {
  const [requested, setRequested] = useState(!deferInitialLoad);
  useEffect(() => {
    if (requested) return;
    return whenIdle(() => setRequested(true));
  }, [requested]);
  return [requested, () => setRequested(true)];
}

/**
 * Hook to load card data and extract filter metadata (keywords, classifications, sets).
 */
export function useCardData({deferInitialLoad = false}: UseCardDataOptions = {}): UseCardDataReturn {
  const [cards, setCards] = useState<LorcanaCard[]>([]);
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [loadRequested, requestLoad] = useLoadRequest(deferInitialLoad);

  const retryLoad = () => {
    setRetryCount((c) => c + 1);
  };

  useEffect(() => {
    if (!loadRequested) return;
    let cancelled = false;

    async function loadCards() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchCardsFromLocal();
        if (!cancelled) {
          setCards(data.cards);
          setSets(data.sets);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to load cards'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadCards();
    return () => {
      cancelled = true;
    };
  }, [loadRequested, retryCount]);

  const uniqueKeywords = getUniqueKeywords(cards);
  const uniqueClassifications = getUniqueClassifications(cards);
  const uniqueSets = getUniqueSets(cards);

  return {
    cards,
    isLoading,
    error,
    totalCards: cards.length,
    uniqueKeywords,
    uniqueClassifications,
    uniqueSets,
    sets,
    retryLoad,
    requestLoad,
  };
}
