let cache: Record<string, string[]> | null = null;
let request: Promise<Record<string, string[]>> | null = null;

/**
 * Every playstyle's card ids, fetched once for the page: main.tsx's hold (#915) and the playstyle
 * pages share the request. A failure is forgotten, so a retry fetches again. It lives apart from
 * the hooks so the router can start it without carrying them into the entry.
 */
export function fetchPlaystyleCardIds(): Promise<Record<string, string[]>> {
  if (cache) return Promise.resolve(cache);
  request ??= loadPlaystyleCardIds().finally(() => {
    request = null;
  });
  return request;
}

/** The ids once fetchPlaystyleCardIds() has resolved, so a first render can start from them. */
export function playstyleCardIdsIfLoaded(): Record<string, string[]> | null {
  return cache;
}

/** @internal reset for testing */
export function _resetPlaystyleCardIds(): void {
  cache = null;
  request = null;
}

async function loadPlaystyleCardIds(): Promise<Record<string, string[]>> {
  const response = await fetch('/data/synergies/_playstyles.json');
  if (!response.ok) throw new Error(`Failed to fetch playstyle data: ${response.status}`);

  // Guard against SPA fallback returning HTML instead of JSON
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Playstyle data unavailable (received HTML instead of JSON)');
  }

  const data: Record<string, string[]> = await response.json();
  cache = data;
  return data;
}
