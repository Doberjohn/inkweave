import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import type {ReactNode} from 'react';
import {CollectionProvider, useCollection} from './CollectionContext';
import {COLLECTION_KEY, writeCollection} from './collectionStorage';
import {deleteCollection, getCollection, upsertCollection} from './collectionRepository';
import type {CollectionEntries} from './collectionParser';

/**
 * Signed out by default. `CollectionProvider` reads `useSession` since #555, and
 * these tests cover the LOCAL half — the cloud sync's own decision is tested
 * directly in `collectionSync.test.ts`, where its branches do not need a session
 * and a seeded row to reach.
 */
const mockSession = {user: null as {id: string} | null, loading: false};
vi.mock('../../shared/contexts/SessionContext', () => ({
  useSession: () => mockSession,
}));

/**
 * Stubbed so a signed-in case can never reach the network. Without this the
 * repository would build a REAL client from the `.env.local` credentials vitest
 * inherits, and the test would pass through the wrong code path.
 */
vi.mock('./collectionRepository', () => ({
  getCollection: vi.fn(async () => ({data: null, error: null})),
  upsertCollection: vi.fn(async () => ({data: null, error: null})),
  deleteCollection: vi.fn(async () => ({data: null, error: null})),
}));

const ENTRIES: CollectionEntries = {
  owned: {normal: 3, foil: 1},
  single: {normal: 1, foil: 0},
};

function wrapper({children}: {children: ReactNode}) {
  return <CollectionProvider>{children}</CollectionProvider>;
}

const render = () => renderHook(() => useCollection(), {wrapper});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => vi.restoreAllMocks());

describe('CollectionContext', () => {
  it('starts with no collection when nothing is stored', () => {
    const {result} = render();
    expect(result.current.hasCollection).toBe(false);
    expect(result.current.entries).toEqual({});
    expect(result.current.importedAt).toBeNull();
  });

  it('restores a stored collection on mount', () => {
    writeCollection(ENTRIES, 5000, null, 'import');
    const {result} = render();
    expect(result.current.hasCollection).toBe(true);
    expect(result.current.entries).toEqual(ENTRIES);
    expect(result.current.importedAt).toBe(5000);
  });

  it('an import persists, so it survives a remount', () => {
    const {result} = render();
    act(() => {
      result.current.importCollection(ENTRIES, 7000);
    });
    expect(localStorage.getItem(COLLECTION_KEY)).not.toBeNull();
    expect(render().result.current.entries).toEqual(ENTRIES);
  });

  it('reports a refused write instead of showing an import that did not happen', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('exceeded the quota', 'QuotaExceededError');
    });
    const {result} = render();
    let error: string | null = null;
    act(() => {
      error = result.current.importCollection(ENTRIES, 7000);
    });
    expect(error).toBeTruthy();
    expect(result.current.hasCollection).toBe(false);
  });

  it('a fresh import replaces the previous one rather than merging', () => {
    writeCollection(ENTRIES, 5000, null, 'import');
    const {result} = render();
    act(() => {
      result.current.importCollection({other: {normal: 2, foil: 0}}, 9000);
    });
    expect(result.current.entries).toEqual({other: {normal: 2, foil: 0}});
    expect(result.current.ownedCount('owned')).toBe(0);
  });

  it('ownedCount folds both finishes, and is 0 for a card not in the collection', () => {
    writeCollection(ENTRIES, 5000, null, 'import');
    const {result} = render();
    expect(result.current.ownedCount('owned')).toBe(4);
    expect(result.current.ownedCount('absent')).toBe(0);
  });

  it('owns is true at a single copy, not only at a playset', () => {
    writeCollection(ENTRIES, 5000, null, 'import');
    const {result} = render();
    expect(result.current.owns('single')).toBe(true);
  });

  it('owns nothing when no collection has been imported', () => {
    // The guard that matters is `hasCollection`, not this: a consumer that filters
    // on `owns` without checking it would blank the whole pool for someone who has
    // simply never imported. Asserted so the two stay distinguishable.
    const {result} = render();
    expect(result.current.owns('owned')).toBe(false);
    expect(result.current.hasCollection).toBe(false);
  });

  it('clearing removes the collection and its stored key', () => {
    writeCollection(ENTRIES, 5000, null, 'import');
    const {result} = render();
    act(() => {
      result.current.clearImported();
    });
    expect(result.current.hasCollection).toBe(false);
    expect(localStorage.getItem(COLLECTION_KEY)).toBeNull();
  });

  it('throws when used outside its provider, rather than reading as an empty collection', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useCollection())).toThrow();
  });
});

/**
 * The cloud half (#555). The DECISION lives in `collectionSync.test.ts`; these
 * cover the WIRING — that the provider actually calls the repository, which no
 * amount of testing the pure function can show.
 */
describe('CollectionContext — signed in', () => {
  beforeEach(() => {
    mockSession.user = {id: 'user-1'};
  });
  afterEach(() => {
    mockSession.user = null;
  });

  it('uploads an import to the account', async () => {
    const {result} = render();
    await act(async () => {
      result.current.importCollection(ENTRIES, 7000);
    });
    expect(upsertCollection).toHaveBeenCalledWith('user-1', ENTRIES, 7000);
  });

  it('deletes the account copy when the collection is cleared', async () => {
    writeCollection(ENTRIES, 5000, null, 'import');
    const {result} = render();
    await act(async () => {
      result.current.clearImported();
    });
    // Or it reappears from another device and reads as the delete having failed.
    expect(deleteCollection).toHaveBeenCalledWith('user-1');
  });

  it('adopts the account copy over this browser stale one', async () => {
    writeCollection({stale: {normal: 1, foil: 0}}, 1000, null, 'import');
    vi.mocked(getCollection).mockResolvedValueOnce({
      data: {schemaVersion: 1, importedAt: 9000, entries: ENTRIES},
      error: null,
    });

    const {result} = render();
    // Flush the sync's fetch; `act` does not return its callback's value, so the
    // render has to happen outside it.
    await act(async () => {
      await Promise.resolve();
    });

    // Server wins (owner ruling), and the local copy is overwritten so a later
    // signed-out visit sees what the account holds rather than the stale import.
    expect(result.current.importedAt).toBe(9000);
    expect(result.current.owns('owned')).toBe(true);
    expect(result.current.owns('stale')).toBe(false);
  });

  /*
    THE FAILURE PATH OF THE SAME RULING. Server-wins is easy to honour when the
    mirror write succeeds. If it fails and the superseded local copy is simply left
    in place, a later signed-out mount reads it back and presents a collection this
    sync already decided had lost, with nothing to indicate it is stale.

    Asserting the KEY IS GONE is the point. Asserting only the in-memory state would
    pass either way, since state is set from the server copy regardless.
  */
  it('drops the superseded local copy when the mirror write fails', async () => {
    writeCollection({stale: {normal: 1, foil: 0}}, 1000, null, 'import');
    vi.mocked(getCollection).mockResolvedValueOnce({
      data: {schemaVersion: 1, importedAt: 9000, entries: ENTRIES},
      error: null,
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('exceeded the quota', 'QuotaExceededError');
    });

    const {result} = render();
    await act(async () => {
      await Promise.resolve();
    });

    expect(localStorage.getItem(COLLECTION_KEY)).toBeNull();
    expect(result.current.owns('owned')).toBe(true);
  });

  it('does not upload when the account already has a collection', async () => {
    writeCollection(ENTRIES, 5000, null, 'import');
    vi.mocked(getCollection).mockResolvedValueOnce({
      data: {schemaVersion: 1, importedAt: 9000, entries: {}},
      error: null,
    });

    render();
    await act(async () => {
      await Promise.resolve();
    });

    expect(upsertCollection).not.toHaveBeenCalled();
  });
});

/** Drain the write queue and any sync: the repository mocks all settle in microtasks. */
const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const SERVER_ROW = {data: {schemaVersion: 1, importedAt: 1000, entries: {old: {normal: 1, foil: 0}}}, error: null};

function signIn(uid: string | null) {
  mockSession.user = uid === null ? null : {id: uid};
}

/** The #739 defects, each at the wiring level the pure table cannot reach. */
describe('CollectionContext — #739 cloud-sync defects', () => {
  afterEach(() => signIn(null));

  it("never uploads one account's import into another's row on a shared browser", async () => {
    signIn('user-a');
    const {result, rerender} = render();
    await flush();
    act(() => {
      result.current.importCollection(ENTRIES, 7000);
    });
    await flush();

    signIn(null);
    rerender();
    signIn('user-b');
    rerender();
    await flush();

    expect(upsertCollection).not.toHaveBeenCalledWith('user-b', expect.anything(), expect.anything());
    // Owner ruling 2026-10-06: B sees an empty collection, not A's cards.
    expect(result.current.hasCollection).toBe(false);
    expect(result.current.owns('owned')).toBe(false);
  });

  it('claims a signed-out import for the first account, so a second cannot take it after a reload', async () => {
    writeCollection(ENTRIES, 7000, null, 'import');
    signIn('user-a');
    const first = render();
    await flush();
    expect(upsertCollection).toHaveBeenCalledWith('user-a', ENTRIES, 7000);
    first.unmount();

    signIn('user-b');
    render();
    await flush();
    expect(upsertCollection).not.toHaveBeenCalledWith('user-b', expect.anything(), expect.anything());
  });

  it('keeps an import whose upload failed, and retries it over the older row', async () => {
    signIn('user-a');
    vi.mocked(upsertCollection).mockResolvedValueOnce({data: null, error: 'Network error'});
    const first = render();
    await flush();
    act(() => {
      first.result.current.importCollection(ENTRIES, 7000);
    });
    await flush();
    first.unmount();

    vi.mocked(getCollection).mockResolvedValueOnce(SERVER_ROW);
    const {result} = render();
    await flush();

    expect(result.current.entries).toEqual(ENTRIES);
    expect(upsertCollection).toHaveBeenLastCalledWith('user-a', ENTRIES, 7000);
  });

  it('a failed delete never brings the cleared collection back', async () => {
    signIn('user-a');
    writeCollection(ENTRIES, 7000, 'user-a', 'import');
    vi.mocked(getCollection).mockResolvedValueOnce(SERVER_ROW);
    const first = render();
    await flush();
    vi.mocked(deleteCollection).mockResolvedValueOnce({data: null, error: 'Network error'});
    act(() => {
      first.result.current.clearImported();
    });
    await flush();
    first.unmount();

    // The row survived. The next mount must retry the delete, not adopt it.
    vi.mocked(getCollection).mockResolvedValueOnce(SERVER_ROW);
    const {result} = render();
    await flush();

    expect(result.current.hasCollection).toBe(false);
    expect(deleteCollection).toHaveBeenCalledTimes(2);
  });

  it('a delete whose retry fails again still never adopts the row', async () => {
    signIn('user-a');
    const first = render();
    await flush();
    const failed = {data: null, error: 'Network error'};
    vi.mocked(deleteCollection).mockResolvedValueOnce(failed).mockResolvedValueOnce(failed);
    act(() => {
      first.result.current.clearImported();
    });
    await flush();
    first.unmount();

    vi.mocked(getCollection).mockResolvedValueOnce(SERVER_ROW);
    const {result} = render();
    await flush();

    expect(getCollection).toHaveBeenCalledTimes(1);
    expect(result.current.hasCollection).toBe(false);
  });

  it('a confirmed upload is not repeated after a lost migrated marker and a remote delete', async () => {
    signIn('user-a');
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key.startsWith('inkweave:collection:migrated')) throw new DOMException('denied', 'SecurityError');
      setItem.call(this, key, value);
    });
    const first = render();
    await flush();
    act(() => {
      first.result.current.importCollection(ENTRIES, 7000);
    });
    await flush();
    first.unmount();

    // The row is then deleted from another device.
    render();
    await flush();
    expect(upsertCollection).toHaveBeenCalledTimes(1);
  });

  it('a re-import after a failed delete is not deleted by the retry', async () => {
    signIn('user-a');
    const first = render();
    await flush();
    vi.mocked(deleteCollection).mockResolvedValueOnce({data: null, error: 'Network error'});
    act(() => {
      first.result.current.clearImported();
      first.result.current.importCollection(ENTRIES, 7000);
    });
    await flush();
    first.unmount();

    // The import's upsert replaced the row, so the clear it superseded is not owed.
    render();
    await flush();
    expect(deleteCollection).toHaveBeenCalledTimes(1);
  });

  it('a clear waits for an upload already in flight, so the upload cannot recreate the row', async () => {
    signIn('user-a');
    let settleUpsert: () => void = () => {};
    vi.mocked(upsertCollection).mockImplementationOnce(
      () => new Promise((resolve) => (settleUpsert = () => resolve({data: null, error: null}))),
    );
    const {result} = render();
    await flush();
    act(() => {
      result.current.importCollection(ENTRIES, 7000);
      result.current.clearImported();
    });
    await flush();
    expect(deleteCollection).not.toHaveBeenCalled();

    settleUpsert();
    await flush();
    expect(deleteCollection).toHaveBeenCalledWith('user-a');
    expect(upsertCollection).toHaveBeenCalledTimes(1);
  });

  it('a second import sharing a queued upload timestamp is never overwritten by it', async () => {
    signIn('user-a');
    let settleUpsert: () => void = () => {};
    vi.mocked(upsertCollection).mockImplementationOnce(
      () => new Promise((resolve) => (settleUpsert = () => resolve({data: null, error: null}))),
    );
    const {result} = render();
    await flush();
    const newer = {newer: {normal: 1, foil: 0}};
    act(() => {
      result.current.importCollection(ENTRIES, 7000);
      result.current.importCollection(newer, 7000);
    });
    await flush();
    settleUpsert();
    await flush();

    expect(result.current.entries).toEqual(newer);
    expect(upsertCollection).toHaveBeenLastCalledWith('user-a', newer, 7001);
  });

  it("a write hung for one account does not hold up another account's", async () => {
    signIn('user-a');
    let settleUpsert: () => void = () => {};
    vi.mocked(upsertCollection).mockImplementationOnce(
      () => new Promise((resolve) => (settleUpsert = () => resolve({data: null, error: null}))),
    );
    const {result, rerender} = render();
    await flush();
    act(() => {
      result.current.importCollection(ENTRIES, 7000);
    });
    signIn('user-b');
    rerender();
    await flush();
    act(() => {
      result.current.clearImported();
    });
    await flush();

    expect(deleteCollection).toHaveBeenCalledWith('user-b');
    settleUpsert();
    await flush();
  });

  it('a write that throws does not stall the ones queued after it', async () => {
    signIn('user-a');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(upsertCollection).mockRejectedValueOnce(new Error('boom'));
    const {result} = render();
    await flush();
    act(() => {
      result.current.importCollection(ENTRIES, 7000);
      result.current.clearImported();
    });
    await flush();
    expect(deleteCollection).toHaveBeenCalledWith('user-a');
  });

  it('never uploads a mirrored server copy whose migrated marker failed to write', async () => {
    signIn('user-a');
    vi.mocked(getCollection).mockResolvedValueOnce(SERVER_ROW);
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key.startsWith('inkweave:collection:migrated')) throw new DOMException('denied', 'SecurityError');
      setItem.call(this, key, value);
    });
    const first = render();
    await flush();
    first.unmount();

    // The row is then deleted from another device.
    render();
    await flush();
    expect(upsertCollection).not.toHaveBeenCalled();
  });
});
