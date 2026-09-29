import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {act, renderHook} from '@testing-library/react';

const STATIC = '/brand/logo-static.svg';
const ANIMATED = '/brand/logo-animated.svg';

// The hook remembers a completed swap at module level, so each test loads a fresh copy.
async function loadHook() {
  vi.resetModules();
  return (await import('../useHeroLogoSrc')).useHeroLogoSrc;
}

// A prefers-reduced-motion query the test can flip mid-session: the returned setter updates
// `matches` and notifies the hook's change subscription, like the OS setting changing.
function mockReducedMotion(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_type: string, onChange: () => void) => listeners.add(onChange),
      removeEventListener: (_type: string, onChange: () => void) => listeners.delete(onChange),
    })),
  );
  return (reduce: boolean) => {
    matches = reduce;
    listeners.forEach((onChange) => onChange());
  };
}

describe('useHeroLogoSrc', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the static logo until the page has loaded, then swaps once idle', async () => {
    const useHeroLogoSrc = await loadHook();
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const {result} = renderHook(() => useHeroLogoSrc());

    act(() => vi.runAllTimers());
    expect(result.current).toBe(STATIC);

    act(() => {
      window.dispatchEvent(new Event('load'));
      vi.runAllTimers();
    });
    expect(result.current).toBe(ANIMATED);
  });

  it('swaps without waiting for an event when the page has already loaded', async () => {
    const useHeroLogoSrc = await loadHook();
    const {result} = renderHook(() => useHeroLogoSrc());
    expect(result.current).toBe(STATIC);

    act(() => vi.runAllTimers());
    expect(result.current).toBe(ANIMATED);
  });

  it('never swaps when the visitor prefers reduced motion', async () => {
    mockReducedMotion(true);
    const useHeroLogoSrc = await loadHook();
    const {result} = renderHook(() => useHeroLogoSrc());

    act(() => vi.runAllTimers());
    expect(result.current).toBe(STATIC);
  });

  it('cancels a pending swap when reduced motion turns on before it fires', async () => {
    const setReduce = mockReducedMotion(false);
    const useHeroLogoSrc = await loadHook();
    const {result} = renderHook(() => useHeroLogoSrc());
    expect(vi.getTimerCount()).toBe(1);

    act(() => setReduce(true));
    expect(vi.getTimerCount()).toBe(0);
    expect(result.current).toBe(STATIC);
  });

  it('puts the static logo back when reduced motion turns on after the swap', async () => {
    const setReduce = mockReducedMotion(false);
    const useHeroLogoSrc = await loadHook();
    const {result} = renderHook(() => useHeroLogoSrc());
    act(() => vi.runAllTimers());
    expect(result.current).toBe(ANIMATED);

    act(() => setReduce(true));
    expect(result.current).toBe(STATIC);
  });

  it('cancels a pending swap on unmount', async () => {
    const useHeroLogoSrc = await loadHook();
    const {unmount} = renderHook(() => useHeroLogoSrc());
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts a later mount on the animated logo once the swap has happened', async () => {
    const useHeroLogoSrc = await loadHook();
    const first = renderHook(() => useHeroLogoSrc());
    act(() => vi.runAllTimers());
    first.unmount();

    const {result} = renderHook(() => useHeroLogoSrc());
    expect(result.current).toBe(ANIMATED);
  });
});
