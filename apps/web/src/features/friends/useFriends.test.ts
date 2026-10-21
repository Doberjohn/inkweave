import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {trackEvent} from '../../shared/lib/analytics';
import type {Friendship} from './friendRepository';
import {useFriends} from './useFriends';

vi.mock('../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));

const repo = vi.hoisted(() => ({
  claimFriendCode: vi.fn(),
  listFriendships: vi.fn(),
  listFriendIdentities: vi.fn(),
  sendFriendRequest: vi.fn(),
  acceptFriendRequest: vi.fn(),
  removeFriendship: vi.fn(),
}));
vi.mock('./friendRepository', async () => ({
  ...(await vi.importActual('./friendRepository')),
  ...repo,
}));

const ME = 'me';
const row = (requesterId: string, addresseeId: string, status: Friendship['status'], at: string): Friendship => ({
  requesterId,
  addresseeId,
  status,
  createdAt: at,
  acceptedAt: status === 'accepted' ? at : null,
});
const NAMES = new Map([
  ['ruby', {handle: 'ruby_hero_042', displayName: 'Ruby Hero 042'}],
  ['steel', {handle: 'steel_pirate_777', displayName: 'Steel Pirate 777'}],
  ['amber', {handle: 'amber_toy_115', displayName: 'Amber Toy 115'}],
]);

function serve(rows: Friendship[]) {
  repo.listFriendships.mockResolvedValue({data: rows, error: null});
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => state});
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.clearAllMocks();
  repo.claimFriendCode.mockResolvedValue({data: 'ABCD2345', error: null});
  repo.listFriendIdentities.mockResolvedValue({data: NAMES, error: null});
  serve([
    row('ruby', ME, 'pending', '2026-10-20T10:00:00Z'),
    row(ME, 'steel', 'pending', '2026-10-20T11:00:00Z'),
    row(ME, 'amber', 'accepted', '2026-10-19T09:00:00Z'),
    row('ghost', ME, 'accepted', '2026-10-20T12:00:00Z'),
  ]);
});

// Reset without an event, so no hook still mounted at this point reloads after its test.
afterEach(() => {
  Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'visible'});
});

async function loaded() {
  const hook = renderHook(() => useFriends(ME));
  await waitFor(() => expect(hook.result.current.status).toBe('ready'));
  return hook;
}

describe('useFriends', () => {
  it('splits the rows into received, sent and friends, newest friend first', async () => {
    const {result} = await loaded();
    expect(result.current.code).toBe('ABCD2345');
    expect(result.current.received.map((r) => r.name)).toEqual(['Ruby Hero 042']);
    expect(result.current.sent.map((r) => r.name)).toEqual(['Steel Pirate 777']);
    // An account with no public name yet still shows, under a placeholder.
    expect(result.current.friends.map((r) => r.name)).toEqual(['Inkweave player', 'Amber Toy 115']);
    expect(repo.listFriendIdentities).toHaveBeenCalledWith(['ruby', 'steel', 'amber', 'ghost']);
  });

  it('reports a failed load and loads again on retry', async () => {
    repo.claimFriendCode.mockResolvedValueOnce({data: null, error: 'Network error'});
    const {result} = renderHook(() => useFriends(ME));
    await waitFor(() => expect(result.current.status).toBe('failed'));

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it.each([
    ['pending', 'Request sent to Steel Pirate 777.'],
    ['accepted', 'You and Steel Pirate 777 are now friends.'],
  ])('reports a %s send after reloading the lists, and tracks the answer', async (status, message) => {
    const {result} = await loaded();
    repo.sendFriendRequest.mockResolvedValue({data: {friendId: 'steel', status}, error: null, answer: status});

    let outcome;
    await act(async () => {
      outcome = await result.current.send('M3PZ8RQT');
    });

    expect(outcome).toEqual({ok: true, message});
    expect(repo.sendFriendRequest).toHaveBeenCalledWith('M3PZ8RQT');
    expect(repo.listFriendships).toHaveBeenCalledTimes(2);
    expect(trackEvent).toHaveBeenCalledWith('friend_request_sent', {result: status});
  });

  it('returns a refusal, tracks it, and leaves the lists as they were', async () => {
    const {result} = await loaded();
    repo.sendFriendRequest.mockResolvedValue({data: null, error: "That's your own friend code.", answer: 'own'});

    let outcome;
    await act(async () => {
      outcome = await result.current.send('ABCD2345');
    });

    expect(outcome).toEqual({ok: false, message: "That's your own friend code."});
    expect(repo.listFriendships).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('friend_request_sent', {result: 'own'});
  });

  it('says so when the request it accepted was already gone', async () => {
    const {result} = await loaded();
    repo.acceptFriendRequest.mockResolvedValue({data: false, error: null});

    let message;
    await act(async () => {
      message = await result.current.accept(result.current.received[0]);
    });

    expect(repo.acceptFriendRequest).toHaveBeenCalledWith('ruby');
    expect(message).toBe('That request is no longer there.');
    expect(repo.listFriendships).toHaveBeenCalledTimes(2);
  });

  it('removes the row by its pair and reloads', async () => {
    const {result} = await loaded();
    repo.removeFriendship.mockResolvedValue({data: null, error: null});

    await act(async () => {
      await result.current.remove(result.current.sent[0]);
    });

    expect(repo.removeFriendship).toHaveBeenCalledWith({requesterId: ME, addresseeId: 'steel'});
    expect(repo.listFriendships).toHaveBeenCalledTimes(2);
  });

  it('is busy while an action runs', async () => {
    const {result} = await loaded();
    let finish: (value: unknown) => void = () => {};
    repo.removeFriendship.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.remove(result.current.friends[0]);
    });
    expect(result.current.busy).toBe(true);

    await act(async () => {
      finish({data: null, error: null});
      await pending;
    });
    expect(result.current.busy).toBe(false);
  });

  it('reloads when the page is shown again even while an action runs', async () => {
    const {result} = await loaded();
    // An action that never settles holds `busy` for the rest of the test.
    repo.removeFriendship.mockReturnValue(new Promise(() => {}));
    act(() => {
      void result.current.remove(result.current.friends[0]);
    });
    expect(result.current.busy).toBe(true);

    setVisibility('visible');
    await waitFor(() => expect(repo.listFriendships).toHaveBeenCalledTimes(2));
  });

  it('reloads when the page is shown again, and not when it is hidden', async () => {
    await loaded();

    setVisibility('hidden');
    expect(repo.listFriendships).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    await waitFor(() => expect(repo.listFriendships).toHaveBeenCalledTimes(2));
  });
});
