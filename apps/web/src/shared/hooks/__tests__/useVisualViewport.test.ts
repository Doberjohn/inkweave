import {describe, it, expect, vi, afterEach} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useVisualViewport} from '../useVisualViewport';

/**
 * jsdom has no `visualViewport`, so every test builds one. The fake is a real
 * event target rather than a mock function: the hook's whole job is to stay in
 * sync with an external object that mutates and then emits, and asserting on
 * `addEventListener` calls would prove only that we subscribed, not that we
 * re-read the values afterwards.
 */
function stubVisualViewport({height, offsetTop = 0}: {height: number; offsetTop?: number}) {
  const listeners = new Map<string, Set<() => void>>();
  const vv = {
    height,
    offsetTop,
    addEventListener: vi.fn((type: string, fn: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: () => void) => {
      listeners.get(type)?.delete(fn);
    }),
    /** Mutate the viewport the way a keyboard would, then notify. */
    simulate(next: {height?: number; offsetTop?: number}, type = 'resize') {
      if (next.height !== undefined) vv.height = next.height;
      if (next.offsetTop !== undefined) vv.offsetTop = next.offsetTop;
      listeners.get(type)?.forEach((fn) => fn());
    },
  };
  vi.stubGlobal('visualViewport', vv);
  return vv;
}

describe('useVisualViewport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('falls back to the layout viewport when visualViewport is unsupported', () => {
    vi.stubGlobal('innerHeight', 812);
    vi.stubGlobal('visualViewport', undefined);

    const {result} = renderHook(() => useVisualViewport());

    expect(result.current.height).toBe(812);
    expect(result.current.keyboardInset).toBe(0);
  });

  it('reports the visible band height, not the layout height', () => {
    vi.stubGlobal('innerHeight', 812);
    stubVisualViewport({height: 476});

    const {result} = renderHook(() => useVisualViewport());

    expect(result.current.height).toBe(476);
  });

  it('derives the keyboard inset from the gap below the visible band', () => {
    vi.stubGlobal('innerHeight', 812);
    stubVisualViewport({height: 476});

    const {result} = renderHook(() => useVisualViewport());

    expect(result.current.keyboardInset).toBe(336);
  });

  it('accounts for a scrolled visual viewport when measuring the inset', () => {
    // Pinch-zoom / scroll pushes the visible band down; the occluded strip below
    // it is smaller than the raw height difference by exactly offsetTop.
    vi.stubGlobal('innerHeight', 812);
    stubVisualViewport({height: 476, offsetTop: 40});

    const {result} = renderHook(() => useVisualViewport());

    expect(result.current.keyboardInset).toBe(296);
  });

  it('updates when the keyboard opens', () => {
    vi.stubGlobal('innerHeight', 812);
    const vv = stubVisualViewport({height: 812});

    const {result} = renderHook(() => useVisualViewport());
    expect(result.current.keyboardInset).toBe(0);

    act(() => vv.simulate({height: 476}));

    expect(result.current.height).toBe(476);
    expect(result.current.keyboardInset).toBe(336);
  });

  it('clamps the inset at zero when the visible band exceeds the layout viewport', () => {
    // Android reports this transiently mid-rotation; a negative inset would push
    // the sheet off the bottom of the screen.
    vi.stubGlobal('innerHeight', 812);
    stubVisualViewport({height: 900});

    const {result} = renderHook(() => useVisualViewport());

    expect(result.current.keyboardInset).toBe(0);
  });

  it('does not re-render when an event reports unchanged geometry', () => {
    // `scroll` fires continuously while pinch-zooming. Re-reading is cheap, but
    // handing back a fresh object every time would re-render the whole sheet on
    // every frame of a gesture that changed nothing.
    vi.stubGlobal('innerHeight', 812);
    const vv = stubVisualViewport({height: 812});

    let renders = 0;
    renderHook(() => {
      renders++;
      return useVisualViewport();
    });
    const before = renders;

    act(() => vv.simulate({}, 'scroll'));

    expect(renders).toBe(before);
  });

  it('unsubscribes on unmount', () => {
    vi.stubGlobal('innerHeight', 812);
    const vv = stubVisualViewport({height: 812});

    const {unmount} = renderHook(() => useVisualViewport());
    unmount();

    expect(vv.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(vv.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});
