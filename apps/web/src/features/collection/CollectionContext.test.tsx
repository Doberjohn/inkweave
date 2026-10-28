import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {renderHook, act, render as renderUi, screen} from '@testing-library/react';
import {StrictMode, type ReactNode} from 'react';
import {createCard} from '../../shared/test-utils';
import {CollectionProvider, UPLOAD_DELAY_MS, useCollection} from './CollectionContext';
import {
  COLLECTION_KEY,
  markUploadPending,
  pendingUploadImportedAt,
  readCollection,
  writeCollection,
} from './collectionStorage';
import {deleteCollection, getCollection, upsertCollection} from './collectionRepository';
import type {CollectionEntries} from './collectionParser';
import {placementsFor} from './placeCopies';

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
  it('is not syncing when signed out: there is no account copy to wait for', () => {
    expect(render().result.current.syncing).toBe(false);
  });

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

  it('reports syncing until the account copy answers, so "no collection" is not taken for an answer', async () => {
    let answer: (value: Awaited<ReturnType<typeof getCollection>>) => void = () => {};
    vi.mocked(getCollection).mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    const {result} = render();
    expect(result.current.syncing).toBe(true);

    await act(async () => answer({data: null, error: null}));
    expect(result.current.syncing).toBe(false);
  });

  it('adopts a collection that lives only on the account under StrictMode, which runs the sync twice', async () => {
    // Dev mounts, cleans up and mounts again; the first read is cancelled, so the
    // second must still be made, or a new browser never sees the account's copy.
    const row = {data: {schemaVersion: 1, importedAt: 9000, entries: ENTRIES}, error: null};
    vi.mocked(getCollection).mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    function Status() {
      const {hasCollection, syncing} = useCollection();
      return <p>{`${hasCollection ? 'adopted' : 'none'}, ${syncing ? 'syncing' : 'answered'}`}</p>;
    }
    // StrictMode AT THE ROOT. React decides the double run where the new subtree
    // starts, so inside a wrapper (renderHook's included) the effect runs once and
    // this test would pass with the bug in.
    renderUi(
      <StrictMode>
        <CollectionProvider>
          <Status />
        </CollectionProvider>
      </StrictMode>,
    );
    expect(await screen.findByText('adopted, answered')).toBeInTheDocument();
  });

  it('stops syncing when the read fails outright, rather than waiting for ever', async () => {
    vi.mocked(getCollection).mockRejectedValueOnce(new Error('offline'));
    const {result} = render();
    await vi.waitFor(() => expect(result.current.syncing).toBe(false));
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

  it('serializes writes under a per-account Web Lock when the browser has one', async () => {
    // jsdom has no `navigator.locks`; this stub grants each name in request order,
    // which is the guarantee real browsers give across every tab of the origin.
    const held = new Map<string, Promise<unknown>>();
    const request = vi.fn((name: string, callback: () => Promise<unknown>) => {
      const granted = (held.get(name) ?? Promise.resolve()).then(callback);
      held.set(name, granted.catch(() => {}));
      return granted;
    });
    Object.defineProperty(navigator, 'locks', {value: {request}, configurable: true});
    try {
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
      expect(request).toHaveBeenCalledTimes(2);
      expect(request).toHaveBeenCalledWith('inkweave:collection:write:user-a', expect.any(Function));
    } finally {
      Reflect.deleteProperty(navigator, 'locks');
    }
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

/**
 * Counts changed in the app (#826): the local write, the batched upload with its
 * flushes, and the re-read when the tab is shown again. On fake timers, Date included,
 * so the batch's delay and each edit's stamp are the test's to set.
 */
describe('CollectionContext, counts changed in the app (#826)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(9000);
    signIn('user-a');
    // The account's copy, and its mirror here, so the mount's sync uploads nothing.
    writeCollection(ENTRIES, 5000, 'user-a', 'server');
    vi.mocked(getCollection).mockResolvedValue({data: {schemaVersion: 1, importedAt: 5000, entries: ENTRIES}, error: null});
  });
  afterEach(() => {
    vi.useRealTimers();
    signIn(null);
    Reflect.deleteProperty(document, 'visibilityState');
    // Back to the file's default, an account with no row, for whatever runs next.
    vi.mocked(getCollection).mockImplementation(async () => ({data: null, error: null}));
  });

  /** Run the timers `ms` on, and everything the write chain and the sync have queued. */
  const advance = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });

  /** The tab hidden or shown, as a tab switch makes it. */
  async function showPage(visibility: 'hidden' | 'visible') {
    Object.defineProperty(document, 'visibilityState', {value: visibility, configurable: true});
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  async function renderSynced() {
    const view = render();
    await advance(0);
    return view;
  }

  it('sets one finish of one card, and the edit survives a remount', async () => {
    const {result, unmount} = await renderSynced();
    act(() => result.current.setCount('owned', 'foil', 2));
    expect(result.current.ownedCount('owned')).toBe(5);
    unmount();

    expect(render().result.current.entries.owned).toEqual({normal: 3, foil: 2});
  });

  it('stores a count below 0 as 0, and a card left at 0 normal and 0 foil leaves the collection', async () => {
    const {result} = await renderSynced();
    act(() => result.current.setCount('owned', 'foil', -2));
    act(() => result.current.setCount('single', 'normal', 0));

    expect(result.current.entries).toEqual({owned: {normal: 3, foil: 0}});
    expect(result.current.hasCollection).toBe(true);
  });

  it('refuses a count that is not a whole number, which would fail the stored copy on its next read', async () => {
    const {result} = await renderSynced();
    act(() => result.current.setCount('owned', 'foil', 1.5));

    expect(result.current.entries).toEqual(ENTRIES);
  });

  it("refuses an edit before the account's copy has answered, which its upload would overwrite", async () => {
    vi.mocked(getCollection).mockImplementationOnce(() => new Promise(() => {}));
    const {result} = render();
    await advance(0);
    expect(result.current.syncing).toBe(true);

    act(() => result.current.setCount('owned', 'foil', 2));
    expect(result.current.entries).toEqual(ENTRIES);
  });

  it('writes the edit as a new copy under a fresh stamp, marked pending at once', async () => {
    const {result} = await renderSynced();
    act(() => result.current.setCount('owned', 'foil', 2));

    expect(result.current.importedAt).toBe(9000);
    expect(pendingUploadImportedAt('user-a')).toBe(9000);
  });

  it('uploads a burst of edits once, with the last copy, a moment after the last', async () => {
    const {result} = await renderSynced();
    act(() => result.current.setCount('owned', 'foil', 2));
    await advance(400);
    act(() => result.current.setCount('owned', 'foil', 3));
    await advance(400);
    act(() => result.current.setCount('single', 'foil', 1));
    await advance(UPLOAD_DELAY_MS - 1);
    expect(upsertCollection).not.toHaveBeenCalled();

    await advance(1);
    expect(upsertCollection).toHaveBeenCalledTimes(1);
    expect(upsertCollection).toHaveBeenCalledWith(
      'user-a',
      {owned: {normal: 3, foil: 3}, single: {normal: 1, foil: 1}},
      result.current.importedAt,
    );
  });

  it('uploads at once when the page is hidden', async () => {
    const {result} = await renderSynced();
    act(() => result.current.setCount('owned', 'foil', 2));
    await showPage('hidden');

    expect(upsertCollection).toHaveBeenCalledTimes(1);
  });

  it('uploads at once when the provider unmounts, leaving the pages that hold it', async () => {
    const {result, unmount} = await renderSynced();
    act(() => result.current.setCount('owned', 'foil', 2));
    unmount();
    await advance(0);

    expect(upsertCollection).toHaveBeenCalledTimes(1);
  });

  it("on sign-out leaves the edit owed to the account, whose next sign-in uploads it", async () => {
    const {result, rerender} = await renderSynced();
    act(() => result.current.setCount('owned', 'foil', 2));
    const stamp = result.current.importedAt;
    signIn(null);
    rerender();
    await advance(UPLOAD_DELAY_MS);
    // The session is gone by now, so an upload would only be refused.
    expect(upsertCollection).not.toHaveBeenCalled();

    signIn('user-a');
    rerender();
    await advance(0);
    expect(upsertCollection).toHaveBeenCalledWith('user-a', {...ENTRIES, owned: {normal: 3, foil: 2}}, stamp);
  });

  it('an import replaces an edit still waiting to upload, upload included', async () => {
    const {result} = await renderSynced();
    act(() => result.current.setCount('owned', 'foil', 2));
    act(() => {
      result.current.importCollection({other: {normal: 1, foil: 0}}, 7000);
    });
    await advance(UPLOAD_DELAY_MS);

    // Uploaded after the import's, the edit would have put the old cards back.
    expect(upsertCollection).toHaveBeenCalledTimes(1);
    expect(upsertCollection).toHaveBeenCalledWith('user-a', {other: {normal: 1, foil: 0}}, 7000);
  });

  it('a clear is never undone by an edit still waiting to upload', async () => {
    const {result} = await renderSynced();
    act(() => result.current.setCount('owned', 'foil', 2));
    act(() => result.current.clearImported());
    await advance(UPLOAD_DELAY_MS);

    expect(deleteCollection).toHaveBeenCalledWith('user-a');
    expect(upsertCollection).not.toHaveBeenCalled();
  });

  it('drops the copy here once the account has none, its collection cleared on another device', async () => {
    // Kept, it read as the collection in force, and an edit to it uploaded it again (#826).
    const {result} = await renderSynced();
    vi.mocked(getCollection).mockResolvedValueOnce({data: null, error: null});
    await showPage('hidden');
    await showPage('visible');

    expect(result.current.hasCollection).toBe(false);
    expect(localStorage.getItem(COLLECTION_KEY)).toBeNull();
    act(() => result.current.setCount('owned', 'foil', 2));
    await advance(UPLOAD_DELAY_MS);
    expect(upsertCollection).not.toHaveBeenCalled();
  });

  it('adopts the account copy changed on another device when the tab is shown again', async () => {
    const {result} = await renderSynced();
    const elsewhere = {other: {normal: 2, foil: 0}};
    vi.mocked(getCollection).mockResolvedValueOnce({
      data: {schemaVersion: 1, importedAt: 8000, entries: elsewhere},
      error: null,
    });
    await showPage('hidden');
    await showPage('visible');

    expect(result.current.entries).toEqual(elsewhere);
  });

  it('drops an older read of the account copy that lands after a newer one', async () => {
    let answerFirst: (value: Awaited<ReturnType<typeof getCollection>>) => void = () => {};
    vi.mocked(getCollection).mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)));
    const {result} = render();
    await advance(0);
    const newer = {newer: {normal: 1, foil: 0}};
    vi.mocked(getCollection).mockResolvedValueOnce({data: {schemaVersion: 1, importedAt: 8000, entries: newer}, error: null});
    await showPage('hidden');
    await showPage('visible');
    expect(result.current.entries).toEqual(newer);

    await act(async () => answerFirst({data: {schemaVersion: 1, importedAt: 7000, entries: {older: {normal: 1, foil: 0}}}, error: null}));
    expect(result.current.entries).toEqual(newer);
  });

  it("takes in another tab's write, which replaces this tab's waiting upload", async () => {
    const {result} = await renderSynced();
    act(() => result.current.setCount('owned', 'foil', 2));
    const fromOtherTab = {other: {normal: 1, foil: 0}};
    writeCollection(fromOtherTab, 9500, 'user-a', 'import');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {key: COLLECTION_KEY}));
    });
    await advance(UPLOAD_DELAY_MS);

    expect(result.current.entries).toEqual(fromOtherTab);
    // The tab that wrote it owns its upload.
    expect(upsertCollection).not.toHaveBeenCalled();
  });

  it("a tab shown again after another tab's edit uploads that edit, never the account's older copy over it", async () => {
    const {result} = await renderSynced();
    const editedInOtherTab = {...ENTRIES, owned: {normal: 3, foil: 2}};
    writeCollection(editedInOtherTab, 9500, 'user-a', 'import');
    markUploadPending('user-a', 9500);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {key: COLLECTION_KEY}));
    });
    // The other tab's upload has not reached the account when this one is shown again.
    vi.mocked(getCollection).mockResolvedValueOnce({data: {schemaVersion: 1, importedAt: 5000, entries: ENTRIES}, error: null});
    await showPage('hidden');
    await showPage('visible');

    expect(result.current.entries).toEqual(editedInOtherTab);
    expect(upsertCollection).toHaveBeenLastCalledWith('user-a', editedInOtherTab, 9500);
  });

  it('uploads an edit still pending when the tab is shown again, instead of adopting over it', async () => {
    const {result} = await renderSynced();
    // The hidden page's flush fails, so the edit is still owed when the tab comes back.
    vi.mocked(upsertCollection).mockResolvedValueOnce({data: null, error: 'Network error'});
    act(() => result.current.setCount('owned', 'foil', 2));
    await showPage('hidden');
    vi.mocked(getCollection).mockResolvedValueOnce(SERVER_ROW);
    await showPage('visible');

    expect(result.current.entries.owned).toEqual({normal: 3, foil: 2});
    expect(upsertCollection).toHaveBeenCalledTimes(2);
    expect(upsertCollection).toHaveBeenLastCalledWith(
      'user-a',
      {...ENTRIES, owned: {normal: 3, foil: 2}},
      result.current.importedAt,
    );
  });

  describe('copies shown where they belong (#880)', () => {
    /** `owned` as an alt foil, which comes in foil alone: its 3 normal copies show in its foil. */
    const altFoil = placementsFor([createCard({id: 'owned', rarity: 'Super Rare', finishes: ['foil']})], []);

    async function renderPlaced() {
      const view = renderHook(() => useCollection(), {
        wrapper: ({children}: {children: ReactNode}) => (
          <CollectionProvider placements={altFoil}>{children}</CollectionProvider>
        ),
      });
      await advance(0);
      return view;
    }

    it('shows them there, and never saves them there on its own', async () => {
      const {result} = await renderPlaced();

      expect(result.current.entries).toEqual({...ENTRIES, owned: {normal: 0, foil: 4}});
      expect(result.current.ownedCount('owned')).toBe(4);
      await advance(UPLOAD_DELAY_MS);
      expect(readCollection()?.entries).toEqual(ENTRIES);
      expect(upsertCollection).not.toHaveBeenCalled();
    });

    it('saves the count as shown once the player changes it, with nothing counted twice', async () => {
      const {result} = await renderPlaced();
      act(() => result.current.setCount('owned', 'foil', 5));

      const saved = {...ENTRIES, owned: {normal: 0, foil: 5}};
      expect(readCollection()?.entries).toEqual(saved);
      expect(result.current.entries).toEqual(saved);
      await advance(UPLOAD_DELAY_MS);
      expect(upsertCollection).toHaveBeenCalledWith('user-a', saved, 9000);
    });

    it("places a friend's copies as it places the player's own (#1045), and saves nothing of theirs", async () => {
      const {result} = await renderPlaced();
      const theirs = {owned: {normal: 2, foil: 0}, other: {normal: 1, foil: 0}};

      expect(result.current.place(theirs)).toEqual({owned: {normal: 0, foil: 2}, other: {normal: 1, foil: 0}});
      await advance(UPLOAD_DELAY_MS);
      expect(readCollection()?.entries).toEqual(ENTRIES);
      expect(upsertCollection).not.toHaveBeenCalled();
    });
  });
});
