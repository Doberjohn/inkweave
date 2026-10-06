import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import {
  COLLECTION_SETS,
  CollectionCardsProvider,
  useCollectionCards,
} from './CollectionCardsContext';

/*
  Read at module scope, not inside a test body: the repo runs on a 7200 RPM disk and
  cold reads cost 18-50 ms, which belongs outside the timed budget (#712).
*/
const CHUNK_DIR = join(process.cwd(), 'public/data/collection');
const SHIPPED_SETS = readdirSync(CHUNK_DIR)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .map((f) => f.replace('.json', ''));

const wrapper = ({children}: {children: React.ReactNode}) => (
  <CollectionCardsProvider>{children}</CollectionCardsProvider>
);

describe('COLLECTION_SETS', () => {
  /*
    A CONTRACT TEST against the filesystem, not a restatement of the constant.

    This list and `generate-collection-data.mjs` must agree, and nothing else checks
    that they do. When the Quest sets were dropped from the dataset (2026-10-06) this
    constant kept listing Q1/Q2, and the consequence is not a missing pair of sets: a
    404 rejects the `Promise.all`, so collection mode gets an EMPTY pool. Comparing
    against the directory is what makes the two sides impossible to drift apart.
  */
  it('lists exactly the chunks the generator ships', () => {
    expect([...COLLECTION_SETS].sort()).toEqual([...SHIPPED_SETS].sort());
  });

  it('does not list the excluded Quest sets', () => {
    expect(COLLECTION_SETS).not.toContain('Q1');
    expect(COLLECTION_SETS).not.toContain('Q2');
  });
});

describe('CollectionCardsProvider', () => {
  let fetchMock: Mock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const ok = () => Promise.resolve({ok: true, json: () => Promise.resolve([])});
  const notFound = () => Promise.resolve({ok: false, status: 404});

  it('fetches one chunk per set, once', async () => {
    fetchMock.mockImplementation(ok);
    const {result} = renderHook(() => useCollectionCards(), {wrapper});

    result.current.ensureLoaded();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchMock).toHaveBeenCalledTimes(COLLECTION_SETS.length);
  });

  it('is idempotent, so calling it on every render costs nothing', async () => {
    fetchMock.mockImplementation(ok);
    const {result} = renderHook(() => useCollectionCards(), {wrapper});

    result.current.ensureLoaded();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    result.current.ensureLoaded();
    result.current.ensureLoaded();

    expect(fetchMock).toHaveBeenCalledTimes(COLLECTION_SETS.length);
  });

  /*
    THE REGRESSION GUARD for an infinite request loop.

    The catch used to reset the one-shot ref so a later attempt could retry. That turned
    one failure into unbounded failure: the catch sets state, the provider re-renders,
    `ensureLoaded` takes a fresh identity, `useCollectionPool`'s effect sees its dep
    change and calls it again, and the guard that would have stopped it is gone. Fifteen
    requests per iteration against a 404.

    Asserting the call COUNT after a failure is what catches it. Asserting only that
    `error` is set would pass either way.
  */
  it('does not re-fetch after a failure, so a bad load cannot loop', async () => {
    fetchMock.mockImplementation(notFound);
    const {result} = renderHook(() => useCollectionCards(), {wrapper});

    result.current.ensureLoaded();
    await waitFor(() => expect(result.current.error).not.toBeNull());
    const afterFailure = fetchMock.mock.calls.length;

    result.current.ensureLoaded();
    result.current.ensureLoaded();

    expect(fetchMock).toHaveBeenCalledTimes(afterFailure);
  });

  it('empties the pool on failure rather than serving a partial one', async () => {
    fetchMock.mockImplementation(notFound);
    const {result} = renderHook(() => useCollectionCards(), {wrapper});

    result.current.ensureLoaded();
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.cards).toEqual([]);
  });

  it('retry is the explicit way back, and it does re-fetch', async () => {
    fetchMock.mockImplementation(notFound);
    const {result} = renderHook(() => useCollectionCards(), {wrapper});

    result.current.ensureLoaded();
    await waitFor(() => expect(result.current.error).not.toBeNull());
    const afterFailure = fetchMock.mock.calls.length;

    fetchMock.mockImplementation(ok);
    result.current.retry();
    await waitFor(() => expect(result.current.error).toBeNull());

    expect(fetchMock.mock.calls.length).toBeGreaterThan(afterFailure);
  });
});
