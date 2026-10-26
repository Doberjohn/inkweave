import {useEffect, useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../../shared/contexts/CardDataContext';
import type {PlaystyleGuides} from '../../playstyles/playstyleGuides';
import {
  fetchPlaystyleCardIds,
  fetchPlaystyleGuides,
  fetchPlaystyleMechanicIds,
  playstyleCardIdsIfLoaded,
  playstyleGuidesIfLoaded,
  playstyleMechanicIdsIfLoaded,
  type MechanicIdsByCard,
} from './playstyleFiles';

/**
 * Where a playstyle's mechanic ids stand (#930): their first load, which the page waits for; a
 * load after they failed, which only the tiles wait for; failed; or loaded.
 */
export type MechanicsStatus = 'loading' | 'reloading' | 'failed' | 'loaded';

/** Where the playstyle guides stand (#995): their first load, which the page waits for; failed; or loaded. */
export type GuidesStatus = 'loading' | 'failed' | 'loaded';

// ── Hooks ──

/**
 * Fetches pre-computed playstyle card lists.
 * Used by PlaystyleDetailPage for a single playstyle's cards and their mechanic ids (#930). It
 * loads until both have first answered, so the page draws its cards and their tiles in one
 * render, as when it worked the tiles out itself. If the mechanic ids fail, the cards still show:
 * `mechanicsStatus` says so, and `retryMechanics` asks for the ids again while the cards stay.
 * `retry`, for cards that failed, asks for both.
 */
export function usePrecomputedPlaystyleCards(playstyleId: string | undefined): {
  cards: LorcanaCard[];
  mechanicIds: MechanicIdsByCard;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
  mechanicsStatus: MechanicsStatus;
  retryMechanics: () => void;
} {
  const {data, isLoading: allLoading, error, retry} = useAllPlaystyleCards();
  const mechanics = usePlaystyleMechanicIds();
  const psData = playstyleId ? data.get(playstyleId) : undefined;
  const mechanicIds = playstyleId ? mechanics.ids?.[playstyleId] : undefined;

  return {
    cards: psData?.allCards ?? [],
    mechanicIds: mechanicIds ?? {},
    isLoading: allLoading || mechanics.status === 'loading',
    error,
    // When both files failed, a retry of the cards alone would bring them back without tiles.
    retry: () => {
      retry();
      mechanics.retry();
    },
    mechanicsStatus: mechanics.status,
    retryMechanics: mechanics.retry,
  };
}

/**
 * Every playstyle card's mechanic ids, starting from the shared request's result (#913). A
 * failure leaves the tiles out rather than failing the page: it is logged, `status` says so, and
 * `retry` or the next visit asks again.
 */
function usePlaystyleMechanicIds(): {
  ids: Record<string, MechanicIdsByCard> | null;
  status: MechanicsStatus;
  retry: () => void;
} {
  const [ids, setIds] = useState(playstyleMechanicIdsIfLoaded);
  const [status, setStatus] = useState<MechanicsStatus>(() =>
    playstyleMechanicIdsIfLoaded() === null ? 'loading' : 'loaded',
  );
  // Bumped by `retry`: a new attempt runs the fetch effect again.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchPlaystyleMechanicIds().then(
      (data) => {
        if (cancelled) return;
        setIds(data);
        setStatus('loaded');
      },
      (err: unknown) => {
        console.error('Failed to load playstyle mechanics:', err);
        if (!cancelled) setStatus('failed');
      },
    );

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // A load after a failure: the page keeps its cards, and only the tiles wait for it.
  const retry = () => {
    setStatus('reloading');
    setAttempt((n) => n + 1);
  };

  return {ids, status, retry};
}

/**
 * Every playstyle's written guide (#995), starting from the shared request's result, as the
 * mechanic ids do (#913). A failure leaves the guides out rather than failing the page: it is
 * logged, `status` says so, and the next visit asks again.
 */
export function usePlaystyleGuides(): {guides: PlaystyleGuides | null; status: GuidesStatus} {
  const [guides, setGuides] = useState(playstyleGuidesIfLoaded);
  const [status, setStatus] = useState<GuidesStatus>(() =>
    playstyleGuidesIfLoaded() === null ? 'loading' : 'loaded',
  );

  useEffect(() => {
    let cancelled = false;

    fetchPlaystyleGuides().then(
      (data) => {
        if (cancelled) return;
        setGuides(data);
        setStatus('loaded');
      },
      (err: unknown) => {
        console.error('Failed to load playstyle guides:', err);
        if (!cancelled) setStatus('failed');
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return {guides, status};
}

/**
 * Starts the files a playstyle's page waits for besides its card ids, every playstyle card's
 * mechanic ids and the guides, once the gallery is `drawn`, so a playstyle opened from it draws
 * its cards, tiles and guide on its first render (#913, #930, #995), and the requests never
 * compete with the gallery's own. The playstyle's page logs a failure, and asks again.
 */
export function usePreloadPlaystyleFiles(drawn: boolean): void {
  useEffect(() => {
    if (!drawn) return;
    fetchPlaystyleMechanicIds().catch(() => undefined);
    fetchPlaystyleGuides().catch(() => undefined);
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
