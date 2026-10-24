import {useEffect, useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../../shared/contexts/CardDataContext';
import {
  fetchPlaystyleCardIds,
  fetchPlaystyleMechanicIds,
  playstyleCardIdsIfLoaded,
  playstyleMechanicIdsIfLoaded,
  type MechanicIdsByCard,
} from './playstyleFiles';

// ── Hooks ──

/**
 * Fetches pre-computed playstyle card lists.
 * Used by PlaystyleDetailPage for a single playstyle's cards and their mechanic ids (#930). It
 * loads until both have arrived, so the page draws its cards and their tiles in one render, as
 * when it worked the tiles out itself. If the mechanic ids fail, the cards still show, without
 * tiles, and `retry` asks for them again as well.
 */
export function usePrecomputedPlaystyleCards(playstyleId: string | undefined): {
  cards: LorcanaCard[];
  mechanicIds: MechanicIdsByCard;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
} {
  const {data, isLoading: allLoading, error, retry} = useAllPlaystyleCards();
  const mechanics = usePlaystyleMechanicIds();
  const psData = playstyleId ? data.get(playstyleId) : undefined;
  const mechanicIds = playstyleId ? mechanics.ids?.[playstyleId] : undefined;

  return {
    cards: psData?.allCards ?? [],
    mechanicIds: mechanicIds ?? {},
    isLoading: allLoading || mechanics.isLoading,
    error,
    // When both files failed, a retry of the cards alone would bring them back without tiles.
    retry: () => {
      retry();
      mechanics.retry();
    },
  };
}

/**
 * Every playstyle card's mechanic ids, starting from the shared request's result (#913). A
 * failure leaves the tiles out rather than failing the page: it is logged, and `retry` or the
 * next visit asks again.
 */
function usePlaystyleMechanicIds(): {
  ids: Record<string, MechanicIdsByCard> | null;
  isLoading: boolean;
  retry: () => void;
} {
  const [ids, setIds] = useState(playstyleMechanicIdsIfLoaded);
  const [isLoading, setIsLoading] = useState(() => playstyleMechanicIdsIfLoaded() === null);
  // Bumped by `retry`: a new attempt runs the fetch effect again.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const settle = (data: Record<string, MechanicIdsByCard> | null) => {
      if (cancelled) return;
      setIds(data);
      setIsLoading(false);
    };

    fetchPlaystyleMechanicIds().then(settle, (err: unknown) => {
      console.error('Failed to load playstyle mechanics:', err);
      settle(null);
    });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setIsLoading(true);
    setAttempt((n) => n + 1);
  };

  return {ids, isLoading, retry};
}

/**
 * Starts every playstyle card's mechanic ids once the gallery is `drawn`, so a playstyle opened
 * from it draws its cards and tiles on its first render (#913, #930), and the request never
 * competes with the gallery's own. The playstyle's page logs a failure, and asks again.
 */
export function usePreloadPlaystyleMechanics(drawn: boolean): void {
  useEffect(() => {
    if (drawn) fetchPlaystyleMechanicIds().catch(() => undefined);
  }, [drawn]);
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
  const [rawData, setRawData] = useState<Record<string, string[]> | null>(playstyleCardIdsIfLoaded);
  const [isLoading, setIsLoading] = useState(() => playstyleCardIdsIfLoaded() === null);
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
