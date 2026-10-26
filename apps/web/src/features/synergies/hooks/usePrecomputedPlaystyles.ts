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
 * Where one of a playstyle page's files stands (#930, #995): its first load, which the page
 * waits for; a load after it failed, which only what it fills waits for; failed; or loaded.
 */
type PlaystyleFileStatus = 'loading' | 'reloading' | 'failed' | 'loaded';

/** Where a playstyle's mechanic ids stand (#930): a load after they failed, only the tiles wait for. */
export type MechanicsStatus = PlaystyleFileStatus;

/** Where the playstyle guides stand (#995): a load after they failed holds nothing. */
export type GuidesStatus = PlaystyleFileStatus;

/** One of a playstyle page's files, as its hooks load it (#913). */
interface PlaystyleFile<T> {
  fetch: () => Promise<T>;
  ifLoaded: () => T | null;
  /** What the console says before the error when the file fails. */
  failure: string;
}

const MECHANIC_IDS_FILE: PlaystyleFile<Record<string, MechanicIdsByCard>> = {
  fetch: fetchPlaystyleMechanicIds,
  ifLoaded: playstyleMechanicIdsIfLoaded,
  failure: 'Failed to load playstyle mechanics:',
};

const GUIDES_FILE: PlaystyleFile<PlaystyleGuides> = {
  fetch: fetchPlaystyleGuides,
  ifLoaded: playstyleGuidesIfLoaded,
  failure: 'Failed to load playstyle guides:',
};

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
  const mechanics = usePlaystyleFile(MECHANIC_IDS_FILE, playstyleId);
  const psData = playstyleId ? data.get(playstyleId) : undefined;
  const mechanicIds = playstyleId ? mechanics.data?.[playstyleId] : undefined;

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
 * One of a playstyle page's files, starting from the shared request's result (#913). A failure
 * leaves out what the file fills rather than failing the page: it is logged, `status` says so,
 * and `retry`, the next playstyle the page shows or the next visit asks again. The page stays
 * mounted from one playstyle to the next, so each new `playstyleId` asks too, which the file's
 * cache answers at once once it has loaded.
 */
function usePlaystyleFile<T>(
  file: PlaystyleFile<T>,
  playstyleId: string | undefined,
): {data: T | null; status: PlaystyleFileStatus; retry: () => void} {
  const [data, setData] = useState(file.ifLoaded);
  const [status, setStatus] = useState<PlaystyleFileStatus>(() =>
    file.ifLoaded() === null ? 'loading' : 'loaded',
  );
  // Bumped by `retry`: a new attempt runs the fetch effect again.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    file.fetch().then(
      (loaded) => {
        if (cancelled) return;
        setData(loaded);
        setStatus('loaded');
      },
      (err: unknown) => {
        // Logged once: a cancelled effect shares its request with the one that replaced it.
        if (cancelled) return;
        console.error(file.failure, err);
        setStatus('failed');
      },
    );

    return () => {
      cancelled = true;
    };
  }, [file, playstyleId, attempt]);

  // A load after a failure: the page keeps its cards, and only what the file fills waits for it.
  const retry = () => {
    setStatus('reloading');
    setAttempt((n) => n + 1);
  };

  return {data, status, retry};
}

/** Every playstyle's written guide (#995), loaded as usePlaystyleFile says, for `playstyleId`'s page. */
export function usePlaystyleGuides(playstyleId: string | undefined): {
  guides: PlaystyleGuides | null;
  status: GuidesStatus;
} {
  const {data, status} = usePlaystyleFile(GUIDES_FILE, playstyleId);
  return {guides: data, status};
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
