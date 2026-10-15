import {describe, it, expect} from 'vitest';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Free Play fixes from the 2026-10-14 misread review, kept out of rules.test.ts (CodeScene:
// function count). Real card text.

const freePlayRule = getRuleById('free-play')!;
/** The Free Play pair `card` finds with `partner`, or undefined when they do not pair. */
const freePlayPair = (card: LorcanaCard, partner: LorcanaCard) =>
  freePlayRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

const pocahontas = createCard({
  id: 'pocahontas-guiding-the-tribe',
  name: 'Pocahontas',
  fullName: 'Pocahontas - Guiding the Tribe',
  cost: 2,
  classifications: ['Storyborn', 'Hero', 'Princess'],
  text: 'STAY CLOSE When you play this character, you\nmay play a character with cost 1 for free.',
});
// An on-play drawback, and an on-play effect.
const gantu = createCard({
  id: 'gantu-hamsterviels-accomplice',
  name: 'Gantu',
  fullName: "Gantu - Hamsterviel's Accomplice",
  ink: 'Steel',
  cost: 1,
  classifications: ['Storyborn', 'Alien', 'Captain'],
  text: 'EASY TARGET When you play this character,\nchoose and discard a card.',
});
const berlioz = createCard({
  id: 'berlioz-tiny-rascal',
  name: 'Berlioz',
  fullName: 'Berlioz - Tiny Rascal',
  ink: 'Steel',
  cost: 1,
  classifications: ['Storyborn', 'Ally'],
  text: 'SHARP LITTLE CLAWS When you play this character,\nyou may deal 1 damage to chosen character.',
});

describe('Free Play: an on-play clause that only costs you', () => {
  it('scores the free body at 6, not as a two-for-one, from either side', () => {
    for (const pair of [freePlayPair(pocahontas, gantu), freePlayPair(gantu, pocahontas)]) {
      expect(pair?.score).toBe(6);
    }
    expect(freePlayPair(pocahontas, gantu)?.explanation).toBe('{A} plays {B} for free.');
  });

  it('keeps the 8 for an on-play effect', () => {
    expect(freePlayPair(pocahontas, berlioz)?.score).toBe(8);
  });
});
