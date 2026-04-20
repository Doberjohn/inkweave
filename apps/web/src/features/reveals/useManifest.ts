import {useState, useEffect} from 'react';

let manifestCache: Set<string> | null = null;
let manifestPromise: Promise<Set<string>> | null = null;

async function fetchManifest(): Promise<Set<string>> {
  if (manifestCache) return manifestCache;
  if (manifestPromise) return manifestPromise;

  manifestPromise = (async () => {
    const response = await fetch('/data/synergies/_manifest.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${response.status}`);
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error('Manifest data unavailable (received HTML instead of JSON)');
    }
    const ids: string[] = await response.json();
    manifestCache = new Set(ids);
    return manifestCache;
  })();

  return manifestPromise;
}

/** @internal reset for testing */
export function _resetManifestCache(): void {
  manifestCache = null;
  manifestPromise = null;
}

export interface UseManifestReturn {
  hasSynergies: (cardId: string) => boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetches the synergy manifest (list of card IDs with precomputed synergy files).
 * Used by the reveals page to decide if a card tile is clickable.
 */
export function useManifest(): UseManifestReturn {
  const [manifest, setManifest] = useState<Set<string> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchManifest()
      .then((data) => {
        if (cancelled) return;
        setManifest(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    hasSynergies: (cardId: string) => manifest?.has(cardId) ?? false,
    isLoading,
    error,
  };
}
