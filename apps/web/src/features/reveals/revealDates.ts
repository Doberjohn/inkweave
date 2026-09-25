import {useEffect, useState} from 'react';
import {REVEAL_SET_CODE} from '../../shared/constants';

const PREVIEW_CARDS_PATH = '/data/previewCards.json';

export interface RevealDates {
  prereleaseDate: Date;
  releaseDate: Date;
  /** The set's display name, e.g. "Attack of the Vine!". Empty string when the JSON omits it. */
  name: string;
}

interface PreviewCardsJSON {
  sets?: Record<string, {prereleaseDate?: string; releaseDate?: string; name?: string}>;
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
        // Not part of the null-guard above: a missing name degrades the notice's
        // copy, while missing dates would make the whole phase calculation wrong.
        name: set.name ?? '',
      };
      return cache;
    } catch {
      return null;
    } finally {
      // Only the SUCCESS path memoises, via `cache`. Clearing `pending` on failure
      // lets the next call retry instead of a single transient error poisoning the
      // rest of the session.
      if (!cache) pending = null;
    }
  })();

  return pending;
}

/** @internal reset for testing */
export function _resetRevealDatesCache(): void {
  cache = null;
  pending = null;
}

/**
 * The dates if a previous fetch already resolved them, else null. Synchronous, so
 * a consumer can render correct copy on its FIRST paint instead of flashing the
 * not-yet-loaded state for a frame.
 */
export function peekRevealDates(): RevealDates | null {
  return cache;
}

/**
 * The resolved reveal dates, or null while loading or when the JSON lacks them.
 * `fetchRevealDates` memoises, so mounting this in several places costs one fetch.
 */
export function useRevealDates(): RevealDates | null {
  const [dates, setDates] = useState<RevealDates | null>(peekRevealDates);
  useEffect(() => {
    let cancelled = false;
    void fetchRevealDates().then((d) => {
      if (!cancelled) setDates(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return dates;
}
