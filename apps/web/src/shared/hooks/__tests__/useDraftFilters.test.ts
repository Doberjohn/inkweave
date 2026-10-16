import {describe, it, expect} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useDraftFilters} from '../useDraftFilters';

const committed = {isOpen: true, inkFilters: [], typeFilters: [], costFilters: [], filters: {}};

describe('useDraftFilters', () => {
  it('drops the Dual-ink cards switch once the inks stop offering it, so it cannot come back lit', () => {
    const {result} = renderHook(() => useDraftFilters(committed));
    act(() => result.current.toggleInk('Amber'));
    act(() => result.current.updateFilters({...result.current.draftFilters, inkMatch: 'dual'}));
    act(() => result.current.toggleInk('Amber')); // no inks: nothing to be dual within
    act(() => result.current.toggleInk('Steel'));
    expect(result.current.draftInks).toEqual(['Steel']);
    expect(result.current.draftFilters.inkMatch).toBeUndefined();
  });

  it('keeps the switch while the inks still offer it, one ink becoming a pair', () => {
    const {result} = renderHook(() => useDraftFilters(committed));
    act(() => result.current.toggleInk('Amber'));
    act(() => result.current.updateFilters({inkMatch: 'dual'}));
    act(() => result.current.toggleInk('Steel'));
    expect(result.current.draftFilters.inkMatch).toBe('dual');
  });
});
