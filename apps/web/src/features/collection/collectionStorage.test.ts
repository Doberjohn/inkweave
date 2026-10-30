import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  COLLECTION_KEY,
  clearCollection,
  clearDeleteTombstone,
  clearUploadPending,
  hasDeleteTombstone,
  markDeleteTombstone,
  markUploadPending,
  pendingUploadImportedAt,
  readCollection,
  writeCollection,
} from './collectionStorage';
import type {CollectionEntries} from './collectionParser';

const mockReport = vi.hoisted(() => vi.fn());
vi.mock('../../shared/lib/reportFailure', () => ({reportFailure: mockReport}));

const ENTRIES: CollectionEntries = {'2001': {normal: 3, foil: 1}};

describe('collectionStorage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('round-trips a collection under the namespaced key', () => {
    writeCollection(ENTRIES, 1000, null, 'import');
    expect(readCollection()).toEqual({
      schemaVersion: 1,
      importedAt: 1000,
      entries: ENTRIES,
      ownerUid: null,
      source: 'import',
    });
  });

  it('returns null when nothing is stored', () => {
    expect(readCollection()).toBeNull();
  });

  it('clears the key and returns null on corrupt JSON', () => {
    localStorage.setItem(COLLECTION_KEY, '{not valid json');
    expect(readCollection()).toBeNull();
    expect(localStorage.getItem(COLLECTION_KEY)).toBeNull();
  });

  it('discards a collection written by a different schema version', () => {
    localStorage.setItem(
      COLLECTION_KEY,
      JSON.stringify({schemaVersion: 99, importedAt: 1000, entries: ENTRIES}),
    );
    expect(readCollection()).toBeNull();
    expect(localStorage.getItem(COLLECTION_KEY)).toBeNull();
  });

  it('discards an array stored where the entries Record belongs', () => {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify({schemaVersion: 1, importedAt: 1, entries: []}));
    expect(readCollection()).toBeNull();
  });

  /*
    Proves the value guard is WIRED IN here, not that it works: `isCollectionEntries`
    carries its own cases in `collectionParser.test.ts`, and repeating them would be
    two suites to update for one rule.

    A stored null is the case worth pinning at this layer, because it is the one that
    reached production code: `holdingOf` in `collectionStats` guards
    `entry === undefined`, and null is not undefined, so it hit `entry.normal` and
    took the binder down.
  */
  it('discards a collection whose entry values are malformed', () => {
    localStorage.setItem(
      COLLECTION_KEY,
      JSON.stringify({schemaVersion: 1, importedAt: 1, entries: {'2001': null}}),
    );
    expect(readCollection()).toBeNull();
  });

  it('clearCollection removes the key', () => {
    writeCollection(ENTRIES, 1000, null, 'import');
    clearCollection();
    expect(readCollection()).toBeNull();
  });

  it('stamps the schema version itself rather than trusting the caller', () => {
    const {data, error} = writeCollection(ENTRIES, 1000, null, 'import');
    expect(error).toBeNull();
    expect(data?.schemaVersion).toBe(1);
  });

  it('reports an error rather than failing silently when the write is refused', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('exceeded the quota', 'QuotaExceededError');
    });
    const {data, error} = writeCollection(ENTRIES, 1000, null, 'import');
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });

  it('loads a pre-#739 store as an anonymous import', () => {
    // Reading it as `'server'` would silently suppress a first upload.
    localStorage.setItem(COLLECTION_KEY, JSON.stringify({schemaVersion: 1, importedAt: 1, entries: ENTRIES}));
    expect(readCollection()).toMatchObject({ownerUid: null, source: 'import'});
  });

  it('discards a store whose source is neither import nor server', () => {
    localStorage.setItem(
      COLLECTION_KEY,
      JSON.stringify({schemaVersion: 1, importedAt: 1, entries: ENTRIES, ownerUid: null, source: 'cloud'}),
    );
    expect(readCollection()).toBeNull();
  });
});

describe('collection markers', () => {
  afterEach(() => localStorage.clear());

  it('a pending clear for an older copy keeps the newer copy pending', () => {
    // Uploads are queued: the first can confirm after a second import re-marked.
    markUploadPending('u', 2000);
    clearUploadPending('u', 1000);
    expect(pendingUploadImportedAt('u')).toBe(2000);
  });

  it("a tombstone is cleared only by the delete that set it", () => {
    const first = markDeleteTombstone('u');
    markDeleteTombstone('u');
    clearDeleteTombstone('u', first);
    expect(hasDeleteTombstone('u')).toBe(true);
  });
});

// The page handles each of these quietly (the 2026-10-06 rulings keep the markers silent), so
// Sentry is the only one told.
describe('storage failures', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  const quota = new DOMException('exceeded the quota', 'QuotaExceededError');

  it.each([
    {operation: 'read binder', method: 'getItem', act: () => readCollection()},
    {operation: 'store binder', method: 'setItem', act: () => writeCollection(ENTRIES, 1000, null, 'import')},
    {operation: 'clear binder', method: 'removeItem', act: () => clearCollection()},
    // The uid is only in the key: the operation names the marker, never whose it is.
    {operation: 'inkweave:collection:pending marker', method: 'setItem', act: () => markUploadPending('u', 1000)},
    {operation: 'inkweave:collection:pending marker', method: 'getItem', act: () => pendingUploadImportedAt('u')},
  ] as const)('reports the browser refusing $method as $operation', ({operation, method, act}) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw quota;
    });

    act();

    expect(mockReport).toHaveBeenCalledWith({area: 'collection', operation, storage: true}, quota);
  });

  it.each([
    {copy: 'corrupt JSON', stored: '{not valid json'},
    {copy: 'an unexpected shape', stored: JSON.stringify({schemaVersion: 1, importedAt: 1000, entries: []})},
  ])('reports a stored copy lost to $copy', ({stored}) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(COLLECTION_KEY, stored);

    readCollection();

    expect(mockReport).toHaveBeenCalledWith({area: 'collection', operation: 'read binder'}, expect.any(Error));
  });

  // A schema change drops every stored copy on purpose: reported, it would be one error per collector.
  it('reports no copy that another schema version wrote', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(COLLECTION_KEY, JSON.stringify({schemaVersion: 99, importedAt: 1000, entries: ENTRIES}));

    readCollection();

    expect(mockReport).not.toHaveBeenCalled();
  });
});
