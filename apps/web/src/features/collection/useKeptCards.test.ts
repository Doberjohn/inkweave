import {describe, it, expect} from 'vitest';
import {act, renderHook} from '@testing-library/react';
import {useKeptCards} from './useKeptCards';

describe('useKeptCards (#826)', () => {
  it('keeps each card changed by hand while the view stays the same', () => {
    const {result, rerender} = renderHook(({view}) => useKeptCards(view), {initialProps: {view: 'on|9|missing|'}});
    act(() => result.current.keep('a'));
    act(() => result.current.keep('b'));
    rerender({view: 'on|9|missing|'});
    expect([...result.current.kept]).toEqual(['a', 'b']);
  });

  it('lets them all go once the view changes, and stays clear when it changes back', () => {
    const {result, rerender} = renderHook(({view}) => useKeptCards(view), {initialProps: {view: 'on|9|missing|'}});
    act(() => result.current.keep('a'));
    rerender({view: 'on|9|missing|cost-asc'});
    expect(result.current.kept.size).toBe(0);
    rerender({view: 'on|9|missing|'});
    expect(result.current.kept.size).toBe(0);
  });
});
