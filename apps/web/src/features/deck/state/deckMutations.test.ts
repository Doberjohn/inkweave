import {describe, it, expect} from 'vitest';
import type {Deck, LorcanaCard} from '../types';
import {createCard} from '../../../shared/test-utils';
import {
  addCardToDeck,
  clearDeckCards,
  deckFingerprint,
  deriveInks,
  inksEqual,
  isDeckUnsaved,
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

describe('deckFingerprint', () => {
  // The whole reason dirtiness is derived: a hand-set flag stays raised here, so
  // the user is warned about discarding changes they already undid.
  it('is unchanged when an edit is reverted', () => {
    const start = deck();
    const added = addCardToDeck(start, 'amber', resolve);
    const reverted = removeCardFromDeck(added, 'amber', resolve);
    expect(deckFingerprint(reverted)).toBe(deckFingerprint(start));
  });

  it('ignores card ORDER, which is an artifact of edit history', () => {
    const a = deck({cards: [{cardId: 'amber', quantity: 2}, {cardId: 'steel', quantity: 1}]});
    const b = deck({cards: [{cardId: 'steel', quantity: 1}, {cardId: 'amber', quantity: 2}]});
    expect(deckFingerprint(a)).toBe(deckFingerprint(b));
  });

  // updatedAt moves on every keystroke; including it would make every deck
  // permanently unsaved. inks are derived from cards, so they add nothing.
  it('ignores updatedAt and derived inks', () => {
    const a = deck({updatedAt: 1, inks: []});
    const b = deck({updatedAt: 999_999, inks: ['Amber']});
    expect(deckFingerprint(a)).toBe(deckFingerprint(b));
  });

  it('changes on quantity, name, core flag, gameplan and visibility', () => {
    const base = deck({cards: [{cardId: 'amber', quantity: 2}]});
    const fp = deckFingerprint(base);
    expect(deckFingerprint({...base, cards: [{cardId: 'amber', quantity: 3}]})).not.toBe(fp);
    expect(deckFingerprint({...base, cards: [{cardId: 'amber', quantity: 2, isCore: true}]})).not.toBe(fp);
    expect(deckFingerprint({...base, name: 'Renamed'})).not.toBe(fp);
    expect(deckFingerprint({...base, gameplan: 'ramp'})).not.toBe(fp);
    expect(deckFingerprint({...base, isPublic: true})).not.toBe(fp);
  });
});

describe('isDeckUnsaved', () => {
  it('treats a never-saved EMPTY deck as clean, so Save stays dim on a fresh deck', () => {
    expect(isDeckUnsaved(deck(), null)).toBe(false);
  });

  it('treats a never-saved deck WITH cards as unsaved', () => {
    expect(isDeckUnsaved(deck({cards: [{cardId: 'amber', quantity: 1}]}), null)).toBe(true);
  });

  it('is clean when the deck still matches what the cloud took', () => {
    const d = deck({cards: [{cardId: 'amber', quantity: 2}]});
    expect(isDeckUnsaved(d, deckFingerprint(d))).toBe(false);
  });

  it('is unsaved once an edit lands, and clean again when it is undone', () => {
    const saved = deck({cards: [{cardId: 'amber', quantity: 2}]});
    const fp = deckFingerprint(saved);
    const edited = addCardToDeck(saved, 'steel', resolve);
    expect(isDeckUnsaved(edited, fp)).toBe(true);
    expect(isDeckUnsaved(removeCardFromDeck(edited, 'steel', resolve), fp)).toBe(false);
  });
});
