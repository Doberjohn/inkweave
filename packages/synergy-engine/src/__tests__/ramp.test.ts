import {describe, it, expect} from 'vitest';
import {getRampRoles} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Ramp fixes from the 2026-10-14 misread review, kept out of rules.test.ts (CodeScene: function
// count). Real card text.

const rampRule = getRuleById('ramp')!;
/** The Ramp pair `card` finds with `partner`, or undefined when they do not pair. */
const rampPair = (card: LorcanaCard, partner: LorcanaCard) =>
  rampRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// Discounts for the cards of one name.
const munchings = createCard({
  id: 'munchings-and-crunchings',
  name: 'Munchings and Crunchings',
  fullName: 'Munchings and Crunchings',
  type: 'Item',
  text: 'WHAT A JUICY APPLE ⟳ — Remove up to 2 damage\nfrom chosen character.\nCOME ON OUT You pay 1 ⬡ less to play characters\nnamed Gurgi.',
});
const carl = createCard({
  id: 'carl-fredricksen-loving-husband',
  name: 'Carl Fredricksen',
  fullName: 'Carl Fredricksen - Loving Husband',
  ink: 'Emerald',
  text: 'TAKE MY HAND When you play this character, you\npay 2 ⬡ less for the next character named Ellie\nFredricksen you play this turn.',
});
const pluto = createCard({
  id: 'pluto-friendly-pooch',
  name: 'Pluto',
  fullName: 'Pluto - Friendly Pooch',
  text: 'GOOD DOG ⟳ — You pay 1 ⬡ less for the next\ncharacter you play this turn.',
});

describe('Ramp: a discount for the cards of one name', () => {
  it('reads no cost reduction from it', () => {
    expect(getRampRoles(munchings)).toEqual([]);
    expect(getRampRoles(carl)).toEqual([]);
    expect(getRampRoles(pluto)).toEqual(['cost-reduction']);
  });

  it('does not pair it with a general discount', () => {
    expect(rampPair(carl, pluto)).toBeUndefined();
    expect(rampPair(pluto, munchings)).toBeUndefined();
  });
});
