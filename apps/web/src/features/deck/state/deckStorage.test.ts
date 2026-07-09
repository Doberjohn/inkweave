import {describe, it, expect, beforeEach} from 'vitest';
import {
  DRAFT_KEY,
  readDraft,
  writeDraft,
  clearDraft,
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
});
