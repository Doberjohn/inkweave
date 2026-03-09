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
          // Inject <link rel="preload"> for first N thumbnail images immediately,
          // before React re-renders. This lets the browser start fetching LCP images
          // while React is still computing renders.
          preloadFirstThumbnails(data.cards, 6);
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

/** Inject preload link tags for the first N card images to jumpstart image loading. */
function preloadFirstThumbnails(cards: LorcanaCard[], count: number) {
  for (let i = 0; i < Math.min(count, cards.length); i++) {
    const url = cards[i].imageUrl;
    if (!url) continue;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  }
}
