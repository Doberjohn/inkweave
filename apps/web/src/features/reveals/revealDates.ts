import {REVEAL_SET_CODE} from '../../shared/constants';
import {fetchPreviewCards} from '../cards/previewCards';

export interface RevealDates {
  prereleaseDate: Date;
  releaseDate: Date;
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

  // The same request the card loader makes (#641), so previewCards.json loads once per page.
  pending = fetchPreviewCards().then((data) => {
    const set = data?.sets?.[REVEAL_SET_CODE];
    if (!set?.prereleaseDate || !set?.releaseDate) return null;
    cache = {
      prereleaseDate: parseLocalMidnight(set.prereleaseDate),
      releaseDate: parseLocalMidnight(set.releaseDate),
    };
    return cache;
  });

  return pending;
}

/** @internal reset for testing */
export function _resetRevealDatesCache(): void {
  cache = null;
  pending = null;
}
