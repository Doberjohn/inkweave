import {useState, useEffect} from 'react';
import type {LorcanaCard, SetInfo} from '../../cards';
import {
  fetchCardsFromLocal,
  smallImageUrl,
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
 * Hook to load card data and extract filter metadata (keywords, classifications, sets).
 */
export function useCardData(): UseCardDataReturn {
  const [cards, setCards] = useState<LorcanaCard[]>([]);
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retryLoad = () => {
    setRetryCount((c) => c + 1);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadCards() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchCardsFromLocal();
        if (!cancelled) {
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
  };
}

/** Inject preload link tags for the first N card images (small grid size) to jumpstart loading. */
function preloadFirstThumbnails(cards: LorcanaCard[], count: number) {
  for (let i = 0; i < Math.min(count, cards.length); i++) {
    const url = cards[i].imageUrl;
    if (!url) continue;
    const href = smallImageUrl(url);
    if (!href) continue;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    document.head.appendChild(link);
  }
}
