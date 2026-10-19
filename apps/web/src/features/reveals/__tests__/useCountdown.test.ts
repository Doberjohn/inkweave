import {describe, it, expect, vi, afterEach} from 'vitest';
import {act, renderHook} from '@testing-library/react';
import {computeCountdown, daysUntil, useCountdown} from '../useCountdown';

describe('daysUntil', () => {
  it('returns 0 when now is past the target', () => {
    const target = new Date(2026, 4, 8, 0, 0, 0);
    const now = new Date(2026, 4, 10, 10, 0, 0);
    expect(daysUntil(now, target)).toBe(0);
  });

  it('returns 0 when now is on the target calendar day (any time)', () => {
    const target = new Date(2026, 4, 8, 0, 0, 0);
    expect(daysUntil(new Date(2026, 4, 8, 0, 0, 0), target)).toBe(0);
    expect(daysUntil(new Date(2026, 4, 8, 23, 59, 59), target)).toBe(0);
  });

  it('returns 1 for the day before the target, regardless of time', () => {
    const target = new Date(2026, 4, 8, 0, 0, 0);
    expect(daysUntil(new Date(2026, 4, 7, 0, 0, 1), target)).toBe(1);
    expect(daysUntil(new Date(2026, 4, 7, 23, 59, 59), target)).toBe(1);
  });

  it('counts whole calendar days to the target', () => {
    const target = new Date(2026, 4, 15, 0, 0, 0);
    expect(daysUntil(new Date(2026, 4, 8, 12), target)).toBe(7);
    expect(daysUntil(new Date(2026, 4, 1, 12), target)).toBe(14);
  });
});

// Set 14's season: pre-release Friday 16 October, store release Friday 23 October.
const dates = {prereleaseDate: new Date(2026, 9, 16), releaseDate: new Date(2026, 9, 23)};

describe('computeCountdown', () => {
  it('counts down to the pre-release before its day', () => {
    expect(computeCountdown(new Date(2026, 9, 15, 23, 59), dates)).toEqual({
      days: 1,
      milestone: 'pre-release',
    });
  });

  it('counts down to the store release from pre-release day on', () => {
    expect(computeCountdown(new Date(2026, 9, 16), dates)).toEqual({
      days: 7,
      milestone: 'store-release',
    });
    expect(computeCountdown(new Date(2026, 9, 19, 18), dates)).toEqual({
      days: 4,
      milestone: 'store-release',
    });
  });
});

describe('useCountdown', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is null while the reveal dates load', () => {
    const {result} = renderHook(() => useCountdown(null));
    expect(result.current).toBeNull();
  });

  it('moves on at local midnight on a page left open', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 15, 23, 0));
    const {result} = renderHook(() => useCountdown(dates));
    expect(result.current).toEqual({days: 1, milestone: 'pre-release'});

    act(() => vi.advanceTimersByTime(2 * 60 * 60 * 1000));
    expect(result.current).toEqual({days: 7, milestone: 'store-release'});
  });
});
