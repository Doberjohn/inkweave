import {useEffect, useState} from 'react';
import type {RevealDates} from './revealDates';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The day the reveals countdown runs to: the pre-release, then the store release. */
export type CountdownMilestone = 'pre-release' | 'store-release';

export interface CountdownState {
  days: number;
  milestone: CountdownMilestone;
}

/**
 * Calendar-day delta between `now` and `target`, both reduced to local midnight.
 * `round` (not ceil/floor) handles DST-adjusted days (23h or 25h) cleanly.
 * Never returns a negative value.
 */
export function daysUntil(now: Date, target: Date): number {
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetMidnight = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  ).getTime();
  return Math.max(0, Math.round((targetMidnight - nowMidnight) / DAY_MS));
}

/**
 * The countdown on `now`'s day: to the pre-release until that day arrives, then to the
 * store release, so the week between the two counts down instead of resting at 0. It
 * switches at the local midnight useRevealPhase's 'pre-release-live' starts at.
 */
export function computeCountdown(now: Date, dates: RevealDates): CountdownState {
  if (now.getTime() < dates.prereleaseDate.getTime()) {
    return {days: daysUntil(now, dates.prereleaseDate), milestone: 'pre-release'};
  }
  return {days: daysUntil(now, dates.releaseDate), milestone: 'store-release'};
}

function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

/**
 * Countdown hook that re-renders once per local-midnight boundary, not every second.
 * Null while the reveal dates are still loading.
 *
 * The clock is state, set again at each local midnight by `setTimeout`, so the React
 * Compiler's memo of the countdown is keyed on it. Read inline (`new Date()` in render),
 * the clock was invisible to that memo: it kept the countdown keyed on the target alone,
 * and the midnight re-render showed the day before's number.
 */
export function useCountdown(dates: RevealDates | null): CountdownState | null {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      timeoutId = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, msUntilNextLocalMidnight(new Date()));
    };
    schedule();
    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);

  return dates ? computeCountdown(now, dates) : null;
}
