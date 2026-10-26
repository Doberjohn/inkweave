import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {act, renderHook} from '@testing-library/react';
import {useTransitionPresence} from '../useTransitionPresence';

describe('useTransitionPresence', () => {
  beforeEach(() => {
    vi.useFakeTimers({toFake: ['requestAnimationFrame', 'cancelAnimationFrame']});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts in the enter state and turns visible on the next frame, so the entrance runs', () => {
    const {result} = renderHook(() => useTransitionPresence(true));
    expect(result.current).toMatchObject({mounted: true, visible: false});

    act(() => vi.advanceTimersToNextFrame());
    expect(result.current.visible).toBe(true);
  });

  it('with startVisible, is visible from the first frame so no entrance runs', () => {
    const {result} = renderHook(() => useTransitionPresence(true, {startVisible: true}));

    expect(result.current).toMatchObject({mounted: true, visible: true});
  });

  it('with startVisible but closed, stays unmounted and not visible', () => {
    const {result} = renderHook(() => useTransitionPresence(false, {startVisible: true}));

    expect(result.current).toMatchObject({mounted: false, visible: false});
  });

  it('stays mounted after closing until the exit transition ends', () => {
    const {result, rerender} = renderHook(({isOpen}) => useTransitionPresence(isOpen, {startVisible: true}), {
      initialProps: {isOpen: true},
    });

    rerender({isOpen: false});
    expect(result.current).toMatchObject({mounted: true, visible: false});

    act(() => result.current.onTransitionEnd());
    expect(result.current.mounted).toBe(false);
  });
});
