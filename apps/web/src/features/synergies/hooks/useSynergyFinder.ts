import {useState, useEffect, useMemo, useCallback} from 'react';
import type {LorcanaCard, SetInfo} from '../../cards';
import {
  fetchCardsFromLocal,
  getUniqueKeywords,
  getUniqueClassifications,
  getUniqueSets,
} from '../../cards';

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
}

/**
 * Hook to load and manage card data from LorcanaJSON
 */
export function useCardData(): UseCardDataReturn {
  const [cards, setCards] = useState<LorcanaCard[]>([]);
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retryLoad = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
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
  }, [retryCount]);

  const uniqueKeywords = useMemo(() => getUniqueKeywords(cards), [cards]);
  const uniqueClassifications = useMemo(() => getUniqueClassifications(cards), [cards]);
  const uniqueSets = useMemo(() => getUniqueSets(cards), [cards]);

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
  };
}
