import {useSearchParams} from 'react-router-dom';
import type {Ink} from 'inkweave-synergy-engine';
import {ALL_INKS} from '../../shared/constants';

const DEFAULT_INK: Ink = 'Amber';

// lowercase -> canonical Ink, so ?ink=emerald / Emerald / EMERALD all resolve.
const INK_BY_LOWER: Record<string, Ink> = Object.fromEntries(
  ALL_INKS.map((ink) => [ink.toLowerCase(), ink]),
) as Record<string, Ink>;

/** The starting mosaic ink from a raw ?ink= value (case-insensitive); Amber on miss. */
export function parseInkParam(raw: string | null): Ink {
  if (!raw) return DEFAULT_INK;
  return INK_BY_LOWER[raw.trim().toLowerCase()] ?? DEFAULT_INK;
}

/**
 * The featured mosaic ink, backed by the `?ink=` query param (two-way). Reads
 * case-insensitively; writes the canonical lowercase form, and deletes the param
 * when the default (Amber) is selected so the default state is a clean URL.
 */
export function useInkParam(): [Ink, (ink: Ink) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedInk = parseInkParam(searchParams.get('ink'));

  const selectInk = (ink: Ink) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (ink === DEFAULT_INK) next.delete('ink');
        else next.set('ink', ink.toLowerCase());
        return next;
      },
      {replace: true},
    );
  };

  return [selectedInk, selectInk];
}
