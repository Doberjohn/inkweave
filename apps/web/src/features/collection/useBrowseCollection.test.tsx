import type {ReactNode} from 'react';
import {beforeEach, describe, it, expect, vi} from 'vitest';
import {act, fireEvent, render, renderHook, screen} from '@testing-library/react';
import {MemoryRouter, useSearchParams} from 'react-router-dom';
import {trackEvent} from '../../shared/lib/analytics';
import {useBinderParams, useBrowseCollection} from './useBrowseCollection';

// Who presses Collection, for useBrowseCollection's own cases; useBinderParams reads none of it.
const {account} = vi.hoisted(() => ({account: {signedIn: true, hasCollection: true, syncing: false}}));

vi.mock('../../shared/contexts/SessionContext', () => ({
  useSession: () => ({user: account.signedIn ? {id: 'user-1'} : null, loading: false}),
}));
vi.mock('./CollectionContext', () => ({
  useCollection: () => ({
    entries: {},
    hasCollection: account.hasCollection,
    syncing: account.syncing,
    importCollection: () => null,
    setCount: () => {},
  }),
}));
vi.mock('./CollectionCardsContext', () => ({
  useCollectionCards: () => ({retry: () => {}}),
  useCollectionPool: () => ({pool: [], waiting: false, error: null, isReady: true}),
}));
vi.mock('../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));

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

describe('useBrowseCollection analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    account.signedIn = true;
    account.hasCollection = true;
    account.syncing = false;
  });

  /** Browse's Collection switch, as the toolbar renders it. */
  function CollectionSwitch() {
    return <>{useBrowseCollection([]).modeSwitch}</>;
  }

  /** The switch on /browse. Returns the account's answer, which ends the sync and re-renders. */
  function renderSwitch() {
    const page = () => (
      <MemoryRouter initialEntries={['/browse']}>
        <CollectionSwitch />
      </MemoryRouter>
    );
    const {rerender} = render(page());
    return (hasCollection: boolean) => {
      account.syncing = false;
      account.hasCollection = hasCollection;
      rerender(page());
    };
  }

  function pressCollection() {
    fireEvent.click(screen.getByRole('button', {name: 'Show my collection'}));
  }

  it('sends the new state each time the switch turns collection mode on or off', () => {
    renderSwitch();
    pressCollection();
    pressCollection();

    expect(vi.mocked(trackEvent).mock.calls).toEqual([
      ['collection_mode_toggled', {state: 'on'}],
      ['collection_mode_toggled', {state: 'off'}],
    ]);
  });

  // The click opens sign-in or the import instead: #882 and the import events cover those.
  it.each([
    {who: 'signed out', signedIn: false, hasCollection: false},
    {who: 'signed in with no collection', signedIn: true, hasCollection: false},
  ])('sends no toggle for a click $who', ({signedIn, hasCollection}) => {
    account.signedIn = signedIn;
    account.hasCollection = hasCollection;
    renderSwitch();
    pressCollection();

    expect(trackEvent).not.toHaveBeenCalled();
  });

  // useCollectionClick's 'wait': signed in, nothing in this browser, the account not answered yet.
  describe('a click that waits on the account', () => {
    beforeEach(() => {
      account.hasCollection = false;
      account.syncing = true;
    });

    it('sends on once the account answers with a collection', () => {
      const answer = renderSwitch();
      pressCollection();
      expect(trackEvent).not.toHaveBeenCalled();

      answer(true);
      expect(vi.mocked(trackEvent).mock.calls).toEqual([['collection_mode_toggled', {state: 'on'}]]);
    });

    it('sends nothing when the account answers with none, since the click offers the import', () => {
      const answer = renderSwitch();
      pressCollection();
      answer(false);

      expect(trackEvent).not.toHaveBeenCalled();
    });

    it('sends nothing when a second click withdraws it before the answer', () => {
      const answer = renderSwitch();
      pressCollection();
      pressCollection();
      answer(true);

      expect(trackEvent).not.toHaveBeenCalled();
    });
  });
});
