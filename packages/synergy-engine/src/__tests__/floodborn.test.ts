import {describe, it, expect} from 'vitest';
import {getFloodbornRoles, isFloodbornCard} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

describe('Floodborns detection', () => {
  const floodbornMember = createCard({
    id: 'elsa-fb', name: 'Elsa', fullName: 'Elsa - Spirit of Winter',
    cost: 7, classifications: ['Floodborn'], text: 'Whenever this character quests, draw a card.',
  });
  const buffPayoff = createCard({
    id: 'gaston-vine', name: 'Gaston', fullName: 'Gaston - Created by the Vine',
    cost: 2, classifications: ['Floodborn', 'Vineling'],
    text: 'DRAWING STRENGTH Your Floodborn characters get +1 ¤.',
  });
  const triggerPayoff = createCard({
    id: 'hera-vine', name: 'Hera', fullName: 'Hera - Created by the Vine',
    cost: 5, classifications: ['Floodborn', 'Vineling'],
    text: 'MYSTICAL BOON Whenever you play this or another Floodborn character, gain 1 lore.',
  });
  const theVine = createCard({
    id: 'the-vine', name: 'The Vine', fullName: 'The Vine - Towering Stalk',
    cost: 10, classifications: ['Floodborn'],
    text: 'SATURATE Your other exerted Floodborn characters gain Bodyguard. HOSTILE SWARM During an opponent\'s turn, whenever one of your Floodborn characters is banished, deal 1 damage to each opposing character.',
  });

  it('tags a plain Floodborn character as member only', () => {
    expect(getFloodbornRoles(floodbornMember)).toEqual(['member']);
  });
  it('detects a static team buff', () => {
    expect(getFloodbornRoles(buffPayoff)).toEqual(['member', 'buff']);
  });
  it('detects a repeating trigger', () => {
    expect(getFloodbornRoles(triggerPayoff)).toEqual(['member', 'trigger']);
  });
  it('detects The Vine as member + buff + trigger', () => {
    expect(getFloodbornRoles(theVine)).toEqual(['member', 'buff', 'trigger']);
  });
  it('ignores non-Floodborn cards with no Floodborn payoff text', () => {
    expect(isFloodbornCard(createCard({id: 'x', name: 'X', cost: 3, text: 'Draw a card.'}))).toBe(false);
  });
});

describe('Floodborns rule', () => {
  const rule = getRuleById('floodborn')!;
  const member = createCard({id: 'm1', name: 'Elsa', cost: 7, classifications: ['Floodborn'], text: 'Quests for 2 lore.'});
  const member2 = createCard({id: 'm2', name: 'Ariel', cost: 5, classifications: ['Floodborn'], text: 'Has Evasive.'});
  const buff = createCard({id: 'b1', name: 'Gaston', cost: 2, classifications: ['Floodborn'], text: 'Your Floodborn characters get +1 ¤.'});
  const trigger = createCard({id: 't1', name: 'Hera', cost: 5, classifications: ['Floodborn'], text: 'Whenever you play this or another Floodborn character, gain 1 lore.'});

  const scoreWith = (a, b) => rule.findSynergies(a, [a, b]).find((m) => m.card.id === b.id);

  it('does not pair two plain Floodborn members (payoff-anchored)', () => {
    expect(rule.findSynergies(member, [member, member2])).toHaveLength(0);
  });
  it('scores member + trigger payoff at 7', () => {
    expect(scoreWith(member, trigger)?.score).toBe(7);
  });
  it('scores member + buff payoff at 6', () => {
    expect(scoreWith(member, buff)?.score).toBe(6);
  });
  it('scores payoff + payoff at 7 when each helps the other', () => {
    expect(scoreWith(buff, trigger)?.score).toBe(7);
  });
});

// Fixes from the 2026-10-14 misread review. Real card text.

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

// A trigger whose payoff is the player's lore gain.
const scar = createCard({
  id: 'scar-created-by-the-vine',
  name: 'Scar',
  fullName: 'Scar - Created by the Vine',
  ink: 'Steel',
  cost: 5,
  classifications: ['Floodborn', 'Vineling'],
  text: "VICTOR'S REWARD During your turn, whenever\none of your Floodborn characters banishes\nanother character in a challenge, gain 1 lore.\nFILL THE RANKS During an opponent's turn,\nwhenever one of your Floodborn characters is\nbanished, draw a card.",
});

describe('Floodborns: a trigger that ends in the player gaining lore', () => {
  it('reads it as a trigger, not a team buff', () => {
    expect(getFloodbornRoles(scar)).toEqual(['member', 'trigger']);
  });
});

// A buff that isn't a character, and two Floodborn characters whose payoffs each count the other.
const ringOfStones = createCard({
  id: 'ring-of-stones-taken-by-the-vine',
  name: 'Ring of Stones',
  fullName: 'Ring of Stones - Taken by the Vine',
  type: 'Location',
  ink: 'Amethyst',
  cost: 4,
  text: 'DEEP WISDOM Your Floodborn characters get +1 ◊.',
});
const gaston = createCard({
  id: 'gaston-created-by-the-vine',
  name: 'Gaston',
  fullName: 'Gaston - Created by the Vine',
  ink: 'Ruby',
  cost: 2,
  classifications: ['Floodborn', 'Vineling'],
  text: 'DRAWING STRENGTH Your Floodborn characters\nget +1 ¤.',
});
const hera = createCard({
  id: 'hera-created-by-the-vine',
  name: 'Hera',
  fullName: 'Hera - Created by the Vine',
  ink: 'Amethyst',
  cost: 5,
  classifications: ['Floodborn', 'Queen', 'Deity', 'Vineling'],
  text: 'MYSTICAL BOON Whenever you play this or\nanother Floodborn character, gain 1 lore.',
});

describe('Floodborns: two payoffs score what each gives the other', () => {
  it('scores two that help neither at the same-deck 5, from either side', () => {
    for (const [card, partner] of [
      [protectiveAura, ringOfStones],
      [ringOfStones, protectiveAura],
    ]) {
      expect(floodbornPair(card, partner)).toMatchObject({
        score: 5,
        explanation: '{A} and {B} both go in a Floodborns deck.',
      });
    }
  });

  it("scores one that helps the other at its own member pair's 6", () => {
    expect(floodbornPair(ringOfStones, robinHood)).toMatchObject({
      score: 6,
      explanation: "{A}'s Floodborn buff powers up {B}.",
    });
    expect(floodbornPair(robinHood, ringOfStones)?.score).toBe(6);
  });

  it('keeps 7 for two that each help the other', () => {
    expect(floodbornPair(gaston, hera)).toMatchObject({
      score: 7,
      explanation:
        "{A} and {B} are both Floodborn characters, and each one's ability helps the other.",
    });
  });
});
