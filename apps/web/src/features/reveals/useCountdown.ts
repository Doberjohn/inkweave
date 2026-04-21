import {useEffect, useState} from 'react';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CountdownState {
  days: number;
  target: Date | null;
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

function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

/**
 * Countdown hook that re-renders once per local-midnight boundary, not every second.
 * Returns the whole-day remainder and the target Date passed in. A null target
 * yields 0 days (useful while the target is still loading).
 *
 * `days` is derived on every render from `target` + the current clock. A `tick`
 * counter in state forces a re-render at each local midnight via `setTimeout` —
 * the effect schedules the next tick but never sets state synchronously itself.
 */
export function useCountdown(target: Date | null): CountdownState {
  const [, setTick] = useState(0);
  const days = target ? daysUntil(new Date(), target) : 0;

  useEffect(() => {
    if (!target) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      timeoutId = setTimeout(() => {
        setTick((t) => t + 1);
        schedule();
      }, msUntilNextLocalMidnight(new Date()));
    };
    schedule();
    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [target]);

  return {days, target};
}
