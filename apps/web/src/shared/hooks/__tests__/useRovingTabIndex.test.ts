import {describe, it, expect, vi} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useRovingTabIndex} from '../useRovingTabIndex';

function makeKeyEvent(key: string) {
  return {key, preventDefault: vi.fn()} as unknown as React.KeyboardEvent;
}

describe('useRovingTabIndex', () => {
  it('starts with activeIndex 0', () => {
    const {result} = renderHook(() => useRovingTabIndex({itemCount: 9, columns: 3}));
    expect(result.current.getTabIndex(0)).toBe(0);
    expect(result.current.getTabIndex(1)).toBe(-1);
  });

  it('ArrowRight moves to next item and calls preventDefault', () => {
    const {result} = renderHook(() => useRovingTabIndex({itemCount: 9, columns: 3}));
    const event = makeKeyEvent('ArrowRight');
    act(() => result.current.handleKeyDown(event));
    expect(result.current.getTabIndex(1)).toBe(0);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('ArrowDown moves by column count', () => {
    const {result} = renderHook(() => useRovingTabIndex({itemCount: 9, columns: 3}));
    act(() => result.current.handleKeyDown(makeKeyEvent('ArrowDown')));
    expect(result.current.getTabIndex(3)).toBe(0);
  });

  it('does not move past the end', () => {
    const {result} = renderHook(() => useRovingTabIndex({itemCount: 3, columns: 3}));
    act(() => result.current.handleKeyDown(makeKeyEvent('ArrowRight')));
    act(() => result.current.handleKeyDown(makeKeyEvent('ArrowRight')));
    act(() => result.current.handleKeyDown(makeKeyEvent('ArrowRight')));
    expect(result.current.getTabIndex(2)).toBe(0);
  });

  it('does not move before the start', () => {
    const {result} = renderHook(() => useRovingTabIndex({itemCount: 9, columns: 3}));
    act(() => result.current.handleKeyDown(makeKeyEvent('ArrowLeft')));
    expect(result.current.getTabIndex(0)).toBe(0);
  });

  it('ArrowUp at index 0 stays at 0', () => {
    const {result} = renderHook(() => useRovingTabIndex({itemCount: 9, columns: 3}));
    act(() => result.current.handleKeyDown(makeKeyEvent('ArrowUp')));
    expect(result.current.getTabIndex(0)).toBe(0);
  });

  it('Home moves to first item', () => {
    const {result} = renderHook(() => useRovingTabIndex({itemCount: 9, columns: 3}));
    act(() => result.current.focusItem(4));
    act(() => result.current.handleKeyDown(makeKeyEvent('Home')));
    expect(result.current.getTabIndex(0)).toBe(0);
  });

  it('End moves to last item', () => {
    const {result} = renderHook(() => useRovingTabIndex({itemCount: 9, columns: 3}));
    act(() => result.current.handleKeyDown(makeKeyEvent('End')));
    expect(result.current.getTabIndex(8)).toBe(0);
  });

  it('Tab key does not call preventDefault', () => {
    const {result} = renderHook(() => useRovingTabIndex({itemCount: 9, columns: 3}));
    const event = makeKeyEvent('Tab');
    act(() => result.current.handleKeyDown(event));
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('clamps activeIndex when itemCount shrinks', () => {
    const {result, rerender} = renderHook(
      ({count}) => useRovingTabIndex({itemCount: count, columns: 3}),
      {initialProps: {count: 9}},
    );
    act(() => result.current.focusItem(7));
    expect(result.current.getTabIndex(7)).toBe(0);
    // Shrink to 4 items — index 7 should clamp to 3
    rerender({count: 4});
    expect(result.current.getTabIndex(3)).toBe(0);
  });

  it('handles columns=0 gracefully (treats as 1)', () => {
    const {result} = renderHook(() => useRovingTabIndex({itemCount: 9, columns: 0}));
    act(() => result.current.handleKeyDown(makeKeyEvent('ArrowDown')));
    expect(result.current.getTabIndex(1)).toBe(0);
  });
});
