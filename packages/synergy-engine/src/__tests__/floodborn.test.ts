import {describe, it, expect} from 'vitest';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Floodborn fixes from the 2026-10-14 misread review, kept out of rules.test.ts (CodeScene:
// function count). Real card text.

const floodbornRule = getRuleById('floodborn')!;
/** The Floodborns pair `card` finds with `partner`, or undefined when they do not pair. */
const floodbornPair = (card: LorcanaCard, partner: LorcanaCard) =>
  floodbornRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// Team buffs that grant one keyword.
const protectiveAura = createCard({
  id: 'protective-aura',
  name: 'Protective Aura',
  fullName: 'Protective Aura',
  type: 'Action',
  ink: 'Amethyst',
  cost: 2,
  text: 'Your Floodborn characters gain Evasive until the start\nof your next turn. (Only characters with Evasive can\nchallenge them.)',
});
const robinHood = createCard({
  id: 'robin-hood-created-by-the-vine',
  name: 'Robin Hood',
  fullName: 'Robin Hood - Created by the Vine',
  ink: 'Sapphire',
  cost: 5,
  classifications: ['Floodborn', 'Vineling'],
  text: 'KEEN-EYED Your Floodborn characters gain Alert.\n(They can challenge as if they had Evasive.)',
});
// A Floodborn character that prints Evasive, and one that doesn't.
const princePhillip = createCard({
  id: 'prince-phillip-vanquisher-of-foes',
  name: 'Prince Phillip',
  fullName: 'Prince Phillip - Vanquisher of Foes',
  ink: 'Emerald',
  cost: 9,
  classifications: ['Floodborn', 'Hero', 'Prince'],
  keywords: ['Shift 6', 'Evasive'],
  text: 'Shift 6 ⬡ (You may pay 6 ⬡ to play this on top of one of\nyour characters named Prince Phillip.)\nEvasive (Only characters with Evasive can challenge this\ncharacter.)\nSWIFT AND SURE When you play this character, banish all\nopposing damaged characters.',
});
const pluto = createCard({
  id: 'pluto-determined-defender',
  name: 'Pluto',
  fullName: 'Pluto - Determined Defender',
  cost: 7,
  classifications: ['Floodborn', 'Ally'],
  keywords: ['Shift 5', 'Bodyguard'],
  text: 'Shift 5 ⬡ (You may pay 5 ⬡ to play this on top of one of\nyour characters named Pluto.)\nBodyguard (This character may enter play exerted. An\nopposing character who challenges one of your characters\nmust choose one with Bodyguard if able.)\nGUARD DOG At the start of your turn, remove up to 3\ndamage from this character.',
});

describe('Floodborns: a team buff the member already prints', () => {
  it('scores it at the same-deck 5, Evasive covering Alert, from either side', () => {
    const pairs = [protectiveAura, robinHood].flatMap((buff) => [
      floodbornPair(buff, princePhillip),
      floodbornPair(princePhillip, buff),
    ]);
    for (const pair of pairs) {
      expect(pair).toMatchObject({
        score: 5,
        explanation: '{A} and {B} both go in a Floodborns deck.',
      });
    }
  });

  it('keeps the 6 for a member the keyword is new to', () => {
    expect(floodbornPair(protectiveAura, pluto)).toMatchObject({
      score: 6,
      explanation: "{A}'s Floodborn buff powers up {B}.",
    });
  });
});
