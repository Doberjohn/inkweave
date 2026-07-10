import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import type {Deck} from '../types';

vi.mock('../../../shared/lib/supabase', () => ({getSupabase: vi.fn()}));
import {getSupabase} from '../../../shared/lib/supabase';
import {listDecks, getDeck, createDeck, updateDeck, deleteDeck, upsertDeck} from './deckRepository';

const mockGetSupabase = vi.mocked(getSupabase);

// Chainable Supabase query stand-in: every non-terminal returns the same object;
// terminals (.maybeSingle, or awaiting the builder for list/delete) resolve to
// `result`. Each vi.fn is inspectable so tests assert the exact calls made.
type QueryResult = {data: unknown; error: {code?: string; message: string} | null};
function makeQuery(result: QueryResult) {
  const q: Record<string, ReturnType<typeof vi.fn>> & {then?: unknown} = {};
  for (const method of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'order']) {
    q[method] = vi.fn(() => q);
  }
  q.maybeSingle = vi.fn(() => Promise.resolve(result));
  // Awaiting the builder itself (listDecks after .order, deleteDecks after .eq).
  (q as {then: unknown}).then = (res: (v: QueryResult) => unknown) => Promise.resolve(result).then(res);
  return q;
}
let currentQuery: ReturnType<typeof makeQuery>;
const from = vi.fn(() => currentQuery);
function prime(result: QueryResult) {
  currentQuery = makeQuery(result);
  return currentQuery;
}

const ISO_A = '2026-01-01T00:00:00.000Z';
const ISO_B = '2026-01-02T00:00:00.000Z';
function makeRow(over: Record<string, unknown> = {}) {
  return {
    id: 'deck-1',
    owner_id: 'user-1',
    name: 'My Deck',
    gameplan: 'ramp',
    inks: ['Amber', 'Steel'],
    cards: [{cardId: 'c1', quantity: 4, isCore: true}],
    is_public: false,
    schema_version: 1,
    created_at: ISO_A,
    updated_at: ISO_B,
    ...over,
  };
}
function makeDeck(over: Partial<Deck> = {}): Deck {
  return {
    id: 'deck-1',
    name: 'My Deck',
    cards: [{cardId: 'c1', quantity: 4, isCore: true}],
    gameplan: 'ramp',
    inks: ['Amber', 'Steel'],
    isPublic: false,
    ownerId: 'user-1',
    createdAt: Date.parse(ISO_A),
    updatedAt: Date.parse(ISO_B),
    schemaVersion: 1,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentQuery = makeQuery({data: null, error: null});
  mockGetSupabase.mockReturnValue({from} as never);
});
afterEach(() => vi.restoreAllMocks());

describe('getDeck (row -> domain mapping)', () => {
  it('reads one row via eq(id) + maybeSingle and maps snake_case / jsonb / ISO timestamps', async () => {
    const q = prime({data: makeRow(), error: null});
    const {data} = await getDeck('deck-1');
    expect(from).toHaveBeenCalledWith('decks');
    expect(q.eq).toHaveBeenCalledWith('id', 'deck-1');
    expect(q.maybeSingle).toHaveBeenCalled();
    expect(data).toEqual(makeDeck());
  });

  it('maps a null gameplan to undefined and a non-array cards value to []', async () => {
    prime({data: makeRow({gameplan: null, cards: null}), error: null});
    const {data} = await getDeck('deck-1');
    expect(data?.gameplan).toBeUndefined();
    expect(data?.cards).toEqual([]);
  });

  it('drops an unknown gameplan and filters invalid inks defensively', async () => {
    prime({data: makeRow({gameplan: 'bogus', inks: ['Amber', 'Rainbow', 42]}), error: null});
    const {data} = await getDeck('deck-1');
    expect(data?.gameplan).toBeUndefined();
    expect(data?.inks).toEqual(['Amber']);
  });

  it('returns null data when the row is absent or RLS-hidden (maybeSingle -> null)', async () => {
    prime({data: null, error: null});
    expect((await getDeck('missing')).data).toBeNull();
  });
});

describe('listDecks', () => {
  it('scopes to the owner, orders by updated_at desc, and maps every row', async () => {
    const q = prime({data: [makeRow({id: 'a'}), makeRow({id: 'b'})], error: null});
    const {data} = await listDecks('user-1');
    expect(q.eq).toHaveBeenCalledWith('owner_id', 'user-1');
    expect(q.order).toHaveBeenCalledWith('updated_at', {ascending: false});
    expect(data?.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('returns null data and logs on a query error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    prime({data: null, error: {code: '42P01', message: 'no relation'}});
    const {data, error} = await listDecks('user-1');
    expect(data).toBeNull();
    expect(error).toBe('no relation');
    expect(spy).toHaveBeenCalled();
  });
});

describe('createDeck (domain -> insert payload)', () => {
  it('inserts the mapped columns with an explicit owner_id and reads the row back', async () => {
    const q = prime({data: makeRow({id: 'new'}), error: null});
    const {data} = await createDeck(makeDeck({isPublic: false}), 'user-1');
    expect(q.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_id: 'user-1',
        name: 'My Deck',
        gameplan: 'ramp',
        inks: ['Amber', 'Steel'],
        is_public: false,
      }),
    );
    expect(q.maybeSingle).toHaveBeenCalled();
    expect(data?.id).toBe('new');
  });
});

describe('updateDeck (writable columns only)', () => {
  it('updates the mapped patch, scopes by eq(id), reads back via maybeSingle', async () => {
    const q = prime({data: makeRow({name: 'Renamed'}), error: null});
    const {data} = await updateDeck(makeDeck({name: 'Renamed'}));
    const patch = q.update.mock.calls[0][0] as Record<string, unknown>;
    expect(patch.name).toBe('Renamed');
    expect(patch).not.toHaveProperty('id'); // id / owner_id / created_at are immutable
    expect(patch).not.toHaveProperty('owner_id');
    expect(q.eq).toHaveBeenCalledWith('id', 'deck-1');
    expect(data?.name).toBe('Renamed');
  });

  it('returns null data when RLS returns no row (not the owner)', async () => {
    prime({data: null, error: null});
    expect((await updateDeck(makeDeck())).data).toBeNull();
  });
});

describe('upsertDeck', () => {
  it('upserts on the id conflict target with the owner_id set', async () => {
    const q = prime({data: makeRow(), error: null});
    await upsertDeck(makeDeck(), 'user-1');
    expect(q.upsert).toHaveBeenCalledWith(
      expect.objectContaining({id: 'deck-1', owner_id: 'user-1'}),
      {onConflict: 'id'},
    );
  });
});

describe('deleteDeck', () => {
  it('issues delete().eq(id) and reports no error on success', async () => {
    const q = prime({data: null, error: null});
    const {error} = await deleteDeck('deck-1');
    expect(q.delete).toHaveBeenCalled();
    expect(q.eq).toHaveBeenCalledWith('id', 'deck-1');
    expect(error).toBeNull();
  });

  it('surfaces the error message and logs on failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    prime({data: null, error: {code: '42501', message: 'denied'}});
    expect((await deleteDeck('deck-1')).error).toBe('denied');
  });
});

describe('env gate (Supabase not configured)', () => {
  beforeEach(() => mockGetSupabase.mockReturnValue(null));

  it('getDeck returns the not-configured result and never touches the client', async () => {
    const {data, error} = await getDeck('deck-1');
    expect(data).toBeNull();
    expect(error).toBe('Supabase not configured');
    expect(from).not.toHaveBeenCalled();
  });

  it('createDeck no-ops without the client', async () => {
    expect((await createDeck(makeDeck(), 'user-1')).error).toBe('Supabase not configured');
    expect(from).not.toHaveBeenCalled();
  });
});
