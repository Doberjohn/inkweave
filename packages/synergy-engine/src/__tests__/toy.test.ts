import {describe, it, expect} from 'vitest';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Toy fixes from the 2026-10-14 misread review, kept out of rules.test.ts (CodeScene: function
// count). Real card text.

const toyRule = getRuleById('toy')!;
/** The Toy pair `card` finds with `partner`, or undefined when they do not pair. */
const toyPair = (card: LorcanaCard, partner: LorcanaCard) =>
  toyRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// Toy payoff roles for the card's own banish, which counts no other Toy.
const rex = createCard({
  id: 'rex-protective-dinosaur',
  name: 'Rex',
  fullName: 'Rex - Protective Dinosaur',
  cost: 2,
  classifications: ['Storyborn', 'Ally', 'Dinosaur', 'Toy'],
  text: "Bodyguard (This character may enter play\nexerted. An opposing character who challenges\none of your characters must choose one with\nBodyguard if able.)\nRUN AWAY! During an opponent's turn, when this\ncharacter is banished, gain 1 lore.",
});
const pterodactyl = createCard({
  id: 'pterodactyl-janie-doll-sids-toy',
  name: 'Pterodactyl Janie Doll',
  fullName: "Pterodactyl Janie Doll - Sid's Toy",
  ink: 'Ruby',
  cost: 1,
  classifications: ['Storyborn', 'Ally', 'Toy'],
  text: 'DOUBLE TRANSPLANT During your turn, when this\ncharacter is banished, each opponent loses 1 lore\nand you gain 1 lore.',
});
// Counts every other Toy.
const alien = createCard({
  id: 'alien-true-believer',
  name: 'Alien',
  fullName: 'Alien - True Believer',
  ink: 'Emerald',
  cost: 1,
  classifications: ['Storyborn', 'Ally', 'Alien', 'Toy'],
  text: 'WE ARE ONE This character gets +1 ¤ for each\nother Toy character you have in play.\nHE HAS BEEN CHOSEN During your turn, when\nthis character is banished, return another\ncharacter card named Alien from your discard to\nyour hand.',
});
const hamm = createCard({
  id: 'hamm-piggy-bank',
  name: 'Hamm',
  fullName: 'Hamm - Piggy Bank',
  cost: 2,
  classifications: ['Storyborn', 'Ally', 'Toy'],
  text: 'LOOSE CHANGE ⟳ — You pay 1 ⬡ less for the\nnext character you play this turn.',
});

describe('Toys: a payoff that counts no other Toy', () => {
  it('scores it at the same-deck 5 with a member or another such payoff, from either side', () => {
    const pairs = [hamm, pterodactyl].flatMap((partner) => [
      toyPair(rex, partner),
      toyPair(partner, rex),
    ]);
    for (const pair of pairs) {
      expect(pair).toMatchObject({score: 5, explanation: '{A} and {B} both go in a Toys deck.'});
    }
  });

  it('keeps the 7 for a payoff that counts the other Toys', () => {
    expect(toyPair(alien, hamm)).toMatchObject({
      score: 7,
      explanation: "{B} can activate {A}'s Toy ability.",
    });
  });
});
