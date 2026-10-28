import {beforeEach, describe, expect, it, vi} from 'vitest';
import {getFriendCollection, getPlayerByHandle, getSharing, setSharing} from './sharingRepository';

// A Supabase double, as friendRepository.test.ts builds it: .env.local puts real credentials in
// scope under vitest, so an unmocked provider would talk to the real project.
const mockRpc = vi.hoisted(() => vi.fn());
const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());
const mockState = vi.hoisted(() => ({client: null as unknown}));

vi.mock('../../shared/lib/supabase', () => ({
  loadSupabase: () => Promise.resolve(mockState.client),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mockState.client = {
    rpc: mockRpc,
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => {
          mockEq({table, columns, [column]: value});
          return {maybeSingle: mockMaybeSingle};
        },
      }),
      upsert: (row: unknown, options: unknown) => mockUpsert(table, row, options),
    }),
  };
});

const FRIEND = 'friend-1';
const ENTRIES = {'card-1': {normal: 2, foil: 1}};

describe('getSharing', () => {
  it('reads the switch from the caller’s own row', async () => {
    mockMaybeSingle.mockResolvedValue({data: {friends: true}, error: null});
    await expect(getSharing('me')).resolves.toEqual({data: true, error: null});
    expect(mockEq).toHaveBeenCalledWith({table: 'collection_sharing', columns: 'friends', owner_id: 'me'});
  });

  it('reads no row as off', async () => {
    mockMaybeSingle.mockResolvedValue({data: null, error: null});
    await expect(getSharing('me')).resolves.toEqual({data: false, error: null});
  });

  it('passes a failed read on as an error, never as off', async () => {
    mockMaybeSingle.mockResolvedValue({data: null, error: {message: 'boom'}});
    await expect(getSharing('me')).resolves.toEqual({data: null, error: 'boom'});
  });
});

describe('setSharing', () => {
  it('upserts the two granted columns on the owner', async () => {
    mockUpsert.mockResolvedValue({error: null});
    await expect(setSharing('me', true)).resolves.toEqual({data: null, error: null});
    expect(mockUpsert).toHaveBeenCalledWith('collection_sharing', {owner_id: 'me', friends: true}, {onConflict: 'owner_id'});
  });

  it('degrades to NOT_CONFIGURED without a client', async () => {
    mockState.client = null;
    await expect(setSharing('me', false)).resolves.toEqual({data: null, error: 'Supabase not configured'});
  });
});

describe('getFriendCollection', () => {
  it("returns the friend's entries from their row", async () => {
    mockRpc.mockResolvedValue({data: [{owner_id: FRIEND, entries: ENTRIES, schema_version: 1}], error: null});
    await expect(getFriendCollection(FRIEND)).resolves.toEqual({data: ENTRIES, error: null});
    expect(mockRpc).toHaveBeenCalledWith('friend_collections', {only_friend: FRIEND});
  });

  it('reads no row as not sharing, which tells a stranger nothing', async () => {
    mockRpc.mockResolvedValue({data: [], error: null});
    await expect(getFriendCollection(FRIEND)).resolves.toEqual({data: null, error: null});
  });

  it('takes no one else’s row for the friend’s', async () => {
    mockRpc.mockResolvedValue({data: [{owner_id: 'someone-else', entries: ENTRIES, schema_version: 1}], error: null});
    await expect(getFriendCollection(FRIEND)).resolves.toEqual({data: null, error: null});
  });

  it.each([
    ['a schema it does not know', {entries: ENTRIES, schema_version: 2}],
    ['entries that are not copy counts', {entries: {'card-1': {normal: 'two', foil: 0}}, schema_version: 1}],
  ])('refuses %s as an error, never an empty binder', async (_case, row) => {
    mockRpc.mockResolvedValue({data: [{owner_id: FRIEND, ...row}], error: null});
    const result = await getFriendCollection(FRIEND);
    expect(result.data).toBeNull();
    expect(result.error).toMatch(/unusable friend collection/);
  });
});

describe('getPlayerByHandle', () => {
  it('finds a player by their handle, lowercased', async () => {
    mockMaybeSingle.mockResolvedValue({data: {id: FRIEND, handle: 'ruby_hero_042', display_name: 'Ruby Hero 042'}, error: null});
    await expect(getPlayerByHandle('Ruby_Hero_042')).resolves.toEqual({
      data: {id: FRIEND, handle: 'ruby_hero_042', name: 'Ruby Hero 042'},
      error: null,
    });
    expect(mockEq).toHaveBeenCalledWith({table: 'profiles', columns: 'id, handle, display_name', handle: 'ruby_hero_042'});
  });

  it('answers no one for a handle no one has', async () => {
    mockMaybeSingle.mockResolvedValue({data: null, error: null});
    await expect(getPlayerByHandle('nobody_here')).resolves.toEqual({data: null, error: null});
  });

  it('asks nothing for text that cannot be a handle', async () => {
    await expect(getPlayerByHandle('a,b) or (true')).resolves.toEqual({data: null, error: null});
    expect(mockEq).not.toHaveBeenCalled();
  });
});
