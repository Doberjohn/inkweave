import {describe, it, expect} from 'vitest';
import {
  banishPayoffPaysLittle,
  banishTriggerFiresOnYourTurn,
  getSacrificeRoles,
  isSacrificeCard,
} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

describe('Sacrifice rule (Banish Matters)', () => {
  const sacrificeRule = getRuleById('sacrifice')!;

  // Enablers (self-banish cards) — banish your OWN characters on demand.
  const hadesStrongArm = createCard({
    id: 'hades-strong-arm',
    fullName: 'Hades - Strong Arm',
    ink: 'Ruby',
    text: 'WHAT ARE YOU GONNA DO? ⟳, 3 ⬡, Banish one of your characters — Banish chosen character.',
  });
  const timeToGo = createCard({
    id: 'time-to-go',
    fullName: 'Time to Go!',
    ink: 'Ruby',
    type: 'Action',
    text: 'Banish chosen character of yours to draw 2 cards. If that character had a card under them, draw 3 cards instead.',
  });
  const theClaw = createCard({
    id: 'the-claw',
    fullName: 'The Claw',
    ink: 'Emerald',
    type: 'Item',
    text: 'THE CLAW CHOOSES ⟳, 2 ⬡, Banish one of your characters — Return chosen opposing character to their player’s hand.',
  });

  // Payoffs (banish-triggers) — reward your characters being banished, any cause.
  const diablo = createCard({
    id: 'diablo',
    fullName: 'Diablo - Obedient Raven',
    ink: 'Amethyst',
    text: 'FLY, MY PET! When this character is banished, you may draw a card.',
  });
  const davidXanatos = createCard({
    id: 'david-xanatos',
    fullName: 'David Xanatos - Charismatic Leader',
    ink: 'Ruby',
    text: 'LEARN FROM EVERYTHING During your turn, whenever one of your characters is banished, draw a card.',
  });
  const kingCandyRoyal = createCard({
    id: 'king-candy-royal',
    fullName: 'King Candy - Royal Racer',
    ink: 'Amber',
    ink2: 'Ruby',
    text: 'A NEW ROSTER Whenever one of your other Racer characters is banished, each opponent loses 1 lore.',
  });

  // Excluded cases.
  const iagoChallenge = createCard({
    id: 'iago',
    fullName: 'Iago - Reappearing Parrot',
    ink: 'Amethyst',
    text: 'GUESS WHO When this character is banished in a challenge, return this card to your hand.',
  });
  const energyBlast = createCard({
    id: 'energy-blast',
    fullName: 'Energy Blast',
    ink: 'Ruby',
    type: 'Action',
    text: 'Banish chosen character. Draw a card.',
  });
  const unrelated = createCard({id: 'unrelated', fullName: 'Anna', text: 'Draw a card.'});

  describe('role detection', () => {
    it('detects self-banish from "Banish one of your characters"', () => {
      expect(getSacrificeRoles(hadesStrongArm)).toEqual(['self-banish']);
    });

    it('detects self-banish from "Banish chosen character of yours"', () => {
      expect(getSacrificeRoles(timeToGo)).toEqual(['self-banish']);
    });

    it('detects banish-trigger from self-banish ("when this character is banished")', () => {
      expect(getSacrificeRoles(diablo)).toEqual(['banish-trigger']);
    });

    it('detects banish-trigger from "whenever one of your characters is banished"', () => {
      expect(getSacrificeRoles(davidXanatos)).toEqual(['banish-trigger']);
    });

    it('detects banish-trigger from a tribal your-side trigger (Racer)', () => {
      expect(getSacrificeRoles(kingCandyRoyal)).toEqual(['banish-trigger']);
    });

    it('excludes "banished in a challenge" recursion (belongs to Challenge axis)', () => {
      expect(getSacrificeRoles(iagoChallenge)).toEqual([]);
    });

    it('excludes opponent removal ("banish chosen character" without "of yours")', () => {
      expect(getSacrificeRoles(energyBlast)).toEqual([]);
    });

    it('returns no roles for unrelated or text-less cards', () => {
      expect(getSacrificeRoles(unrelated)).toEqual([]);
      expect(getSacrificeRoles(createCard({text: undefined}))).toEqual([]);
      expect(isSacrificeCard(unrelated)).toBe(false);
    });
  });

  describe('rule matching', () => {
    it('matches both self-banish cards and payoffs, not unrelated cards', () => {
      expect(sacrificeRule.matches(hadesStrongArm)).toBe(true);
      expect(sacrificeRule.matches(diablo)).toBe(true);
      expect(sacrificeRule.matches(unrelated)).toBe(false);
    });
  });

  describe('synergy scoring', () => {
    const allCards = [hadesStrongArm, timeToGo, theClaw, diablo, davidXanatos, unrelated];

    it('self-banish ↔ banish-trigger scores 8 (banish combo)', () => {
      const synergies = sacrificeRule.findSynergies(hadesStrongArm, allCards);
      const match = synergies.find((s) => s.card.id === 'diablo');
      expect(match!.score).toBe(8);
      // Token swap: the SELF-BANISH card ({A}, the searcher here) reads as the actor.
      expect(match!.explanation).toBe(
        "{A} banishes your own character on demand, guaranteeing {B}'s banish payoff.",
      );
    });

    it('keeps the self-banish card as the actor when the payoff is the searcher', () => {
      const synergies = sacrificeRule.findSynergies(diablo, allCards);
      const match = synergies.find((s) => s.card.id === 'hades-strong-arm');
      expect(match!.score).toBe(8);
      // Now the self-banish card is the partner ({B}), so the tokens swap accordingly.
      expect(match!.explanation).toBe(
        "{B} banishes your own character on demand, guaranteeing {A}'s banish payoff.",
      );
    });

    it('banish-trigger ↔ banish-trigger scores 5 and says which trigger watches any banish', () => {
      const synergies = sacrificeRule.findSynergies(diablo, allCards);
      const match = synergies.find((s) => s.card.id === 'david-xanatos');
      expect(match!.score).toBe(5);
      // David Xanatos triggers on any of your characters; Diablo, the searcher, only on itself.
      expect(match!.explanation).toBe(
        '{B} benefits when your characters are banished, and {A} when it is.',
      );
    });

    it('self-banish ↔ self-banish scores 5 (parallel enablers)', () => {
      const synergies = sacrificeRule.findSynergies(hadesStrongArm, allCards);
      const match = synergies.find((s) => s.card.id === 'the-claw');
      expect(match!.score).toBe(5);
      expect(match!.explanation).toBe('{A} and {B} both banish your own characters.');
    });
  });
});

// Fixes from the 2026-10-14 misread review. Real card text.

const sacrificeRule = getRuleById('sacrifice')!;
/** The Sacrifice pair `card` finds with `partner`, or undefined when they do not pair. */
const sacrificePair = (card: LorcanaCard, partner: LorcanaCard) =>
  sacrificeRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);
/** Expects `card` to pair with each of `payoffs` at the same-deck 5, from either side. */
function expectSameDeckFive(card: LorcanaCard, payoffs: LorcanaCard[]) {
  const pairs = payoffs.flatMap((payoff) => [
    sacrificePair(card, payoff),
    sacrificePair(payoff, card),
  ]);
  for (const pair of pairs) {
    expect(pair).toMatchObject({
      score: 5,
      explanation: '{A} and {B} both go in a Sacrifice deck.',
    });
  }
}

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
    expectSameDeckFive(timeToGo, [rex, donaldHoneywell]);
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
    expectSameDeckFive(timeToGo, [alien, merlin]);
  });
});
