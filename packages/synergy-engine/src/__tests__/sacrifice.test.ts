import {describe, it, expect} from 'vitest';
import {banishPayoffPaysLittle, banishTriggerFiresOnYourTurn, getSacrificeRoles} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Sacrifice fixes from the 2026-10-14 misread review, kept out of rules.test.ts (CodeScene:
// function count). Real card text.

const sacrificeRule = getRuleById('sacrifice')!;
/** The Sacrifice pair `card` finds with `partner`, or undefined when they do not pair. */
const sacrificePair = (card: LorcanaCard, partner: LorcanaCard) =>
  sacrificeRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

const timeToGo = createCard({
  id: 'time-to-go',
  name: 'Time to Go!',
  fullName: 'Time to Go!',
  type: 'Action',
  ink: 'Ruby',
  text: 'Banish chosen character of yours to draw 2 cards.\nIf that character had a card under them, draw 3\ncards instead.',
});
const davidXanatos = createCard({
  id: 'david-xanatos-charismatic-leader',
  name: 'David Xanatos',
  fullName: 'David Xanatos - Charismatic Leader',
  ink: 'Ruby',
  text: "LEARN FROM EVERYTHING During your turn,\nwhenever one of your characters is banished,\ndraw a card.\nWHAT ARE YOU WAITING FOR? Whenever this\ncharacter quests, chosen character gains Rush this\nturn. (They can challenge the turn they're played.)",
});
// Banish triggers that fire only on an opponent's turn, when no self-banish card can act.
const rex = createCard({
  id: 'rex-protective-dinosaur',
  name: 'Rex',
  fullName: 'Rex - Protective Dinosaur',
  ink: 'Amber',
  text: "Bodyguard (This character may enter play\nexerted. An opposing character who challenges\none of your characters must choose one with\nBodyguard if able.)\nRUN AWAY! During an opponent's turn, when this\ncharacter is banished, gain 1 lore.",
});
const donaldHoneywell = createCard({
  id: 'donald-duck-fred-honeywell',
  name: 'Donald Duck',
  fullName: 'Donald Duck - Fred Honeywell',
  ink: 'Ruby',
  text: "SPIRIT OF GIVING Whenever you use the Boost\nability of a character, you may put the top card of\nyour deck under them facedown.\nWELL WISHES During opponents' turns, whenever\none of your other characters is banished, you may\ndraw a card for each card that was under them.",
});

describe("Sacrifice: banish triggers limited to an opponent's turn", () => {
  it('reads the turn each banish trigger can fire on', () => {
    expect(banishTriggerFiresOnYourTurn(davidXanatos)).toBe(true);
    expect(banishTriggerFiresOnYourTurn(rex)).toBe(false);
    expect(banishTriggerFiresOnYourTurn(donaldHoneywell)).toBe(false);
  });

  it('keeps them in the rule as banish-triggers', () => {
    expect(getSacrificeRoles(rex)).toEqual(['banish-trigger']);
    expect(getSacrificeRoles(donaldHoneywell)).toEqual(['banish-trigger']);
  });

  it('keeps the 8 combo for a trigger that fires on your turn', () => {
    expect(sacrificePair(timeToGo, davidXanatos)?.score).toBe(8);
  });

  it('scores a self-banish card with them at 5, from either side', () => {
    const pairs = [rex, donaldHoneywell].flatMap((payoff) => [
      sacrificePair(timeToGo, payoff),
      sacrificePair(payoff, timeToGo),
    ]);
    for (const pair of pairs) {
      expect(pair).toMatchObject({
        score: 5,
        explanation: '{A} and {B} both go in a Sacrifice deck.',
      });
    }
  });
});

// Banish payoffs that give back almost nothing: another card of the same name, or a trip to the
// bottom of the deck.
const alien = createCard({
  id: 'alien-true-believer',
  name: 'Alien',
  fullName: 'Alien - True Believer',
  ink: 'Emerald',
  text: 'WE ARE ONE This character gets +1 ¤ for each\nother Toy character you have in play.\nHE HAS BEEN CHOSEN During your turn, when\nthis character is banished, return another\ncharacter card named Alien from your discard to\nyour hand.',
});
const merlin = createCard({
  id: 'merlin-envisioning-the-future',
  name: 'Merlin',
  fullName: 'Merlin - Envisioning the Future',
  ink: 'Sapphire',
  text: 'MINOR TRICKERY When you play this character,\nyou may draw a card from the bottom of\nyour deck.\nAGE OF INCONVENIENCE When this character is\nbanished, put this card from your discard on the\nbottom of your deck.',
});

describe('Sacrifice: banish payoffs that give back little', () => {
  it('reads them as thin payoffs', () => {
    expect(getSacrificeRoles(alien)).toEqual(['banish-trigger']);
    expect(banishPayoffPaysLittle(alien)).toBe(true);
    expect(banishPayoffPaysLittle(merlin)).toBe(true);
    expect(banishPayoffPaysLittle(davidXanatos)).toBe(false);
  });

  it('scores a self-banish card with them at 5, from either side', () => {
    const pairs = [alien, merlin].flatMap((payoff) => [
      sacrificePair(timeToGo, payoff),
      sacrificePair(payoff, timeToGo),
    ]);
    for (const pair of pairs) {
      expect(pair).toMatchObject({
        score: 5,
        explanation: '{A} and {B} both go in a Sacrifice deck.',
      });
    }
  });
});
