import {useEffect, useState} from 'react';
import {fetchRevealDates, type RevealDates} from './revealDates';

export type RevealPhase =
  | 'hidden'
  | 'loading'
  | 'pre-release'
  | 'pre-release-live'
  | 'released';

/**
 * Pure phase-determination function — exported for unit testing.
 *
 * Returns 'hidden' when the flag is off; 'loading' when the flag is on but the
 * reveal dates have not yet loaded; otherwise compares `now` against the
 * reveal-season boundaries.
 *
 * Boundary semantics (per acceptance criteria):
 *   - On or after `prereleaseDate` local midnight → 'pre-release-live'
 *   - On or after `releaseDate` local midnight    → 'released'
 *   - Before `prereleaseDate`                     → 'pre-release'
 */
export function computePhase(
  now: Date,
  dates: RevealDates | null,
  flagEnabled: boolean,
): RevealPhase {
  if (!flagEnabled) return 'hidden';
  if (!dates) return 'loading';

  const t = now.getTime();
  if (t >= dates.releaseDate.getTime()) return 'released';
  if (t >= dates.prereleaseDate.getTime()) return 'pre-release-live';
  return 'pre-release';
}

function isFlagEnabled(): boolean {
  return import.meta.env.VITE_IS_REVEAL_SEASON === 'true';
}

function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

export function useRevealPhase(): RevealPhase {
  const flagEnabled = isFlagEnabled();
  const [dates, setDates] = useState<RevealDates | null>(null);
  const [phase, setPhase] = useState<RevealPhase>(() =>
    computePhase(new Date(), null, flagEnabled),
  );

  useEffect(() => {
    if (!flagEnabled) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const recompute = (d: RevealDates | null) => {
      if (cancelled) return;
      setPhase(computePhase(new Date(), d, flagEnabled));
      timeoutId = setTimeout(() => recompute(d), msUntilNextLocalMidnight(new Date()));
    };

    fetchRevealDates().then((d) => {
      if (cancelled) return;
      setDates(d);
      recompute(d);
    });

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [flagEnabled]);

  // `dates` is referenced so React keeps the effect in sync — value already
  // flowed into `phase` via recompute.
  void dates;

  return phase;
}
