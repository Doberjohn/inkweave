import type {ReactNode} from 'react';
import {beforeEach, describe, it, expect, vi} from 'vitest';
import {act, fireEvent, render, renderHook, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter, useSearchParams} from 'react-router-dom';
import {trackEvent} from '../../shared/lib/analytics';
import {createCard} from '../../shared/test-utils';
import {forgetFriendCollections} from './useFriendCollection';
import {
  useBinderParams,
  useBrowseCollection,
  type BrowseListing,
  type PhoneSheetOptions,
} from './useBrowseCollection';
// The binder's chunk, which the Binder sheet's numbers come from, imported with this file: a cold
// import inside a test can outlast its wait (#712).
import './CollectionBinderSection';

// Who presses Collection, for useBrowseCollection's own cases; useBinderParams reads none of it.
const {account} = vi.hoisted(() => ({
  account: {
    signedIn: true,
    hasCollection: true,
    syncing: false,
    entries: {} as Record<string, {normal: number; foil: number}>,
  },
}));

vi.mock('../../shared/contexts/SessionContext', () => ({
  useSession: () => ({user: account.signedIn ? {id: 'user-1'} : null, loading: false}),
}));
vi.mock('./CollectionContext', () => ({
  useCollection: () => ({
    entries: account.entries,
    hasCollection: account.hasCollection,
    syncing: account.syncing,
    importCollection: () => null,
    setCount: () => {},
    place: (entries: unknown) => entries,
  }),
}));
vi.mock('./CollectionCardsContext', () => ({
  useCollectionCards: () => ({retry: () => {}}),
  useCollectionPool: () => ({pool: [], waiting: false, error: null, isReady: true}),
}));
vi.mock('../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));
// A friend's binder's reads (#1045): Ruby shares, and anyone else named is no one.
const friends = vi.hoisted(() => ({
  getPlayerByHandle: vi.fn(),
  getFriendCollection: vi.fn(),
}));
vi.mock('./sharingRepository', () => friends);
// The friends flag, on unless a case turns it off.
const flags = vi.hoisted(() => ({friends: true}));
vi.mock('../friends/flag', () => ({
  get SHOW_FRIENDS() {
    return flags.friends;
  },
}));
beforeEach(() => {
  flags.friends = true;
});

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

  it('writes what the binder shows, All by dropping the param', () => {
    const {result} = renderBinderParams('/browse?binder=14&ink=Amber', COLLECTOR);
    act(() => result.current.writeShow('missing'));
    expect(result.current.search).toBe('binder=14&ink=Amber&owned=missing');
    act(() => result.current.writeShow('all'));
    expect(result.current.search).toBe('binder=14&ink=Amber');
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

  describe("a friend's binder (#1045)", () => {
    const FRIEND_URL = '/browse?binder=14&friend=ruby_hero_042&owned=you-need';

    it('opens for a signed-in reader with no collection, whom their own binder link would refuse', () => {
      const {result} = renderBinderParams(FRIEND_URL, NO_COLLECTION);
      expect(result.current.mode).toEqual({active: true, dead: false, dropsStrays: true});
      expect(result.current.friend).toBe('ruby_hero_042');
      // You need asks of the reader's own collection, which they don't hold.
      expect(result.current.show).toBe('all');
    });

    it('keeps the grid signed out, and the link whole, so signing in opens it', () => {
      const {result} = renderBinderParams(FRIEND_URL, SIGNED_OUT);
      expect(result.current.mode.active).toBe(false);
      expect(result.current.search).toBe('binder=14&friend=ruby_hero_042&owned=you-need');
    });

    it('reads You need for a reader with a collection, and never without a friend', () => {
      expect(renderBinderParams(FRIEND_URL, COLLECTOR).result.current.show).toBe('you-need');
      expect(renderBinderParams('/browse?binder=14&owned=you-need', COLLECTOR).result.current.show).toBe('all');
    });

    it("goes back to the reader's own binder at the same scope, dropping the views only a friend's has", () => {
      const {result} = renderBinderParams(`${FRIEND_URL}&ink=Ruby`, COLLECTOR);
      act(() => result.current.leaveFriend());
      expect(result.current.search).toBe('binder=14&ink=Ruby');
    });

    it('keeps Owned or Missing on the way back', () => {
      const {result} = renderBinderParams('/browse?binder=14&friend=ruby_hero_042&owned=missing', COLLECTOR);
      act(() => result.current.leaveFriend());
      expect(result.current.search).toBe('binder=14&owned=missing');
    });

    it('changes nothing with the friends flag off: no friend, and no view only a friend has', () => {
      flags.friends = false;
      const {result} = renderBinderParams(FRIEND_URL, COLLECTOR);
      expect(result.current.friend).toBeNull();
      expect(result.current.show).toBe('all');
      expect(result.current.mode.active).toBe(true);
    });

    it('names no friend outside the binder, where the param is a stray', () => {
      const {result} = renderBinderParams('/browse?friend=ruby_hero_042&ink=Ruby', COLLECTOR);
      expect(result.current.friend).toBeNull();
      expect(result.current.search).toBe('ink=Ruby');
    });
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

describe("useBrowseCollection's phone row (#969)", () => {
  beforeEach(() => {
    account.signedIn = true;
    account.hasCollection = true;
    account.syncing = false;
  });

  const LISTING: BrowseListing = {cards: [], sortOrder: 'newest', matched: [], filtered: false};

  /** The row the hook draws for a phone, as Browse asks for it, with two things on. */
  function PhoneRow() {
    return <>{useBrowseCollection([]).renderPhoneRow(LISTING, {count: 2, onOpen: () => {}})}</>;
  }

  const renderRow = (url: string) =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <PhoneRow />
      </MemoryRouter>,
    );

  it('draws nothing in grid mode, where the toolbar stays', () => {
    renderRow('/browse');
    expect(screen.queryByTestId('phone-binder-row')).toBeNull();
  });

  it('draws the row in collection mode: Filters with its count, then Collection, on', () => {
    renderRow('/browse?binder=9');
    const row = within(screen.getByTestId('phone-binder-row'));
    expect(row.getByRole('button', {name: 'Filters, 2 on'})).toHaveTextContent(/^Filters2$/);
    expect(row.getByRole('button', {name: 'Show my collection'})).toHaveAttribute('aria-pressed', 'true');
  });
});

describe("useBrowseCollection's Binder sheet (#969)", () => {
  beforeEach(() => {
    account.signedIn = true;
    account.hasCollection = true;
    account.syncing = false;
  });

  const LISTING: BrowseListing = {cards: [], sortOrder: 'newest', matched: [], filtered: false};
  const SHEET: PhoneSheetOptions = {
    isOpen: true,
    onClose: () => {},
    onApply: () => {},
    sortOrder: 'newest',
    inkFilters: [],
    typeFilters: [],
    costFilters: [],
    filters: {},
    uniqueKeywords: [],
    uniqueClassifications: [],
    uniqueRarities: [],
    sets: [],
  };

  /** The sheet the hook draws for a phone, open, as Browse asks for it. */
  function PhoneSheet() {
    return <>{useBrowseCollection([]).renderPhoneSheet(LISTING, SHEET)}</>;
  }

  const renderSheet = (url: string) =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <PhoneSheet />
      </MemoryRouter>,
    );

  it('draws nothing in grid mode, where the filter sheet stays', () => {
    renderSheet('/browse');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("draws the sheet in collection mode, from what the binder shows, the scope's numbers left to the binder's cover", () => {
    renderSheet('/browse?binder=9&owned=missing');
    expect(screen.getByRole('heading', {name: 'Binder'})).toBeInTheDocument();
    const shows = within(screen.getByRole('group', {name: 'Binder shows'}));
    expect(shows.getByRole('button', {pressed: true})).toHaveTextContent('Missing');
    expect(screen.queryByRole('region', {name: 'Collection numbers'})).toBeNull();
  });
});

describe("useBrowseCollection: a friend's binder (#1045)", () => {
  const RUBY = {id: 'ruby', handle: 'ruby_hero_042', name: 'Ruby Hero 042'};
  // Nani comes in both finishes: you hold her normal, Ruby only her foil. Belle is Ruby's alone.
  const nani = createCard({id: 'nani', setCode: '14', rarity: 'Uncommon'});
  const belle = createCard({id: 'belle', setCode: '14', rarity: 'Uncommon'});
  const LISTING: BrowseListing = {cards: [nani, belle], sortOrder: 'newest', matched: [nani, belle], filtered: false};

  beforeEach(() => {
    vi.clearAllMocks();
    forgetFriendCollections();
    account.signedIn = true;
    account.hasCollection = true;
    account.syncing = false;
    account.entries = {nani: {normal: 1, foil: 0}};
    friends.getPlayerByHandle.mockImplementation((handle: string) =>
      Promise.resolve({data: handle === RUBY.handle ? RUBY : null, error: null}),
    );
    friends.getFriendCollection.mockResolvedValue({
      data: {nani: {normal: 0, foil: 1}, belle: {normal: 1, foil: 0}},
      error: null,
    });
  });

  let slots: ReturnType<typeof useBrowseCollection> | null = null;
  /** The hook's slots as Browse draws them on a desktop: the banner, the binder, the actions. */
  function FriendPage() {
    slots = useBrowseCollection([]);
    const [params] = useSearchParams();
    return (
      <>
        {slots.renderBanner(LISTING, false)}
        {slots.renderBinder(LISTING, () => {})}
        <div data-testid="actions">{slots.modeActions}</div>
        <output data-testid="search">{params.toString()}</output>
      </>
    );
  }

  const renderFriend = (url: string) =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <FriendPage />
      </MemoryRouter>,
    );

  it('names the friend, says it is read only, and offers no collection actions', async () => {
    renderFriend('/browse?binder=14&friend=ruby_hero_042');
    expect(await screen.findByRole('heading', {name: "Ruby Hero 042's binder"})).toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.getByTestId('actions')).toBeEmptyDOMElement();
  });

  it.each([
    ['owned', ['nani', 'belle']],
    ['missing', []],
    ['you-need', ['belle']],
    ['they-need', []],
  ])("asks %s of the friend's copies, beside the reader's own", async (show, ids) => {
    renderFriend(`/browse?binder=14&friend=ruby_hero_042&owned=${show}`);
    await screen.findByText('Read only');
    const inView = slots?.inView;
    expect(inView).not.toBeNull();
    expect([nani, belle].filter((card) => inView?.(card)).map((card) => card.id)).toEqual(ids);
  });

  it("goes back to the reader's own binder at the same scope", async () => {
    renderFriend('/browse?binder=14&friend=ruby_hero_042&owned=they-need');
    fireEvent.click(await screen.findByRole('button', {name: /Back to your binder/}));
    expect(screen.getByTestId('search')).toHaveTextContent(/^binder=14$/);
  });

  it('goes back to Browse for a reader with no collection of their own', async () => {
    account.hasCollection = false;
    account.entries = {};
    renderFriend('/browse?binder=14&friend=ruby_hero_042');
    fireEvent.click(await screen.findByRole('button', {name: /Back to browse/}));
    expect(screen.getByTestId('search')).toBeEmptyDOMElement();
  });

  it("says a friend who doesn't share doesn't, in the binder's place, with no panel", async () => {
    friends.getFriendCollection.mockResolvedValue({data: null, error: null});
    renderFriend('/browse?binder=14&friend=ruby_hero_042');
    expect(await screen.findByText("Ruby Hero 042 doesn't share their collection with you.")).toHaveAttribute(
      'role',
      'status',
    );
    expect(slots?.renderSetPanel(LISTING)).toBeUndefined();
  });

  it("opens the reader's own binder for their own handle", async () => {
    friends.getPlayerByHandle.mockResolvedValue({data: {...RUBY, id: 'user-1'}, error: null});
    renderFriend('/browse?binder=14&friend=ruby_hero_042');
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(/^binder=14$/));
  });
});
