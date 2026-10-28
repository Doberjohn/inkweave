import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {trackEvent} from '../../shared/lib/analytics';
import {forgetFriendCollections, useFriendCollection} from './useFriendCollection';

vi.mock('../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));
const repo = vi.hoisted(() => ({getPlayerByHandle: vi.fn(), getFriendCollection: vi.fn()}));
vi.mock('./sharingRepository', () => repo);

const RUBY = {id: 'ruby', handle: 'ruby_hero_042', name: 'Ruby Hero 042'};
const ENTRIES = {'card-1': {normal: 2, foil: 1}};

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => state});
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  forgetFriendCollections();
  repo.getPlayerByHandle.mockResolvedValue({data: RUBY, error: null});
  repo.getFriendCollection.mockResolvedValue({data: ENTRIES, error: null});
});

afterEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'visible'});
});

const render = (handle: string | null = RUBY.handle, reader: string | null = 'me') =>
  renderHook(({h, r}) => useFriendCollection(h, r), {initialProps: {h: handle, r: reader}});

describe('useFriendCollection', () => {
  it("loads the friend's collection by handle, and counts the binder opened once", async () => {
    const {result} = render();
    expect(result.current).toEqual({status: 'loading'});
    await waitFor(() => expect(result.current).toEqual({status: 'shown', friend: RUBY, entries: ENTRIES}));
    expect(repo.getFriendCollection).toHaveBeenCalledWith('ruby');
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('friend_binder_opened', {result: 'shown'});
  });

  it('asks nothing with no friend named, or no reader signed in', () => {
    expect(render(null).result.current).toBeNull();
    expect(render(RUBY.handle, null).result.current).toBeNull();
    expect(repo.getPlayerByHandle).not.toHaveBeenCalled();
  });

  it("says a friend who doesn't share doesn't, by name", async () => {
    repo.getFriendCollection.mockResolvedValue({data: null, error: null});
    const {result} = render();
    await waitFor(() =>
      expect(result.current).toEqual({status: 'not-sharing', handle: RUBY.handle, name: 'Ruby Hero 042'}),
    );
    expect(trackEvent).toHaveBeenCalledWith('friend_binder_opened', {result: 'not_sharing'});
  });

  it('says the same for a handle no one has, with no name to give', async () => {
    repo.getPlayerByHandle.mockResolvedValue({data: null, error: null});
    const {result} = render('nobody_here');
    await waitFor(() => expect(result.current).toEqual({status: 'not-sharing', handle: 'nobody_here', name: null}));
    expect(repo.getFriendCollection).not.toHaveBeenCalled();
  });

  it("answers the reader's own handle as their own, and counts no friend's binder", async () => {
    repo.getPlayerByHandle.mockResolvedValue({data: {...RUBY, id: 'me'}, error: null});
    const {result} = render();
    await waitFor(() => expect(result.current).toEqual({status: 'own'}));
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('shows a failed first read, and reads again on retry', async () => {
    repo.getFriendCollection.mockResolvedValueOnce({data: null, error: 'Network error'});
    const {result} = render();
    await waitFor(() => expect(result.current?.status).toBe('failed'));
    expect(trackEvent).toHaveBeenCalledWith('friend_binder_opened', {result: 'failed'});

    act(() => {
      if (result.current?.status === 'failed') result.current.retry();
    });
    expect(result.current).toEqual({status: 'loading'});
    await waitFor(() => expect(result.current?.status).toBe('shown'));
  });

  it('reads again when the tab is shown: a friend who stopped sharing drops out, and the binder counts once', async () => {
    const {result} = render();
    await waitFor(() => expect(result.current?.status).toBe('shown'));

    repo.getFriendCollection.mockResolvedValue({data: null, error: null});
    act(() => setVisibility('hidden'));
    expect(repo.getFriendCollection).toHaveBeenCalledTimes(1);
    act(() => setVisibility('visible'));
    await waitFor(() => expect(result.current?.status).toBe('not-sharing'));
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('keeps the binder on show when a re-read fails', async () => {
    const {result} = render();
    await waitFor(() => expect(result.current?.status).toBe('shown'));

    repo.getFriendCollection.mockResolvedValue({data: null, error: 'Network error'});
    act(() => setVisibility('visible'));
    await waitFor(() => expect(repo.getFriendCollection).toHaveBeenCalledTimes(2));
    expect(result.current?.status).toBe('shown');
  });

  it('opens a binder seen this visit at once, and writes nothing to storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const first = render();
    await waitFor(() => expect(first.result.current?.status).toBe('shown'));
    first.unmount();

    expect(render().result.current).toEqual({status: 'shown', friend: RUBY, entries: ENTRIES});
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
