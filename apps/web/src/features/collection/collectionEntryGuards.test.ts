import {describe, expect, it} from 'vitest';
import {isCollectionEntries} from './collectionEntryGuards';

/*
  Tested directly because it guards TWO doors onto the same data: the stored
  collection and the server row. `collectionRepository` has no test file of its
  own, since there is no Supabase harness, so exercising the shared guard here is
  what covers the server path's logic.
*/
describe('isCollectionEntries', () => {
  it('accepts a well-formed map, the empty map included', () => {
    expect(isCollectionEntries({})).toBe(true);
    expect(isCollectionEntries({'2001': {normal: 2, foil: 0}})).toBe(true);
  });

  it('rejects a null entry, which an absence guard would pass straight through', () => {
    expect(isCollectionEntries({'2001': null})).toBe(false);
  });

  it('rejects an array, which is an object and would read as an empty collection', () => {
    expect(isCollectionEntries([])).toBe(false);
  });

  it('rejects counts that are negative, fractional, NaN or beyond safe integers', () => {
    expect(isCollectionEntries({'2001': {normal: -1, foil: 0}})).toBe(false);
    expect(isCollectionEntries({'2001': {normal: 1.5, foil: 0}})).toBe(false);
    expect(isCollectionEntries({'2001': {normal: Number.NaN, foil: 0}})).toBe(false);
    expect(isCollectionEntries({'2001': {normal: 0, foil: 2 ** 53}})).toBe(false);
  });

  it('rejects an entry missing a finish rather than reading it as zero', () => {
    expect(isCollectionEntries({'2001': {normal: 2}})).toBe(false);
  });

  it('rejects two safe counts whose TOTAL is not safe', () => {
    // Each field passes on its own; `totalOwned` folds them, and that sum is the
    // number every consumer reads. Validating the fields but not the total
    // certifies an entry whose own answer is already imprecise.
    const entries = {'2001': {normal: Number.MAX_SAFE_INTEGER, foil: 2}};
    expect(isCollectionEntries(entries)).toBe(false);
  });
});
