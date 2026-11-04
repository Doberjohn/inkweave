import {describe, it, expect} from 'vitest';
import type {ReactNode} from 'react';
import {renderHook} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {resolveSetCode, useBinderParams, type BinderReader} from './useBinderParams';

/** A signed-in collector whose account has answered. */
const READER: BinderReader = {sessionLoading: false, syncing: false, signedIn: true, hasCollection: true, startFailed: false};

function paramsAt(url: string) {
  const wrapper = ({children}: {children: ReactNode}) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
  return renderHook(() => useBinderParams(READER), {wrapper}).result.current;
}

describe('the binder shelf in the params (#1074)', () => {
  it('shows the whole collection on the shelf, so what it hands on is My collection', () => {
    expect(resolveSetCode('shelf', ['12', '11'])).toBe('all');
  });

  it('names no binder of your own, nor a friend, on the shelf, even before it drops them', () => {
    // Every render, the first included: the strays go in an effect, after it.
    const seen: {custom: string | null; friend: string | null}[] = [];
    const wrapper = ({children}: {children: ReactNode}) => (
      <MemoryRouter initialEntries={['/browse?binder=shelf&custom=b1&friend=ruby_hero_042']}>{children}</MemoryRouter>
    );
    const {result} = renderHook(
      () => {
        const params = useBinderParams(READER);
        seen.push({custom: params.custom, friend: params.friend});
        return params;
      },
      {wrapper},
    );
    expect(result.current.onShelf).toBe(true);
    expect(seen).toEqual(seen.map(() => ({custom: null, friend: null})));
  });

  it('names a binder of your own off the shelf', () => {
    expect(paramsAt('/browse?binder=all&custom=b1').custom).toBe('b1');
  });
});
