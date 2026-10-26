import {describe, it, expect} from 'vitest';
import {renderHook} from '@testing-library/react';
import {useLoneFit} from './useLoneFit';

/** A section laid out `width` by `height`, 8px of padding at its sides and 4px under it, as a phone's is. */
function section(width: number, height: number) {
  const box = document.createElement('div');
  box.style.padding = '0 8px 4px';
  Object.defineProperty(box, 'offsetWidth', {value: width});
  Object.defineProperty(box, 'clientHeight', {value: height});
  return box;
}

describe('useLoneFit (#1000)', () => {
  it("fits four rows on a tall phone's section, before the first paint", () => {
    // Room 378 by 900 inside the padding: four rows, as wide as the room.
    const {result} = renderHook(() => useLoneFit(section(394, 904), true));
    expect(result.current.rows).toBe(4);
  });

  it("keeps three rows on a short phone's section", () => {
    const {result} = renderHook(() => useLoneFit(section(394, 587), true));
    expect(result.current).toEqual({rows: 3});
  });

  it('keeps three rows off a phone, and while the section has no size yet', () => {
    expect(renderHook(() => useLoneFit(section(394, 904), false)).result.current).toEqual({rows: 3});
    expect(renderHook(() => useLoneFit(section(0, 0), true)).result.current).toEqual({rows: 3});
  });

  it('measures a section that mounts after the first render, and one that replaces it', () => {
    // The error state draws no section, and Try again mounts one; a short phone's box can also
    // give way to a tall one.
    const {result, rerender} = renderHook(({box}) => useLoneFit(box, true), {
      initialProps: {box: null as HTMLElement | null},
    });
    expect(result.current).toEqual({rows: 3});
    rerender({box: section(394, 587)});
    expect(result.current).toEqual({rows: 3});
    rerender({box: section(394, 904)});
    expect(result.current.rows).toBe(4);
  });
});
