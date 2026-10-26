import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useSettledValue} from '../useSettledValue';

describe('useSettledValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const renderSettled = (value: string) =>
    renderHook(({current}) => useSettledValue(current, 500), {initialProps: {current: value}});

  it('returns the first value at once', () => {
    const {result} = renderSettled('7 cards');
    expect(result.current).toBe('7 cards');
  });

  it('returns a new value only once it has held for the delay', () => {
    const {result, rerender} = renderSettled('7 cards');

    rerender({current: '3 cards'});
    act(() => vi.advanceTimersByTime(499));
    expect(result.current).toBe('7 cards');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('3 cards');
  });

  it('settles a burst of changes into its last value, skipping the ones in between', () => {
    const {result, rerender} = renderSettled('Showing 204 of 1,228 cards');
    const seen = new Set([result.current]);

    for (const value of ['312 cards', '41 cards', '9 cards']) {
      rerender({current: value});
      act(() => vi.advanceTimersByTime(300));
      seen.add(result.current);
    }
    act(() => vi.advanceTimersByTime(200));
    seen.add(result.current);

    expect([...seen]).toEqual(['Showing 204 of 1,228 cards', '9 cards']);
  });
});
