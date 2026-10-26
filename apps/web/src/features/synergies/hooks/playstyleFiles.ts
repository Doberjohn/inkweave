import type {PlaystyleGuides} from '../../playstyles/playstyleGuides';

/** Each playstyle card's mechanic ids, by card id (precompute's `getPlaystyleMechanicIds`, #930). */
export type MechanicIdsByCard = Readonly<Record<string, readonly string[]>>;

/**
 * One of the playstyle pages' files, fetched once for the page: main.tsx's hold (#915) and the
 * playstyle pages share the request. A failure is forgotten, so the next ask fetches again. The
 * files live apart from the hooks so the router can start them without carrying the hooks into
 * the entry.
 */
function playstyleFile<T>(file: string, what: string) {
  let cache: T | null = null;
  let request: Promise<T> | null = null;
  return {
    get(): Promise<T> {
      if (cache) return Promise.resolve(cache);
      request ??= fetchPlaystyleFile<T>(file, what)
        .then((data) => (cache = data))
        .finally(() => {
          request = null;
        });
      return request;
    },
    ifLoaded: (): T | null => cache,
    reset(): void {
      cache = null;
      request = null;
    },
  };
}

/** Fetches `file`, a path under /data/, which `what` names in errors ("data", "mechanics"). */
async function fetchPlaystyleFile<T>(file: string, what: string): Promise<T> {
  const response = await fetch(`/data/${file}`);
  if (!response.ok) throw new Error(`Failed to fetch playstyle ${what}: ${response.status}`);

  // Guard against SPA fallback returning HTML instead of JSON
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Playstyle ${what} unavailable (received HTML instead of JSON)`);
  }

  return response.json();
}

// Precompute writes the two synergy files; the guides are written by hand (#995).
const cardIds = playstyleFile<Record<string, string[]>>('synergies/_playstyles.json', 'data');
const mechanicIds = playstyleFile<Record<string, MechanicIdsByCard>>(
  'synergies/_playstyleMechanics.json',
  'mechanics',
);
const guides = playstyleFile<PlaystyleGuides>('playstyleGuides.json', 'guides');

/** Every playstyle's card ids. */
export const fetchPlaystyleCardIds = cardIds.get;

/** The card ids once fetchPlaystyleCardIds() has resolved, so a first render can start from them. */
export const playstyleCardIdsIfLoaded = cardIds.ifLoaded;

/** Each playstyle card's mechanic ids, which a playstyle's page draws its tiles from (#930). */
export const fetchPlaystyleMechanicIds = mechanicIds.get;

/** The mechanic ids once fetchPlaystyleMechanicIds() has resolved. */
export const playstyleMechanicIdsIfLoaded = mechanicIds.ifLoaded;

/** Every playstyle's written guide, which a playstyle's page shows under its cards (#995). */
export const fetchPlaystyleGuides = guides.get;

/** The guides once fetchPlaystyleGuides() has resolved. */
export const playstyleGuidesIfLoaded = guides.ifLoaded;

/** @internal reset for testing */
export function _resetPlaystyleFiles(): void {
  cardIds.reset();
  mechanicIds.reset();
  guides.reset();
}
