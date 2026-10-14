import {describe, it, expect} from 'vitest';
import {getBounceRoles} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Bounce fixes from the 2026-10-14 misread review, kept out of rules.test.ts (CodeScene: function
// count). Real card text.

const bounceRule = getRuleById('bounce')!;
/** The Bounce pair `card` finds with `partner`, or undefined when they do not pair. */
const bouncePair = (card: LorcanaCard, partner: LorcanaCard) =>
  bounceRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// A deck look that only orders the deck, and one that puts a card into your hand.
const jafar = createCard({
  id: 'jafar-lamp-thief',
  name: 'Jafar',
  fullName: 'Jafar - Lamp Thief',
  ink: 'Amethyst',
  cost: 3,
  text: 'I AM YOUR MASTER NOW When you play this\ncharacter, look at the top 2 cards of your deck.\nPut one on the top of your deck and the other on\nthe bottom.',
});
const tinkerBell = createCard({
  id: 'tinker-bell-generous-fairy',
  name: 'Tinker Bell',
  fullName: 'Tinker Bell - Generous Fairy',
  cost: 4,
  text: 'MAKE A NEW FRIEND When you play this character,\nlook at the top 4 cards of your deck. You may reveal\na character card and put it into your hand. Put the\nrest on the bottom of your deck in any order.',
});
const motherKnowsBest = createCard({
  id: 'mother-knows-best',
  name: 'Mother Knows Best',
  fullName: 'Mother Knows Best',
  type: 'Action',
  ink: 'Emerald',
  cost: 3,
  text: "(A character with cost 3 or more can ⟳ to sing this\nsong for free.)\nReturn chosen character to their player's hand.",
});

describe('Bounce: a deck look as re-buy value', () => {
  it('reads it as re-buy value only when a card goes to your hand', () => {
    expect(getBounceRoles(jafar)).toEqual([]);
    expect(getBounceRoles(tinkerBell)).toEqual(['rebuy-payoff']);
  });

  it('pairs a bounce card only with the look that fills your hand', () => {
    expect(bouncePair(motherKnowsBest, jafar)).toBeUndefined();
    expect(bouncePair(motherKnowsBest, tinkerBell)?.score).toBe(8);
  });
});
