import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  SEND_FAILED,
  acceptFriendRequest,
  claimFriendCode,
  listFriendIdentities,
  listFriendships,
  removeFriendship,
  sendFriendRequest,
} from './friendRepository';

// A Supabase double, as profileRepository.test.ts builds it. Stubbed rather than left to
// the real client: .env.local puts real credentials in scope under vitest, so an unmocked
// provider would build an actual client and talk to the real project.
const mockRpc = vi.hoisted(() => vi.fn());
const mockFriendships = vi.hoisted(() => vi.fn());
const mockProfilesIn = vi.hoisted(() => vi.fn());
const mockDeleteEq = vi.hoisted(() => vi.fn());
const mockState = vi.hoisted(() => ({client: null as unknown}));

vi.mock('../../shared/lib/supabase', () => ({
  isSupabaseConfigured: () => mockState.client !== null,
  loadSupabase: () => Promise.resolve(mockState.client),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockState.client = {
    rpc: mockRpc,
    from: (table: string) => ({
      select: () => (table === 'profiles' ? {in: mockProfilesIn} : mockFriendships()),
      // Records both filters, so a delete that lost one can't pass as scoped.
      delete: () => ({
        eq: (column: string, value: string) => ({
          eq: (column2: string, value2: string) => {
            mockDeleteEq({[column]: value, [column2]: value2});
            return Promise.resolve({data: null, error: null});
          },
        }),
      }),
    }),
  };
});

describe('claimFriendCode', () => {
  it('returns the code the RPC makes or finds', async () => {
    mockRpc.mockResolvedValue({data: 'ABCD2345', error: null});
    await expect(claimFriendCode()).resolves.toEqual({data: 'ABCD2345', error: null});
    expect(mockRpc).toHaveBeenCalledWith('claim_friend_code');
  });

  it('degrades to NOT_CONFIGURED without calling anything', async () => {
    mockState.client = null;
    await expect(claimFriendCode()).resolves.toEqual({data: null, error: 'Supabase not configured'});
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('sendFriendRequest', () => {
  it.each(['pending', 'accepted'])('returns the friend and the pair %s', async (status) => {
    mockRpc.mockResolvedValue({data: [{friend_id: 'friend-1', status}], error: null});
    await expect(sendFriendRequest('ABCD2345')).resolves.toEqual({
      data: {friendId: 'friend-1', status},
      error: null,
      answer: status,
    });
    expect(mockRpc).toHaveBeenCalledWith('send_friend_request', {friend_code: 'ABCD2345'});
  });

  // Refusals are answers, not errors (#852): each gets its words and names itself as the
  // answer the friends events send, and nothing is logged.
  it.each([
    ['invalid', 'A friend code is 8 letters and numbers, like ABCD-2345.'],
    ['unknown', 'No one has that friend code. Check it with your friend.'],
    ['own', "That's your own friend code."],
    ['too_many', 'You have 20 requests waiting. Cancel one to send another.'],
    ['slow_down', "You've entered a lot of codes. Try again in an hour."],
  ])('turns %s into its message without logging', async (status, message) => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRpc.mockResolvedValue({data: [{friend_id: null, status}], error: null});
    await expect(sendFriendRequest('ABCD2345')).resolves.toEqual({data: null, error: message, answer: status});
    expect(logged).not.toHaveBeenCalled();
  });

  it('answers failed, and logs, for an answer of any other shape', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRpc.mockResolvedValue({data: [{friend_id: null, status: 'surprise'}], error: null});
    await expect(sendFriendRequest('ABCD2345')).resolves.toEqual({data: null, error: SEND_FAILED, answer: 'failed'});
    expect(logged).toHaveBeenCalled();
  });

  it('reports a raised error with the generic message, and logs it', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRpc.mockResolvedValue({data: null, error: {message: 'could not send the request'}});
    await expect(sendFriendRequest('ABCD2345')).resolves.toEqual({data: null, error: SEND_FAILED, answer: 'failed'});
    expect(logged).toHaveBeenCalled();
  });

  it('degrades to a network error when the request rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRpc.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(sendFriendRequest('ABCD2345')).resolves.toEqual({data: null, error: 'Network error', answer: 'failed'});
  });
});

describe('acceptFriendRequest', () => {
  it('names the requester and returns whether a request was accepted', async () => {
    mockRpc.mockResolvedValue({data: false, error: null});
    await expect(acceptFriendRequest('friend-1')).resolves.toEqual({data: false, error: null});
    expect(mockRpc).toHaveBeenCalledWith('accept_friend_request', {requester: 'friend-1'});
  });
});

describe('listFriendships', () => {
  it('reads every row the player is in, in camelCase', async () => {
    mockFriendships.mockResolvedValue({
      data: [
        {
          requester_id: 'me',
          addressee_id: 'friend-1',
          status: 'accepted',
          created_at: '2026-10-20T10:00:00Z',
          accepted_at: '2026-10-20T11:00:00Z',
        },
      ],
      error: null,
    });
    await expect(listFriendships()).resolves.toEqual({
      data: [
        {
          requesterId: 'me',
          addresseeId: 'friend-1',
          status: 'accepted',
          createdAt: '2026-10-20T10:00:00Z',
          acceptedAt: '2026-10-20T11:00:00Z',
        },
      ],
      error: null,
    });
  });
});

describe('removeFriendship', () => {
  // Decline, cancel and remove are all the pair's row going away. A delete that matched
  // nothing (the other side removed it first) is still done.
  it('deletes the one row the pair names', async () => {
    await expect(removeFriendship({requesterId: 'me', addresseeId: 'friend-1'})).resolves.toEqual({
      data: null,
      error: null,
    });
    expect(mockDeleteEq).toHaveBeenCalledWith({requester_id: 'me', addressee_id: 'friend-1'});
  });
});

describe('listFriendIdentities', () => {
  it('names each friend, leaving out an account with no public name', async () => {
    mockProfilesIn.mockResolvedValue({
      data: [
        {id: 'a', handle: 'ruby_hero_042', display_name: 'Ruby Hero 042'},
        {id: 'b', handle: null, display_name: null},
      ],
      error: null,
    });
    const {data} = await listFriendIdentities(['a', 'b', 'a']);
    expect(data?.get('a')).toEqual({handle: 'ruby_hero_042', displayName: 'Ruby Hero 042'});
    expect(data?.has('b')).toBe(false);
    expect(mockProfilesIn).toHaveBeenCalledWith('id', ['a', 'b']);
  });

  it('makes no request for an empty list', async () => {
    await expect(listFriendIdentities([])).resolves.toEqual({data: new Map(), error: null});
    expect(mockProfilesIn).not.toHaveBeenCalled();
  });
});
