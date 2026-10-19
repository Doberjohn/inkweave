import type {ReactNode} from 'react';
import {describe, it, expect} from 'vitest';
import {act, renderHook} from '@testing-library/react';
import {MemoryRouter, useSearchParams} from 'react-router-dom';
import {useBinderParams} from './useBrowseCollection';

type Reader = Parameters<typeof useBinderParams>[0];

const COLLECTOR: Reader = {sessionLoading: false, syncing: false, signedIn: true, hasCollection: true};
const SIGNED_OUT: Reader = {sessionLoading: false, syncing: false, signedIn: false, hasCollection: false};
const RESTORING: Reader = {sessionLoading: true, syncing: false, signedIn: false, hasCollection: false};
/** Signed in with nothing in this browser, the account not answered yet: a click enters at once. */
const AWAITING: Reader = {sessionLoading: false, syncing: true, signedIn: true, hasCollection: false};
/** The account has answered with no collection, so `?binder=` is dead: `useBrowseCollection` drops it. */
const NO_COLLECTION: Reader = {sessionLoading: false, syncing: false, signedIn: true, hasCollection: false};

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
  it('opens the set a set filter names on entering, and drops the filter', () => {
    // Until the account answers, the page drops no strays, so entering drops the filter itself.
    const {result} = renderBinderParams('/browse?set=5,9&ink=Amber', AWAITING);
    act(() => result.current.enterBinder('14', ['14', '9', '5']));
    expect(result.current.search).toBe('ink=Amber&binder=9');
  });

  it("drops the binder and its view on leaving, and keeps the page's filters", () => {
    const {result} = renderBinderParams('/browse?binder=14&owned=missing&ink=Amber', COLLECTOR);
    act(() => result.current.leaveBinder());
    expect(result.current.search).toBe('ink=Amber');
  });

  it("drops the binder's view from the grid, which has no collection to view", () => {
    const {result} = renderBinderParams('/browse?owned=missing&ink=Amber', SIGNED_OUT);
    expect(result.current.search).toBe('ink=Amber');
  });

  it("drops a set filter once the binder is known to be the reader's", () => {
    const {result} = renderBinderParams('/browse?binder=14&set=5', COLLECTOR);
    expect(result.current.search).toBe('binder=14');
  });

  // #790: the strays went by the param, so `?binder=` ate the grid's Set filter.
  it.each([
    {who: 'signed out', reader: SIGNED_OUT},
    {who: 'while the session restores', reader: RESTORING},
    {who: 'signed in with no collection', reader: NO_COLLECTION},
  ])('keeps a Set filter under a binder link, $who', ({reader}) => {
    const {result} = renderBinderParams('/browse?binder=14&set=5', reader);
    expect(result.current.search).toBe('binder=14&set=5');
  });
});
