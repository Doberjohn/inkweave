import {describe, it, expect} from 'vitest';
import type {Deck, LorcanaCard} from '../types';
import {createCard} from '../../../shared/test-utils';
import {
  addCardToDeck,
  clearDeckCards,
  deriveInks,
  inksEqual,
  markCardCore,
  removeCardFromDeck,
  renameDeckName,
  setCardQuantity,
  setDeckGameplan,
} from './deckMutations';

const cards: Record<string, LorcanaCard> = {
  amber: createCard({id: 'amber', ink: 'Amber'}),
  steel: createCard({id: 'steel', ink: 'Steel'}),
  dual: createCard({id: 'dual', ink: 'Sapphire', ink2: 'Amethyst'}),
};
const resolve = (id: string): LorcanaCard | undefined => cards[id];

function deck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: 'd1',
    name: 'Test',
    cards: [],
    inks: [],
    createdAt: 1,
    updatedAt: 1,
    schemaVersion: 1,
    ...overrides,
  };
}

describe('deriveInks', () => {
  it('returns a dual-ink card as BOTH inks, in canonical order', () => {
    expect(deriveInks([{cardId: 'dual', quantity: 1}], resolve)).toEqual(['Amethyst', 'Sapphire']);
  });

  it('dedupes and orders across multiple cards', () => {
    const list = [
      {cardId: 'steel', quantity: 1},
      {cardId: 'amber', quantity: 1},
      {cardId: 'amber', quantity: 1},
    ];
    expect(deriveInks(list, resolve)).toEqual(['Amber', 'Steel']);
  });

  it('skips ids that no longer resolve (rotated out of Core)', () => {
    expect(deriveInks([{cardId: 'ghost', quantity: 4}], resolve)).toEqual([]);
  });
});

describe('inksEqual', () => {
  it('is order-sensitive', () => {
    expect(inksEqual(['Amber', 'Steel'], ['Amber', 'Steel'])).toBe(true);
    expect(inksEqual(['Amber', 'Steel'], ['Steel', 'Amber'])).toBe(false);
    expect(inksEqual(['Amber'], ['Amber', 'Steel'])).toBe(false);
  });
});

describe('addCardToDeck', () => {
  it('creates a new line then increments the existing one', () => {
    const once = addCardToDeck(deck(), 'amber', resolve);
    expect(once.cards).toEqual([{cardId: 'amber', quantity: 1}]);
    const twice = addCardToDeck(once, 'amber', resolve);
    expect(twice.cards).toEqual([{cardId: 'amber', quantity: 2}]);
  });

  it('re-derives inks from the new card list', () => {
    expect(addCardToDeck(deck(), 'dual', resolve).inks).toEqual(['Amethyst', 'Sapphire']);
  });
});

describe('setCardQuantity', () => {
  it('sets an exact count, adding a line when absent', () => {
    expect(setCardQuantity(deck(), 'amber', 3, resolve).cards).toEqual([{cardId: 'amber', quantity: 3}]);
  });

  it('removes the line when quantity <= 0', () => {
    const d = deck({cards: [{cardId: 'amber', quantity: 2}], inks: ['Amber']});
    const cleared = setCardQuantity(d, 'amber', 0, resolve);
    expect(cleared.cards).toEqual([]);
    expect(cleared.inks).toEqual([]);
  });
});

describe('removeCardFromDeck', () => {
  it('drops the line entirely and re-derives inks', () => {
    const d = deck({cards: [{cardId: 'amber', quantity: 1}, {cardId: 'steel', quantity: 1}], inks: ['Amber', 'Steel']});
    const result = removeCardFromDeck(d, 'steel', resolve);
    expect(result.cards).toEqual([{cardId: 'amber', quantity: 1}]);
    expect(result.inks).toEqual(['Amber']);
  });
});

describe('markCardCore', () => {
  it('flags the matching line without touching inks', () => {
    const d = deck({cards: [{cardId: 'amber', quantity: 1}], inks: ['Amber']});
    expect(markCardCore(d, 'amber', true).cards).toEqual([{cardId: 'amber', quantity: 1, isCore: true}]);
  });
});

describe('setDeckGameplan / renameDeckName / clearDeckCards', () => {
  it('sets the gameplan override', () => {
    expect(setDeckGameplan(deck(), 'ramp').gameplan).toBe('ramp');
  });

  it('renames the deck', () => {
    expect(renameDeckName(deck(), 'Amber Aggro').name).toBe('Amber Aggro');
  });

  it('empties the card list and inks, keeping identity', () => {
    const d = deck({id: 'keep', cards: [{cardId: 'amber', quantity: 4}], inks: ['Amber']});
    const cleared = clearDeckCards(d);
    expect(cleared.id).toBe('keep');
    expect(cleared.cards).toEqual([]);
    expect(cleared.inks).toEqual([]);
  });
});
