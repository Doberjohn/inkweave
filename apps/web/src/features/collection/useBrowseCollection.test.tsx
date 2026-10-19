import type {ReactNode} from 'react';
import {describe, it, expect} from 'vitest';
import {renderHook} from '@testing-library/react';
import {MemoryRouter, useSearchParams} from 'react-router-dom';
import {useBinderParams} from './useBrowseCollection';

type Reader = Parameters<typeof useBinderParams>[0];

const COLLECTOR: Reader = {sessionLoading: false, syncing: false, signedIn: true, hasCollection: true};
const SIGNED_OUT: Reader = {sessionLoading: false, syncing: false, signedIn: false, hasCollection: false};
const RESTORING: Reader = {sessionLoading: true, syncing: false, signedIn: false, hasCollection: false};

/** The hook on a page at `url`, with the params as they stand after its effects. */
function renderBinderParams(url: string, reader: Reader) {
  const wrapper = ({children}: {children: ReactNode}) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => {
      const binder = useBinderParams(reader);
      const [params] = useSearchParams();
      return {...binder, search: params.toString()};
    },
    {wrapper},
  );
}

describe('useBinderParams', () => {
  it("drops a set filter once the binder is known to be the reader's", () => {
    const {result} = renderBinderParams('/browse?binder=14&set=5', COLLECTOR);
    expect(result.current.search).toBe('binder=14');
  });

  // #790: the strays went by the param, so `?binder=` ate the grid's Set filter.
  it.each([
    {who: 'signed out', reader: SIGNED_OUT},
    {who: 'while the session restores', reader: RESTORING},
  ])('keeps a Set filter under a binder link, $who', ({reader}) => {
    const {result} = renderBinderParams('/browse?binder=14&set=5', reader);
    expect(result.current.search).toBe('binder=14&set=5');
  });
});
