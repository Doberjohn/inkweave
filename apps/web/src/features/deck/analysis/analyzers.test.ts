import {describe, it, expect} from 'vitest';
import {buildHealthAnalyzers} from './analyzers';
import {calculateDeckStats} from './deckStats';
import type {Archetype, Deck, HealthAnalyzer, LorcanaCard} from '../types';
import {createCard} from '../../../shared/test-utils';

/** Resolve deck cardIds from a fixed card list; unknown ids return undefined. */
function makeResolver(cards: LorcanaCard[]) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return (id: string) => byId.get(id);
}

/** Assemble a minimal Deck from [card, quantity] entries. */
function makeDeck(entries: Array<[LorcanaCard, number]>): Deck {
  return {
    id: 'deck-1',
    name: 'Test Deck',
    cards: entries.map(([card, quantity]) => ({cardId: card.id, quantity})),
    inks: [],
    createdAt: 0,
    updatedAt: 0,
    schemaVersion: 1,
  };
}

/** N distinct cards sharing the given overrides (unique id + fullName per index). */
function genCards(n: number, prefix: string, over: Partial<LorcanaCard>): LorcanaCard[] {
  return Array.from({length: n}, (_, i) =>
    createCard({id: `${prefix}-${i}`, fullName: `${prefix} ${i}`, ...over}),
  );
}

/** Build the analyzer list for a deck + archetype in one call. */
function analyze(entries: Array<[LorcanaCard, number]>, archetype: Archetype): HealthAnalyzer[] {
  const deck = makeDeck(entries);
  const cards = entries.map(([c]) => c);
  const resolver = makeResolver(cards);
  return buildHealthAnalyzers(deck, calculateDeckStats(deck, resolver), resolver, archetype);
}

/** Find a specific analyzer by id. */
function byId(analyzers: HealthAnalyzer[], id: string): HealthAnalyzer {
  const found = analyzers.find((a) => a.id === id);
  if (!found) throw new Error(`analyzer '${id}' not found`);
  return found;
}

/** 60 characters, no removal / draw / shift — a body-only midrange shell. */
function bodyOnlyDeck(): Array<[LorcanaCard, number]> {
  return [
    ...genCards(4, 'body2', {type: 'Character', cost: 2, lore: 2}),
    ...genCards(4, 'body3', {type: 'Character', cost: 3, lore: 2}),
    ...genCards(4, 'body4', {type: 'Character', cost: 4, lore: 2}),
    ...genCards(3, 'body5', {type: 'Character', cost: 5, lore: 3}),
  ].map((c) => [c, 4] as [LorcanaCard, number]);
}

describe('buildHealthAnalyzers', () => {
  it('returns one analyzer per dimension, each with a 0..100 score and a valid status', () => {
    const analyzers = analyze(bodyOnlyDeck(), 'midrange');

    expect(analyzers.map((a) => a.id)).toEqual([
      'curve',
      'inkable',
      'draw',
      'removal',
      'actionsCap',
      'typeMix',
      'ruleOfEight',
      'consistency',
      'lore',
      'shiftCoverage',
    ]);

    for (const a of analyzers) {
      expect(a.score).toBeGreaterThanOrEqual(0);
      expect(a.score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(a.score)).toBe(true);
      expect(['good', 'warn', 'bad']).toContain(a.status);
      expect(a.message.length).toBeGreaterThan(0);
    }
  });

  it('flags removal when a midrange deck runs no interaction', () => {
    const removal = byId(analyze(bodyOnlyDeck(), 'midrange'), 'removal');
    expect(removal.value).toBe(0);
    expect(removal.status).toBe('bad');
    expect(removal.message.toLowerCase()).toContain('removal');
  });

  it('does NOT penalize a ramp deck on curve (validates the curve-jump instead)', () => {
    const rampEntries: Array<[LorcanaCard, number]> = [
      ...genCards(3, 'ramp-src', {
        type: 'Item',
        cost: 2,
        text: 'Put the top card of your deck into your inkwell.',
      }),
      ...genCards(2, 'ramp-src2', {
        type: 'Item',
        cost: 3,
        text: 'Look at the top 2 cards of your deck. You may put one into your inkwell.',
      }),
      ...genCards(3, 'ramp-big', {type: 'Character', cost: 7, lore: 3, willpower: 7}),
      ...genCards(2, 'ramp-big2', {type: 'Character', cost: 8, lore: 3, willpower: 8}),
      ...genCards(3, 'ramp-mid', {type: 'Character', cost: 4, lore: 2}),
      ...genCards(2, 'ramp-early', {type: 'Character', cost: 2, lore: 1}),
    ].map((c) => [c, 4] as [LorcanaCard, number]);

    const rampCurve = byId(analyze(rampEntries, 'ramp'), 'curve');
    const midCurve = byId(analyze(rampEntries, 'midrange'), 'curve');

    // Same top-heavy deck: ramp validates it (good), midrange penalizes the gap.
    expect(rampCurve.status).toBe('good');
    expect(rampCurve.score).toBeGreaterThan(midCurve.score);
  });

  it('flags shift-coverage when a Shift card has no same-named base in the deck', () => {
    const shifter = createCard({
      id: 'shift-elsa',
      name: 'Elsa',
      fullName: 'Elsa - Spirit of Winter',
      type: 'Character',
      cost: 6,
      lore: 3,
      keywords: ['Shift 4'],
    });
    const filler = genCards(14, 'filler', {type: 'Character', cost: 3, lore: 2});
    const entries: Array<[LorcanaCard, number]> = [shifter, ...filler].map(
      (c) => [c, 4] as [LorcanaCard, number],
    );

    const coverage = byId(analyze(entries, 'midrange'), 'shiftCoverage');
    expect(coverage.value).toBe(1); // one uncovered Shift card
    expect(coverage.status).toBe('bad');
  });

  it('passes shift-coverage once the same-named base body is present', () => {
    const shifter = createCard({
      id: 'shift-elsa',
      name: 'Elsa',
      fullName: 'Elsa - Spirit of Winter',
      type: 'Character',
      cost: 6,
      lore: 3,
      keywords: ['Shift 4'],
    });
    const base = createCard({
      id: 'base-elsa',
      name: 'Elsa',
      fullName: 'Elsa - Snow Queen',
      type: 'Character',
      cost: 4,
      lore: 2,
    });
    const filler = genCards(13, 'filler', {type: 'Character', cost: 3, lore: 2});
    const entries: Array<[LorcanaCard, number]> = [shifter, base, ...filler].map(
      (c) => [c, 4] as [LorcanaCard, number],
    );

    const coverage = byId(analyze(entries, 'midrange'), 'shiftCoverage');
    expect(coverage.value).toBe(0);
    expect(coverage.status).toBe('good');
  });
});
