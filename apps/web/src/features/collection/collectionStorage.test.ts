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
