import type {PairIndexEntry} from './types';

let request: Promise<PairIndexEntry[]> | null = null;

/**
 * The pairs index the vote page draws from, fetched once for the page: main.tsx's hold on a
 * prerendered /vote starts it before the app renders (#915), and the vote page's queue takes the
 * same request. A failure is forgotten, so a retry fetches again. It lives apart from the queue
 * so the router can start it without carrying the queue into the entry.
 */
export function fetchPairsIndex(): Promise<PairIndexEntry[]> {
  request ??= loadPairsIndex().catch((error: unknown) => {
    request = null;
    throw error;
  });
  return request;
}

/** @internal reset for testing */
export function _resetPairsIndexRequest(): void {
  request = null;
}

async function loadPairsIndex(): Promise<PairIndexEntry[]> {
  const response = await fetch('/data/synergies/_pairs_index.json');
  if (!response.ok) throw new Error(`Failed to load pairs index: ${response.status}`);
  return response.json();
}
