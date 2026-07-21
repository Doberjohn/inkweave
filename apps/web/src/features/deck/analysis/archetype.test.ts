import {describe, it, expect} from 'vitest';
import {classifyArchetype} from './archetype';
import {calculateDeckStats} from './deckStats';
import type {Deck, LorcanaCard} from '../types';
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

/** Turn card groups into a 4-of deck (each distinct card contributes 4 copies). */
function fourOfDeck(...groups: LorcanaCard[][]): {deck: Deck; cards: LorcanaCard[]} {
  const cards = groups.flat();
  const deck = makeDeck(cards.map((c) => [c, 4] as [LorcanaCard, number]));
  return {deck, cards};
}

function classify(deck: Deck, cards: LorcanaCard[]) {
  const resolver = makeResolver(cards);
  return classifyArchetype(calculateDeckStats(deck, resolver), deck, resolver);
}

describe('classifyArchetype', () => {
  it('detects aggro: low curve, character-dense, light removal', () => {
    const {deck, cards} = fourOfDeck(
      genCards(5, 'aggro-1', {type: 'Character', cost: 1, lore: 1}),
      genCards(6, 'aggro-2', {type: 'Character', cost: 2, lore: 2}),
      genCards(3, 'aggro-3', {type: 'Character', cost: 3, lore: 2}),
      genCards(1, 'aggro-rm', {type: 'Action', cost: 2, inkwell: false, text: 'Banish chosen character.'}),
    );

    const {archetype, confidence} = classify(deck, cards);
    expect(archetype).toBe('aggro');
    expect(confidence).toBeGreaterThan(0.1);
    expect(confidence).toBeLessThanOrEqual(1);
  });

  it('detects control: high curve, removal-and-draw heavy, low own-lore', () => {
    const {deck, cards} = fourOfDeck(
      genCards(3, 'ctrl-wall', {type: 'Character', cost: 5, lore: 1, willpower: 6}),
      genCards(2, 'ctrl-finish', {type: 'Character', cost: 7, lore: 1, willpower: 7}),
      genCards(5, 'ctrl-rm', {type: 'Action', cost: 3, inkwell: false, text: 'Banish chosen character.'}),
      genCards(3, 'ctrl-draw', {type: 'Action', cost: 2, text: 'Draw 2 cards.'}),
      genCards(2, 'ctrl-rm2', {
        type: 'Action',
        cost: 4,
        inkwell: false,
        text: 'Banish chosen character with cost 3 or less.',
      }),
    );

    const {archetype, confidence} = classify(deck, cards);
    expect(archetype).toBe('control');
    expect(confidence).toBeGreaterThan(0.1);
  });

  // Regression (#472): a low-curve, removal-AND-draw-heavy, character-dense deck is
  // tempo — it used to mis-read as aggro because aggro over-scored universal board
  // lore and tempo's removal band was too narrow to credit 16 removal/60.
  it('detects tempo: low-mid curve, removal-and-draw heavy, character-dense', () => {
    const {deck, cards} = fourOfDeck(
      genCards(2, 'tempo-c2', {type: 'Character', cost: 2, lore: 2}),
      genCards(5, 'tempo-c3', {type: 'Character', cost: 3, lore: 2}),
      genCards(2, 'tempo-c4', {type: 'Character', cost: 4, lore: 2}),
      genCards(4, 'tempo-rm', {type: 'Action', cost: 3, inkwell: false, text: 'Banish chosen character.'}),
      genCards(2, 'tempo-draw', {type: 'Action', cost: 3, text: 'Draw 2 cards.'}),
    );

    const {archetype, confidence} = classify(deck, cards);
    expect(archetype).toBe('tempo');
    expect(confidence).toBeGreaterThan(0.1);
  });

  it('detects ramp: inkwell-ramp sources into a top-heavy payoff', () => {
    const {deck, cards} = fourOfDeck(
      genCards(3, 'ramp-src', {
        type: 'Item',
        cost: 2,
        text: 'Put the top card of your deck into your inkwell.',
      }),
      genCards(2, 'ramp-src2', {
        type: 'Item',
        cost: 3,
        text: 'Look at the top 2 cards of your deck. You may put one into your inkwell.',
      }),
      genCards(3, 'ramp-big', {type: 'Character', cost: 7, lore: 3, willpower: 7}),
      genCards(2, 'ramp-big2', {type: 'Character', cost: 8, lore: 3, willpower: 8}),
      genCards(3, 'ramp-mid', {type: 'Character', cost: 4, lore: 2}),
      genCards(2, 'ramp-early', {type: 'Character', cost: 2, lore: 1}),
    );

    const {archetype, confidence} = classify(deck, cards);
    expect(archetype).toBe('ramp');
    expect(confidence).toBeGreaterThan(0.1);
  });

  it('defaults to midrange with zero confidence on an empty deck', () => {
    const deck = makeDeck([]);
    const {archetype, confidence} = classify(deck, []);
    expect(archetype).toBe('midrange');
    expect(confidence).toBe(0);
  });
});
