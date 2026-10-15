import {describe, it, expect} from 'vitest';
import {getHunnyRoles} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Hunny fixes from the 2026-10-14 misread review, kept out of rules.test.ts (CodeScene: function
// count). Real card text.

const hunnyRule = getRuleById('hunny')!;
/** The Hunny pair `card` finds with `partner`, or undefined when they do not pair. */
const hunnyPair = (card: LorcanaCard, partner: LorcanaCard) =>
  hunnyRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// A Hunny location, and a Hunny item that gives a character the classification.
const campsite = createCard({
  id: 'hundred-acre-wood-hunny-campsite',
  name: 'Hundred Acre Wood',
  fullName: 'Hundred Acre Wood - Hunny Campsite',
  type: 'Location',
  ink: 'Sapphire',
  classifications: ['Hunny'],
  text: 'HOME AWAY FROM HOME Characters get +1 ⛉ while here.\nHUNNY QUEST Hunny characters get +1 ◊ while here.',
});
const staff = createCard({
  id: 'magical-hunny-staff',
  name: 'Magical Hunny Staff',
  fullName: 'Magical Hunny Staff',
  type: 'Item',
  ink: 'Amethyst',
  cost: 1,
  classifications: ['Hunny'],
  text: 'GIFT OF THE HIVE Once during your turn, you may pay 1 ⬡\nto give chosen character of yours the Hunny classification\nuntil the start of your next turn.\nSPELL OF SWIFTNESS ⟳, 2 ⬡ — Chosen Hunny character\nof yours gains Evasive until the start of your next turn.\n(Only characters with Evasive can challenge them.)',
});
// A density payoff, a plain member, and a "Hunny card" search.
const roo = createCard({
  id: 'roo-hunny-rogue',
  name: 'Roo',
  fullName: 'Roo - Hunny Rogue',
  ink: 'Emerald',
  cost: 1,
  classifications: ['Dreamborn', 'Ally', 'Hunny'],
  text: "Ward (Opponents can't choose this character except\nto challenge.)\nELUSIVE EXPERTISE While you have another Hunny\ncharacter in play, this character gains Evasive. (Only\ncharacters with Evasive can challenge them.)",
});
const kanga = createCard({
  id: 'kanga-hunny-bard',
  name: 'Kanga',
  fullName: 'Kanga - Hunny Bard',
  classifications: ['Dreamborn', 'Ally', 'Hunny'],
  text: 'Singer 5 (This character counts as cost 5 to sing\nsongs.)',
});
const christopherRobin = createCard({
  id: 'christopher-robin-hunny-sage',
  name: 'Christopher Robin',
  fullName: 'Christopher Robin - Hunny Sage',
  ink: 'Amethyst',
  ink2: 'Sapphire',
  cost: 6,
  classifications: ['Dreamborn', 'Hero', 'Hunny'],
  text: 'GATHER THE PARTY You can have other Hunny\ncharacters in your deck regardless of ink type.\nMAGICAL SUMMONS When you play this character,\nyou may search your deck for a Hunny card, reveal it,\nand put it in your hand. If you do, shuffle your deck.',
});

describe('Hunny: a Hunny card that is no character', () => {
  it("reads the location's pump of Hunny characters there as its Hunny buff", () => {
    expect(getHunnyRoles(campsite)).toEqual(['member', 'buff']);
  });

  it('pairs the location through its buff, not as a Hunny character, from either side', () => {
    for (const member of [roo, kanga]) {
      expect(hunnyPair(campsite, member)).toMatchObject({
        score: 6,
        explanation: "{A}'s Hunny buff powers up {B}.",
      });
    }
    expect(hunnyPair(roo, campsite)).toMatchObject({
      score: 6,
      explanation: "{B}'s Hunny buff powers up {A}.",
    });
  });

  it('keeps the location for a "Hunny card" search', () => {
    expect(hunnyPair(christopherRobin, campsite)?.score).toBe(8);
  });

  it('counts the item that gives a character the classification as a Hunny character', () => {
    expect(hunnyPair(staff, roo)).toMatchObject({
      score: 7,
      explanation: "{A} activates {B}'s Hunny ability.",
    });
  });
});
