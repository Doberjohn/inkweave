import {afterEach, describe, expect, it, vi} from 'vitest';
import {COLLECTION_KEY, clearCollection, readCollection, writeCollection} from './collectionStorage';
import type {CollectionEntries} from './collectionParser';

const ENTRIES: CollectionEntries = {'2001': {normal: 3, foil: 1}};

describe('collectionStorage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('round-trips a collection under the namespaced key', () => {
    writeCollection(ENTRIES, 1000);
    expect(readCollection()).toEqual({schemaVersion: 1, importedAt: 1000, entries: ENTRIES});
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
    A null VALUE, not a null container. `holdingOf` in `collectionStats` guards
    `entry === undefined`, which is correct for a card nobody owns, and null is
    not undefined: a stored null reaches `entry.normal` and throws, taking the
    binder down. Validating the container alone let this through.
  */
  it('discards a collection whose entries hold a null', () => {
    localStorage.setItem(
      COLLECTION_KEY,
      JSON.stringify({schemaVersion: 1, importedAt: 1, entries: {'2001': null}}),
    );
    expect(readCollection()).toBeNull();
  });

  it('discards an entry missing a finish count rather than reading it as zero', () => {
    localStorage.setItem(
      COLLECTION_KEY,
      JSON.stringify({schemaVersion: 1, importedAt: 1, entries: {'2001': {normal: 2}}}),
    );
    expect(readCollection()).toBeNull();
  });

  it('clearCollection removes the key', () => {
    writeCollection(ENTRIES, 1000);
    clearCollection();
    expect(readCollection()).toBeNull();
  });

  it('stamps the schema version itself rather than trusting the caller', () => {
    const {data, error} = writeCollection(ENTRIES, 1000);
    expect(error).toBeNull();
    expect(data?.schemaVersion).toBe(1);
  });

  it('reports an error rather than failing silently when the write is refused', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('exceeded the quota', 'QuotaExceededError');
    });
    const {data, error} = writeCollection(ENTRIES, 1000);
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });
});
