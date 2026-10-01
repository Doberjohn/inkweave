import {describe, it, expect} from 'vitest';
import {aggregateDeckSynergy, type PairScore} from './deckSynergy';
import type {Deck} from '../types';

/** Minimal deck from a list of card ids (deckSynergy only reads `cards[].cardId`). */
function makeDeck(ids: string[]): Deck {
  return {
    id: 'd1',
    name: 'Deck',
    cards: ids.map((cardId) => ({cardId, quantity: 4})),
    inks: [],
    createdAt: 0,
    updatedAt: 0,
    schemaVersion: 1,
  };
}

/** Symmetric pair-score lookup from an unordered-pair table (`'A|B'` keys, sorted). */
function fixtureScores(table: Record<string, number>): PairScore {
  return (a, b) => table[[a, b].sort().join('|')] ?? 0;
}

describe('aggregateDeckSynergy', () => {
  it('counts connections and picks hubs / islands from a fixture', () => {
    // A wires to B/C/D; B-C also connect; E is isolated.
    const scores = fixtureScores({'A|B': 8, 'A|C': 6, 'A|D': 5, 'B|C': 7});
    const result = aggregateDeckSynergy(makeDeck(['A', 'B', 'C', 'D', 'E']), scores);

    expect(result.connectionCounts).toEqual({A: 3, B: 2, C: 2, D: 1, E: 0});
    // avg degree = 1.6 → A(3), B(2), C(2) are above-average hubs (ties by id).
    expect(result.keyCards).toEqual(['A', 'B', 'C']);
    // <= 1 connection, weakest first: E(0) then D(1).
    expect(result.weakLinks).toEqual(['E', 'D']);
    // total 26 over 10 pairs × max 10 → 26% density.
    expect(result.overallScore).toBe(26);
  });

  it('normalizes a fully-connected max deck to 100 with no hubs or islands', () => {
    const scores = fixtureScores({'A|B': 10, 'A|C': 10, 'B|C': 10});
    const result = aggregateDeckSynergy(makeDeck(['A', 'B', 'C']), scores);

    expect(result.overallScore).toBe(100);
    expect(result.keyCards).toEqual([]); // every card sits exactly at the average
    expect(result.weakLinks).toEqual([]); // every card has 2 connections
  });

  it('deduplicates repeated card ids into one distinct card', () => {
    const deck: Deck = {
      ...makeDeck(['A', 'B']),
      cards: [
        {cardId: 'A', quantity: 2},
        {cardId: 'A', quantity: 2},
        {cardId: 'B', quantity: 4},
      ],
    };

    const result = aggregateDeckSynergy(deck, fixtureScores({'A|B': 6}));

    expect(result.connectionCounts).toEqual({A: 1, B: 1});
    expect(result.overallScore).toBe(60); // one pair scoring 6 of a possible 10
  });

  it('handles a single-card deck without dividing by zero', () => {
    const result = aggregateDeckSynergy(makeDeck(['solo']), () => 5);

    expect(result.overallScore).toBe(0);
    expect(result.keyCards).toEqual([]);
    expect(result.weakLinks).toEqual(['solo']);
    expect(result.connectionCounts).toEqual({solo: 0});
  });
});
