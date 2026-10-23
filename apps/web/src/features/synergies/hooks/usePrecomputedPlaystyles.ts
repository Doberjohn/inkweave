import {useEffect, useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../../shared/contexts/CardDataContext';

// ── Module-level fetch cache ──

let playstyleFetchCache: Record<string, string[]> | null = null;

async function fetchPlaystyleCardIds(): Promise<Record<string, string[]>> {
  if (playstyleFetchCache) return playstyleFetchCache;

  const response = await fetch('/data/synergies/_playstyles.json');
  if (!response.ok) throw new Error(`Failed to fetch playstyle data: ${response.status}`);

  // Guard against SPA fallback returning HTML instead of JSON
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Playstyle data unavailable (received HTML instead of JSON)');
  }

  const data: Record<string, string[]> = await response.json();
  playstyleFetchCache = data;
  return data;
}

// ── Hooks ──

/**
 * Fetches pre-computed playstyle card lists.
 * Used by PlaystyleDetailPage for a single playstyle's cards.
 */
export function usePrecomputedPlaystyleCards(playstyleId: string | undefined): {
  cards: LorcanaCard[];
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
} {
  const {data, isLoading: allLoading, error, retry} = useAllPlaystyleCards();

  const cards = (() => {
    if (!playstyleId) return [];
    const psData = data.get(playstyleId);
    return psData?.allCards ?? [];
  })();

  return {cards, isLoading: allLoading, error, retry};
}

/**
 * Fetches all playstyle card data (shared fetch for gallery + detail pages).
 * Returns resolved card objects for each playstyle.
 *
 * Starts from the module cache (#913), so a visit after the first (the gallery, then a
 * playstyle) has its cards on its first render instead of one loading frame. `retry` asks
 * again after a failed fetch.
 */
export function useAllPlaystyleCards(): {
  data: Map<string, {count: number; previewCards: LorcanaCard[]; allCards: LorcanaCard[]}>;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
} {
  const {getCardById} = useCardDataContext();
  const [rawData, setRawData] = useState<Record<string, string[]> | null>(() => playstyleFetchCache);
  const [isLoading, setIsLoading] = useState(() => playstyleFetchCache === null);
  const [error, setError] = useState<Error | null>(null);
  // Bumped by `retry`: a new attempt runs the fetch effect again.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchPlaystyleCardIds()
      .then((data) => {
        if (!cancelled) {
          setRawData(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error(String(err));
          console.error('Failed to load playstyle data:', err);
          setError(error);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setError(null);
    setIsLoading(true);
    setAttempt((n) => n + 1);
  };

  const data = (() => {
    const result = new Map<
      string,
      {count: number; previewCards: LorcanaCard[]; allCards: LorcanaCard[]}
    >();
    if (!rawData) return result;
    for (const [psId, ids] of Object.entries(rawData)) {
      const resolved = ids
        .map((id) => getCardById(id))
        .filter((c): c is LorcanaCard => c != null)
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
      result.set(psId, {
        count: resolved.length,
        previewCards: resolved.slice(0, 4),
        allCards: resolved,
      });
    }
    return result;
  })();

  return {data, isLoading, error, retry};
}
