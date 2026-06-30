import {describe, it, expect} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {MemoryRouter, useSearchParams} from 'react-router-dom';
import type {ReactNode} from 'react';
import {useInkParam, parseInkParam} from '../useInkParam';

function createWrapper(initialEntries: string[] = ['/']) {
  return function Wrapper({children}: {children: ReactNode}) {
    return MemoryRouter({initialEntries, children});
  };
}

// Probe both the parsed ink and the raw `ink` param so the URL contract
// (lowercase write, param deletion on default) is asserted directly.
function useInkParamProbe() {
  const [params] = useSearchParams();
  const [ink, selectInk] = useInkParam();
  return {ink, selectInk, raw: params.get('ink')};
}

describe('parseInkParam', () => {
  it('normalizes a lowercase ink name', () => {
    expect(parseInkParam('emerald')).toBe('Emerald');
  });
  it('is case-insensitive', () => {
    expect(parseInkParam('EMERALD')).toBe('Emerald');
  });
  it('falls back to Amber on an invalid value', () => {
    expect(parseInkParam('teal')).toBe('Amber');
  });
  it('falls back to Amber when missing', () => {
    expect(parseInkParam(null)).toBe('Amber');
  });
});

describe('useInkParam', () => {
  it('reads the starting ink from the URL', () => {
    const {result} = renderHook(() => useInkParamProbe(), {
      wrapper: createWrapper(['/reveals?ink=sapphire']),
    });
    expect(result.current.ink).toBe('Sapphire');
  });

  it('writes the selected ink as a lowercase param', () => {
    const {result} = renderHook(() => useInkParamProbe(), {
      wrapper: createWrapper(['/reveals']),
    });
    act(() => result.current.selectInk('Ruby'));
    expect(result.current.ink).toBe('Ruby');
    expect(result.current.raw).toBe('ruby');
  });

  it('deletes the param when the default (Amber) is selected', () => {
    const {result} = renderHook(() => useInkParamProbe(), {
      wrapper: createWrapper(['/reveals?ink=ruby']),
    });
    act(() => result.current.selectInk('Amber'));
    expect(result.current.ink).toBe('Amber');
    expect(result.current.raw).toBeNull();
  });
});
