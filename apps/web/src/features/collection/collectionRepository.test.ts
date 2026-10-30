import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {deleteCollection, getCollection, upsertCollection} from './collectionRepository';

// A Supabase double, as sharingRepository.test.ts builds it: .env.local puts real credentials in
// scope under vitest, so an unmocked provider would talk to the real project.
const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockState = vi.hoisted(() => ({load: () => Promise.resolve(null as unknown)}));
const mockReport = vi.hoisted(() => vi.fn());

vi.mock('../../shared/lib/supabase', () => ({loadSupabase: () => mockState.load()}));
vi.mock('../../shared/lib/reportFailure', () => ({reportFailure: mockReport}));

const client = {
  from: () => ({
    select: () => ({eq: () => ({maybeSingle: mockMaybeSingle})}),
    upsert: mockUpsert,
    delete: () => ({eq: mockDelete}),
  }),
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mockState.load = () => Promise.resolve(client);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const REFUSAL = {message: 'permission denied for table collections', code: '42501'};

describe('collectionRepository failures', () => {
  // Each call names its own operation, so Sentry tells a lost save from a lost read.
  it.each([
    {operation: 'read', call: () => getCollection('me')},
    {operation: 'save', call: () => upsertCollection('me', {}, 0)},
    {operation: 'delete', call: () => deleteCollection('me')},
  ])('reports a refused $operation as the collection’s $operation', async ({operation, call}) => {
    mockMaybeSingle.mockResolvedValue({data: null, error: REFUSAL});
    mockUpsert.mockResolvedValue({error: REFUSAL});
    mockDelete.mockResolvedValue({error: REFUSAL});

    await expect(call()).resolves.toEqual({data: null, error: REFUSAL.message});

    expect(mockReport).toHaveBeenCalledWith({area: 'collection', operation}, REFUSAL);
  });

  // The sync stops rather than adopt a row it can't read, so that account's binder never syncs.
  it('reports a row it cannot use as a failed read', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {entries: {}, imported_at: '2026-10-30T10:00:00Z', schema_version: 2},
      error: null,
    });

    await getCollection('me');

    // An Error, which Sentry files as unexpected: the row is the app's to look at, not the server's.
    expect(mockReport).toHaveBeenCalledExactlyOnceWith({area: 'collection', operation: 'read'}, expect.any(Error));
    expect(String(mockReport.mock.calls[0][1])).toContain('unusable collection row');
  });

  it('reports a Supabase SDK that failed to load, and answers with a network error', async () => {
    const failure = new TypeError('Failed to fetch dynamically imported module');
    mockState.load = () => Promise.reject(failure);

    await expect(upsertCollection('me', {}, 0)).resolves.toEqual({data: null, error: 'Network error'});

    expect(mockReport).toHaveBeenCalledWith({area: 'collection', operation: 'save'}, failure);
  });

  it('reports nothing for a build without Supabase', async () => {
    mockState.load = () => Promise.resolve(null);

    await expect(upsertCollection('me', {}, 0)).resolves.toEqual({data: null, error: 'Supabase not configured'});

    expect(mockReport).not.toHaveBeenCalled();
  });
});
