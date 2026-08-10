import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import type {ReactNode} from 'react';
import {CollectionProvider, useCollection} from './CollectionContext';
import {COLLECTION_KEY, writeCollection} from './collectionStorage';
import type {CollectionEntries} from './collectionParser';

const ENTRIES: CollectionEntries = {
  owned: {normal: 3, foil: 1},
  single: {normal: 1, foil: 0},
};

function wrapper({children}: {children: ReactNode}) {
  return <CollectionProvider>{children}</CollectionProvider>;
}

const render = () => renderHook(() => useCollection(), {wrapper});

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('CollectionContext', () => {
  it('starts with no collection when nothing is stored', () => {
    const {result} = render();
    expect(result.current.hasCollection).toBe(false);
    expect(result.current.entries).toEqual({});
    expect(result.current.importedAt).toBeNull();
  });

  it('restores a stored collection on mount', () => {
    writeCollection(ENTRIES, 5000);
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
    writeCollection(ENTRIES, 5000);
    const {result} = render();
    act(() => {
      result.current.importCollection({other: {normal: 2, foil: 0}}, 9000);
    });
    expect(result.current.entries).toEqual({other: {normal: 2, foil: 0}});
    expect(result.current.ownedCount('owned')).toBe(0);
  });

  it('ownedCount folds both finishes, and is 0 for a card not in the collection', () => {
    writeCollection(ENTRIES, 5000);
    const {result} = render();
    expect(result.current.ownedCount('owned')).toBe(4);
    expect(result.current.ownedCount('absent')).toBe(0);
  });

  it('owns is true at a single copy, not only at a playset', () => {
    writeCollection(ENTRIES, 5000);
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
    writeCollection(ENTRIES, 5000);
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
