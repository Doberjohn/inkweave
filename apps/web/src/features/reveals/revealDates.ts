const PREVIEW_CARDS_PATH = '/data/previewCards.json';
const REVEAL_SET_CODE = '13';

export interface RevealDates {
  prereleaseDate: Date;
  releaseDate: Date;
}

interface PreviewCardsJSON {
  sets?: Record<string, {prereleaseDate?: string; releaseDate?: string}>;
}

let cache: RevealDates | null = null;
let pending: Promise<RevealDates | null> | null = null;

function parseLocalMidnight(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export async function fetchRevealDates(): Promise<RevealDates | null> {
  if (cache) return cache;
  if (pending) return pending;

  pending = (async () => {
    try {
      const response = await fetch(PREVIEW_CARDS_PATH);
      if (!response.ok) return null;
      const data: PreviewCardsJSON = await response.json();
      const set = data.sets?.[REVEAL_SET_CODE];
      if (!set?.prereleaseDate || !set?.releaseDate) return null;
      cache = {
        prereleaseDate: parseLocalMidnight(set.prereleaseDate),
        releaseDate: parseLocalMidnight(set.releaseDate),
      };
      return cache;
    } catch {
      return null;
    }
  })();

  return pending;
}

/** @internal reset for testing */
export function _resetRevealDatesCache(): void {
  cache = null;
  pending = null;
}
