import {beforeEach, describe, expect, it, vi} from 'vitest';
import {SHELF_FULL, deleteBinderRow, insertBinderRow, listBinders, moveBinderRow, updateBinderRow} from './binderRepository';

// A Supabase double, as sharingRepository.test.ts builds it: .env.local puts real credentials in
// scope under vitest, so an unmocked provider would talk to the real project.
const mockOrder = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockState = vi.hoisted(() => ({client: null as unknown}));
const mockReport = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());

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
      insert: (row: object) => ({
        select: (columns: string) => ({single: () => mockInsert({table, row, columns})}),
      }),
      update: (fields: object) => ({
        eq: (column: string, value: string) => ({
          select: (columns: string) => ({maybeSingle: () => mockUpdate({table, fields, [column]: value, columns})}),
        }),
      }),
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

const AMBER = {id: 'b1', name: 'Amber', scope: 'all', rules: 'ink=Amber', coverId: '2104', place: 0};
const COLUMNS = 'id, name, scope, rules, cover_id, place';

describe('insertBinderRow', () => {
  it("sends the five columns a client may write, and answers the server's row", async () => {
    mockInsert.mockResolvedValue({data: {...ROW, place: 7}, error: null});
    const input = {name: 'Amber', scope: 'all', rules: 'ink=Amber', coverId: '2104'};
    await expect(insertBinderRow('me', input)).resolves.toEqual({data: {...AMBER, place: 7}, error: null});
    expect(mockInsert).toHaveBeenCalledExactlyOnceWith({
      table: 'collection_binders',
      row: {owner_id: 'me', name: 'Amber', scope: 'all', rules: 'ink=Amber', cover_id: '2104'},
      columns: COLUMNS,
    });
  });

  it("answers SHELF_FULL for the cap's check violation, and Sentry hears nothing", async () => {
    mockInsert.mockResolvedValue({data: null, error: {code: '23514', message: 'A shelf holds 30 binders at most'}});
    await expect(insertBinderRow('me', {name: 'One more', scope: 'all', rules: '', coverId: null})).resolves.toEqual({
      data: null,
      error: SHELF_FULL,
    });
    expect(mockReport).not.toHaveBeenCalled();
  });

  it("reports a check violation of the table's own, which isn't the cap", async () => {
    const refused = {code: '23514', message: 'new row for relation "collection_binders" violates check constraint "collection_binders_name"'};
    mockInsert.mockResolvedValue({data: null, error: refused});
    await expect(insertBinderRow('me', {name: 'Amber', scope: 'all', rules: '', coverId: null})).resolves.toEqual({
      data: null,
      error: refused.message,
    });
    expect(mockReport).toHaveBeenCalledOnce();
  });

  it('passes any other refusal on as an error', async () => {
    mockInsert.mockResolvedValue({data: null, error: {code: '42501', message: 'denied'}});
    await expect(insertBinderRow('me', {name: 'Amber', scope: 'all', rules: '', coverId: null})).resolves.toEqual({
      data: null,
      error: 'denied',
    });
    expect(mockReport).toHaveBeenCalledOnce();
  });
});

describe('updateBinderRow', () => {
  it('changes only the fields given, by id, and answers the row', async () => {
    mockUpdate.mockResolvedValue({data: {...ROW, rules: 'ink=Amber&rarity=Epic'}, error: null});
    await expect(updateBinderRow('b1', {rules: 'ink=Amber&rarity=Epic'})).resolves.toEqual({
      data: {...AMBER, rules: 'ink=Amber&rarity=Epic'},
      error: null,
    });
    expect(mockUpdate).toHaveBeenCalledExactlyOnceWith({
      table: 'collection_binders',
      fields: {rules: 'ink=Amber&rarity=Epic'},
      id: 'b1',
      columns: COLUMNS,
    });
  });

  it('answers no binder and no error when the row is gone', async () => {
    mockUpdate.mockResolvedValue({data: null, error: null});
    await expect(updateBinderRow('b1', {name: 'Gold'})).resolves.toEqual({data: null, error: null});
  });

  it('turns a throw into a network error', async () => {
    mockUpdate.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(updateBinderRow('b1', {coverId: null})).resolves.toEqual({data: null, error: 'Network error'});
  });
});
