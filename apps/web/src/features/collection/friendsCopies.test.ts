import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {forgetFriendsCopies, useFriendsCopies} from './friendsCopies';

const session = vi.hoisted(() => ({user: {id: 'me'} as {id: string} | null}));
vi.mock('../../shared/contexts/SessionContext', () => ({useSession: () => session}));
const friends = vi.hoisted(() => ({listFriendships: vi.fn(), listSharingFriends: vi.fn(), listFriendIdentities: vi.fn()}));
vi.mock('../friends/friendRepository', async (actual) => ({...(await actual<object>()), ...friends}));
const sharing = vi.hoisted(() => ({getSharedCollections: vi.fn()}));
vi.mock('./sharingRepository', () => sharing);

const RUBY_COPIES = {'card-1': {normal: 0, foil: 1}};
const accepted = (other: string, reader = 'me') => ({
  requesterId: other,
  addresseeId: reader,
  status: 'accepted',
  createdAt: '2026-10-20T10:00:00Z',
  acceptedAt: '2026-10-20T10:00:00Z',
});
const NAMES = new Map([
  ['ruby', {handle: 'ruby_hero_042', displayName: 'Ruby Hero 042'}],
  ['amber', {handle: 'amber_toy_115', displayName: 'Amber Toy 115'}],
]);
const RUBY = {id: 'ruby', name: 'Ruby Hero 042', handle: 'ruby_hero_042'};
const AMBER = {id: 'amber', name: 'Amber Toy 115', handle: 'amber_toy_115'};

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => state});
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  forgetFriendsCopies();
  session.user = {id: 'me'};
  friends.listFriendships.mockResolvedValue({data: [accepted('ruby'), accepted('amber')], error: null});
  friends.listSharingFriends.mockResolvedValue({data: new Set(['ruby']), error: null});
  friends.listFriendIdentities.mockResolvedValue({data: NAMES, error: null});
  sharing.getSharedCollections.mockResolvedValue({data: new Map([['ruby', RUBY_COPIES]]), error: null});
});

afterEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'visible'});
});

const render = (enabled = true, need = true) =>
  renderHook(({e, n}) => useFriendsCopies(e, n), {initialProps: {e: enabled, n: need}});

const READY = {status: 'ready', sharing: [{...RUBY, entries: RUBY_COPIES}], notSharing: [AMBER]};

describe('useFriendsCopies', () => {
  it("reads the friends and the sharing ones' copies once something needs them", async () => {
    const {result, rerender} = render(true, false);
    expect(result.current).toEqual({status: 'idle'});
    expect(friends.listFriendships).not.toHaveBeenCalled();

    rerender({e: true, n: true});
    expect(result.current).toEqual({status: 'loading'});
    await waitFor(() => expect(result.current).toEqual(READY));
    expect(friends.listFriendIdentities).toHaveBeenCalledWith(['ruby', 'amber']);
  });

  it('asks nothing while not enabled', () => {
    const {result} = render(false, true);
    expect(result.current).toEqual({status: 'idle'});
    expect(friends.listFriendships).not.toHaveBeenCalled();
  });

  it('reads no collection when no friend shares', async () => {
    friends.listSharingFriends.mockResolvedValue({data: new Set(), error: null});
    const {result} = render();
    await waitFor(() => expect(result.current).toEqual({status: 'ready', sharing: [], notSharing: [RUBY, AMBER]}));
    expect(sharing.getSharedCollections).not.toHaveBeenCalled();
  });

  it('counts only accepted friendships, whichever side sent them', async () => {
    friends.listFriendships.mockResolvedValue({
      data: [{...accepted('me', 'ruby')}, {...accepted('amber'), status: 'pending'}],
      error: null,
    });
    const {result} = render();
    await waitFor(() => expect(result.current).toEqual({status: 'ready', sharing: [{...RUBY, entries: RUBY_COPIES}], notSharing: []}));
  });

  it('shows a friend with no public name as unnamed, with no binder to link', async () => {
    friends.listFriendIdentities.mockResolvedValue({data: null, error: 'boom'});
    const {result} = render();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({sharing: [{id: 'ruby', name: 'Inkweave player', handle: null}]});
  });

  it('shows a failed first read, and reads again on retry', async () => {
    sharing.getSharedCollections.mockResolvedValueOnce({data: null, error: 'boom'});
    const {result} = render();
    await waitFor(() => expect(result.current.status).toBe('failed'));

    act(() => {
      if (result.current.status === 'failed') result.current.retry();
    });
    expect(result.current).toEqual({status: 'loading'});
    await waitFor(() => expect(result.current).toEqual(READY));
  });

  it('reads again when the tab is shown, so a friend who stopped sharing drops out', async () => {
    const {result} = render();
    await waitFor(() => expect(result.current).toEqual(READY));

    friends.listSharingFriends.mockResolvedValue({data: new Set(), error: null});
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    await waitFor(() => expect(result.current).toEqual({status: 'ready', sharing: [], notSharing: [RUBY, AMBER]}));
    expect(friends.listFriendships).toHaveBeenCalledTimes(2);
  });

  it('keeps the copies on show when a re-read fails', async () => {
    const {result} = render();
    await waitFor(() => expect(result.current).toEqual(READY));

    friends.listFriendships.mockResolvedValue({data: null, error: 'boom'});
    act(() => setVisibility('visible'));
    await waitFor(() => expect(friends.listFriendships).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(result.current).toEqual(READY);
  });

  it('shares one read between everything that needs it', async () => {
    const first = render();
    const second = render();
    await waitFor(() => expect(second.result.current).toEqual(READY));
    expect(first.result.current).toEqual(READY);
    expect(friends.listFriendships).toHaveBeenCalledTimes(1);
  });

  it('stops reading on a shown tab once nothing needs the copies', async () => {
    const {result, unmount} = render();
    await waitFor(() => expect(result.current).toEqual(READY));
    unmount();
    act(() => setVisibility('visible'));
    expect(friends.listFriendships).toHaveBeenCalledTimes(1);
  });

  it("shows another account none of the last reader's copies, and reads its own", async () => {
    const {result, rerender} = render();
    await waitFor(() => expect(result.current).toEqual(READY));

    session.user = {id: 'other'};
    friends.listFriendships.mockResolvedValue({data: [accepted('amber', 'other')], error: null});
    rerender({e: true, n: true});
    expect(result.current).toEqual({status: 'loading'});
    await waitFor(() => expect(result.current).toEqual({status: 'ready', sharing: [], notSharing: [AMBER]}));
    expect(friends.listFriendships).toHaveBeenCalledTimes(2);
  });
});
