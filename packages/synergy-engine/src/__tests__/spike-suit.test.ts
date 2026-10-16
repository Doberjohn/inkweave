import {describe, it, expect} from 'vitest';
import {cantChallenge, strengthInChallenge} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Spike Suit fixes from the 2026-10-14 misread review, kept out of rules.test.ts (CodeScene:
// function count). Real card text.

const spikeSuitRule = getRuleById('spike-suit')!;
/** The Spike Suit pair `card` finds with `partner`, or undefined when they do not pair. */
const spikeSuitPair = (card: LorcanaCard, partner: LorcanaCard) =>
  spikeSuitRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

const dale = createCard({
  id: 'dale-ready-for-his-shot',
  name: 'Dale',
  fullName: 'Dale - Ready for His Shot',
  cost: 4,
  strength: 0,
  willpower: 4,
  classifications: ['Dreamborn', 'Hero'],
  text: 'SPIKE SUIT During challenges, your characters\ndeal damage with their ⛉ instead of their ¤.',
});
// Strength boosts that are on when the character challenges.
const pacha = createCard({
  id: 'pacha-panicked-customer',
  name: 'Pacha',
  fullName: 'Pacha - Panicked Customer',
  ink: 'Ruby',
  cost: 4,
  strength: 2,
  willpower: 6,
  keywords: ['Reckless'],
  classifications: ['Storyborn', 'Hero'],
  text: "Reckless (This character can't quest and must\nchallenge each turn if able.)\nADRENALINE SURGE During your turn, this\ncharacter gets +4 ¤.",
});
const lawrence = createCard({
  id: 'lawrence-jealous-manservant',
  name: 'Lawrence',
  fullName: 'Lawrence - Jealous Manservant',
  ink: 'Steel',
  strength: 0,
  willpower: 4,
  classifications: ['Storyborn', 'Ally'],
  text: 'PAYBACK While this character has no damage,\nhe gets +4 ¤.',
});
const jafar = createCard({
  id: 'jafar-keeper-of-secrets',
  name: 'Jafar',
  fullName: 'Jafar - Keeper of Secrets',
  ink: 'Amethyst',
  cost: 4,
  strength: 0,
  willpower: 5,
  classifications: ['Dreamborn', 'Villain', 'Sorcerer'],
  text: 'HIDDEN WONDERS This character gets +1 ¤\nfor each card in your hand.',
});
// A strength boost that needs damage, so it is off when the character challenges undamaged.
const theBear = createCard({
  id: 'the-bear-territorial-animal',
  name: 'The Bear',
  fullName: 'The Bear - Territorial Animal',
  ink: 'Ruby',
  strength: 2,
  willpower: 5,
  classifications: ['Storyborn', 'Villain'],
  text: 'SAVAGE FURY While this character has damage,\nhe gets +3 ¤.',
});

describe('Spike Suit: a partner that boosts its own strength', () => {
  it('reads the strength it challenges with, a "for each" boost counted once', () => {
    expect(strengthInChallenge(pacha)).toBe(6);
    expect(strengthInChallenge(lawrence)).toBe(4);
    expect(strengthInChallenge(jafar)).toBe(1);
    expect(strengthInChallenge(theBear)).toBe(2);
  });

  it('drops the pair when that strength closes the gap, and scores the rest from it', () => {
    for (const partner of [pacha, lawrence]) {
      expect(spikeSuitPair(dale, partner)).toBeUndefined();
      expect(spikeSuitRule.matches(partner)).toBe(false);
    }
    expect(spikeSuitPair(dale, jafar)?.score).toBe(7);
    expect(spikeSuitPair(dale, theBear)?.score).toBe(6);
  });
});

// A partner whose Challenger bonus already lifts its strength when it challenges.
const rabbit = createCard({
  id: 'rabbit-fed-up',
  name: 'Rabbit',
  fullName: 'Rabbit - Fed Up',
  ink: 'Amethyst',
  cost: 3,
  strength: 1,
  willpower: 4,
  keywords: ['Challenger +3'],
  classifications: ['Storyborn', 'Ally'],
  text: 'Challenger +3 (While challenging, this character\ngets +3 ¤.)',
});
// Partners that can't challenge, one in its own text and one in Adventurous's reminder.
const percy = createCard({
  id: 'percy-pupsicle',
  name: 'Percy',
  fullName: 'Percy - Pupsicle',
  cost: 3,
  strength: 1,
  willpower: 4,
  classifications: ['Storyborn', 'Ally'],
  text: "ICE BATH This character can't challenge.",
});
const mickey = createCard({
  id: 'mickey-mouse-best-in-town',
  name: 'Mickey Mouse',
  fullName: 'Mickey Mouse - Best in Town',
  cost: 1,
  strength: 0,
  willpower: 4,
  keywords: ['Adventurous'],
  classifications: ['Dreamborn', 'Hero'],
  text: "Adventurous (This character can't challenge and\nmust quest each turn if able.)\nHOT DOG! At the end of your turn, if this character\nis exerted, each player gets 1 ink drop. (Each ink\ndrop may be removed to pay 1 ⬡.)",
});

describe('Spike Suit: a partner that gains little when it challenges', () => {
  it('counts Challenger in the strength it challenges with', () => {
    expect(strengthInChallenge(rabbit)).toBe(4);
    expect(spikeSuitPair(dale, rabbit)).toBeUndefined();
    expect(spikeSuitRule.matches(rabbit)).toBe(false);
  });

  it("drops a partner that can't challenge, Adventurous's reminder included", () => {
    for (const partner of [percy, mickey]) {
      expect(cantChallenge(partner)).toBe(true);
      expect(spikeSuitPair(dale, partner)).toBeUndefined();
      expect(spikeSuitRule.matches(partner)).toBe(false);
    }
  });
});
