import {describe, it, expect, beforeEach} from 'vitest';
import {
  DRAFT_KEY,
  DIRTY_KEY,
  readDraft,
  writeDraft,
  clearDraft,
  readDirty,
  writeDirty,
  hasMigratedDraft,
  markDraftMigrated,
} from './deckStorage';
import type {Deck} from '../types';

function makeDeck(over: Partial<Deck> = {}): Deck {
  return {
    id: 'deck-1',
    name: 'My Deck',
    cards: [{cardId: 'c1', quantity: 4}],
    inks: ['Amber'],
    createdAt: 1000,
    updatedAt: 2000,
    schemaVersion: 1,
    ...over,
  };
}

describe('deckStorage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a draft under the namespaced key', () => {
    const deck = makeDeck();
    writeDraft(deck);
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    expect(readDraft()).toEqual(deck);
  });

  it('returns null when no draft is stored', () => {
    expect(readDraft()).toBeNull();
  });

  it('clears the key and returns null on corrupt JSON', () => {
    localStorage.setItem(DRAFT_KEY, '{not valid json');
    expect(readDraft()).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('clears the key and returns null on a schemaVersion mismatch', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({...makeDeck(), schemaVersion: 99}));
    expect(readDraft()).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('clearDraft removes the key', () => {
    writeDraft(makeDeck());
    clearDraft();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('migration guard is idempotent per user and independent across users', () => {
    expect(hasMigratedDraft('uid-a')).toBe(false);
    markDraftMigrated('uid-a');
    expect(hasMigratedDraft('uid-a')).toBe(true);
    markDraftMigrated('uid-a'); // idempotent — marking again stays true
    expect(hasMigratedDraft('uid-a')).toBe(true);
    expect(hasMigratedDraft('uid-b')).toBe(false); // other users unaffected
  });

  describe('dirty flag', () => {
    it('round-trips through localStorage', () => {
      expect(readDirty()).toBe(false);
      writeDirty(true);
      expect(readDirty()).toBe(true);
      writeDirty(false);
      expect(readDirty()).toBe(false);
    });

    it('reads false when the key holds junk', () => {
      localStorage.setItem(DIRTY_KEY, 'not-a-bool');
      expect(readDirty()).toBe(false);
    });

    it('clearDraft drops the flag too, so a fresh draft never starts dirty', () => {
      writeDirty(true);
      clearDraft();
      expect(readDirty()).toBe(false);
    });

    it('a discarded corrupt draft also drops the flag', () => {
      localStorage.setItem(DRAFT_KEY, '{not json');
      writeDirty(true);
      expect(readDraft()).toBeNull();
      expect(readDirty()).toBe(false);
    });
  });
});
