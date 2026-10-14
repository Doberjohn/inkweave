import {describe, it, expect} from 'vitest';
import {getTribalRoles, TRIBAL_SPECS} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Classification-tribe fixes from the 2026-10-14 misread review, kept out of rules.test.ts
// (CodeScene: function count). Real card text.

// A Princess buff on a Prince.
const beast = createCard({
  id: 'beast-gracious-prince',
  name: 'Beast',
  fullName: 'Beast - Gracious Prince',
  cost: 5,
  classifications: ['Storyborn', 'Hero', 'Prince'],
  text: 'FULL DANCE CARD Your Princess characters get\n+1 ¤ and +1 ⛉.',
});

describe('Tribes: a tribe word inside a longer one', () => {
  it('reads "Your Princess characters" as a Princess buff, not a Prince one', () => {
    expect(getTribalRoles(beast, TRIBAL_SPECS.princess)).toEqual(['buff']);
    expect(getTribalRoles(beast, TRIBAL_SPECS.royalty)).toEqual(['member']);
  });
});

const royaltyRule = getRuleById('royalty')!;
/** The Royalty pair `card` finds with `partner`, or undefined when they do not pair. */
const royaltyPair = (card: LorcanaCard, partner: LorcanaCard) =>
  royaltyRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// Payoffs that check for one rank, and members of each rank.
const agnarr = createCard({
  id: 'agnarr-king-of-arendelle',
  name: 'Agnarr',
  fullName: 'Agnarr - King of Arendelle',
  ink: 'Ruby',
  classifications: ['Storyborn', 'Mentor', 'King'],
  text: 'PROTECTIVE INSTINCT While you have a Queen\ncharacter in play, this character gets +2 ¤.',
});
const hans = createCard({
  id: 'hans-noble-scoundrel',
  name: 'Hans',
  fullName: 'Hans - Noble Scoundrel',
  ink: 'Sapphire',
  classifications: ['Storyborn', 'Villain', 'Prince'],
  text: 'ROYAL SCHEMES When you play this character, if a\nPrincess or Queen character is in play, gain 1 lore.',
});
const theQueen = createCard({
  id: 'the-queen-regal-monarch',
  name: 'The Queen',
  fullName: 'The Queen - Regal Monarch',
  cost: 1,
  classifications: ['Storyborn', 'Villain', 'Queen'],
  text: '',
});
const belleAndBeast = createCard({
  id: 'belle-and-beast-certain-as-the-sun',
  name: 'Belle & Beast',
  fullName: 'Belle & Beast - Certain as the Sun',
  ink: 'Ruby',
  ink2: 'Sapphire',
  cost: 8,
  classifications: ['Storyborn', 'Team', 'Hero', 'Prince', 'Princess'],
  text: "Shift 6 ⬡ (You may pay 6 ⬡ to play this on top of\none of your characters named Belle or Beast.)\nINSPIRING DANCE Whenever this character quests,\nready all cards in your inkwell.\nAPPRECIATIVE AUDIENCE 6 ⬡ — Ready your other\ncharacters. They can't quest for the rest of this turn.",
});

describe('Tribes: a payoff that names one rank', () => {
  it('pairs it only with members of a rank its text names, from either side', () => {
    expect(royaltyPair(agnarr, theQueen)?.score).toBe(6);
    expect(royaltyPair(hans, belleAndBeast)?.score).toBe(6);
    expect(royaltyPair(agnarr, beast)).toBeUndefined();
    expect(royaltyPair(beast, hans)).toBeUndefined();
  });

  it('reads two payoffs that neither switches on as stacking', () => {
    expect(royaltyPair(agnarr, hans)).toMatchObject({
      score: 7,
      explanation: '{A} and {B} are both Royalty payoffs, so they stack on your board.',
    });
  });
});
