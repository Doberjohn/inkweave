import {beforeEach, describe, expect, it, vi} from 'vitest';
import {deleteBinderRow, listBinders, moveBinderRow} from './binderRepository';

// A Supabase double, as sharingRepository.test.ts builds it: .env.local puts real credentials in
// scope under vitest, so an unmocked provider would talk to the real project.
const mockOrder = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockState = vi.hoisted(() => ({client: null as unknown}));
const mockReport = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());

vi.mock('../../../shared/lib/supabase', () => ({
  loadSupabase: () => Promise.resolve(mockState.client),
}));
vi.mock('../../../shared/lib/reportFailure', () => ({reportFailure: mockReport}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  mockState.client = {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => {
          mockEq({table, columns, [column]: value});
          return {order: mockOrder};
        },
      }),
      delete: () => ({eq: (column: string, value: string) => mockDelete({table, [column]: value})}),
    }),
    rpc: mockRpc,
  };
});

const ROW = {id: 'b1', name: 'Amber', scope: 'all', rules: 'ink=Amber', cover_id: '2104', place: 0};

describe('listBinders', () => {
  it("reads the caller's own rows in place order", async () => {
    mockOrder.mockResolvedValue({data: [ROW], error: null});
    await expect(listBinders('me')).resolves.toEqual({
      data: [{id: 'b1', name: 'Amber', scope: 'all', rules: 'ink=Amber', coverId: '2104', place: 0}],
      error: null,
    });
    expect(mockEq).toHaveBeenCalledWith({
      table: 'collection_binders',
      columns: 'id, name, scope, rules, cover_id, place',
      owner_id: 'me',
    });
    expect(mockOrder).toHaveBeenCalledWith('place');
  });

  it('leaves out a row that fails the guard, and keeps the rest', async () => {
    const bad = [
      {...ROW, id: 'long', name: 'x'.repeat(31)},
      {...ROW, id: 'cover', cover_id: 'not a card'},
      {...ROW, id: 'place', place: 1.5},
      null,
    ];
    mockOrder.mockResolvedValue({data: [...bad, {...ROW, id: 'ok', cover_id: null}], error: null});
    const {data} = await listBinders('me');
    expect(data?.map((binder) => binder.id)).toEqual(['ok']);
    expect(console.warn).toHaveBeenCalledOnce();
    expect(mockReport).toHaveBeenCalledExactlyOnceWith({area: 'collection', operation: 'read binder rows'}, expect.any(Error));
  });

  it('passes a refusal on as an error', async () => {
    mockOrder.mockResolvedValue({data: null, error: {message: 'boom'}});
    await expect(listBinders('me')).resolves.toEqual({data: null, error: 'boom'});
  });

  it('turns a throw into a network error', async () => {
    mockOrder.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(listBinders('me')).resolves.toEqual({data: null, error: 'Network error'});
  });
});

describe('deleteBinderRow', () => {
  it('deletes the one row by its id', async () => {
    mockDelete.mockResolvedValue({data: null, error: null});
    await expect(deleteBinderRow('b1')).resolves.toEqual({data: null, error: null});
    expect(mockDelete).toHaveBeenCalledExactlyOnceWith({table: 'collection_binders', id: 'b1'});
  });

  it('passes a refusal on as an error', async () => {
    mockDelete.mockResolvedValue({data: null, error: {message: 'boom'}});
    await expect(deleteBinderRow('b1')).resolves.toEqual({data: null, error: 'boom'});
  });
});

describe('moveBinderRow', () => {
  it("asks move_binder to swap it with its neighbour, and hands back the server's answer", async () => {
    mockRpc.mockResolvedValue({data: false, error: null});
    await expect(moveBinderRow('b1', true)).resolves.toEqual({data: false, error: null});
    expect(mockRpc).toHaveBeenCalledExactlyOnceWith('move_binder', {binder_id: 'b1', earlier: true});
  });

  it('turns a throw into a network error', async () => {
    mockRpc.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(moveBinderRow('b1', false)).resolves.toEqual({data: null, error: 'Network error'});
  });
});
