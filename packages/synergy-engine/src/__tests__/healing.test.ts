import {describe, it, expect} from 'vitest';
import {getHealRoles} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Healing fixes from the 2026-10-14 misread review, kept out of rules.test.ts (CodeScene: function
// count). Real card text.

const healingRule = getRuleById('healing')!;
/** The Healing pair `card` finds with `partner`, or undefined when they do not pair. */
const healingPair = (card: LorcanaCard, partner: LorcanaCard) =>
  healingRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// A bonus for the card's own heal ("this way"), which no other healer can feed.
const julieta = createCard({
  id: 'julieta-madrigal-excellent-cook',
  name: 'Julieta Madrigal',
  fullName: 'Julieta Madrigal - Excellent Cook',
  text: 'SIGNATURE RECIPE When you play this character,\nyou may remove up to 2 damage from chosen\ncharacter. If you removed damage this way, you\nmay draw a card.',
});
const ohana = createCard({
  id: 'ohana-means-family',
  name: 'Ohana Means Family',
  fullName: 'Ohana Means Family',
  type: 'Action',
  text: 'Remove all damage from chosen character of yours.\nDraw a card for each 1 damage removed this way.',
});
const imNeverNot = createCard({
  id: 'im-never-not-by-your-side',
  name: "I'm Never Not by Your Side",
  fullName: "I'm Never Not by Your Side",
  type: 'Action',
  text: "Sing Together 5 (Any number of your or your teammates'\ncharacters with total cost 5 or more may ⟳ to sing this\nsong for free.)\nRemove up to 4 damage total from any number of your\ncharacters. You gain 1 lore for each 1 damage removed\nthis way.",
});
// A payoff any healer feeds: it checks damage removed this turn, by any card.
const arepas = createCard({
  id: 'julietas-arepas',
  name: "Julieta's Arepas",
  fullName: "Julieta's Arepas",
  type: 'Item',
  ink: 'Sapphire',
  text: 'FLAVORFUL CURE At the start of your turn, if you have\na Madrigal character in play, remove up to 2 damage\nfrom chosen character.\nTHAT DID THE TRICK ⟳ — If you removed damage from\na character this turn, gain 1 lore.',
});
const grandPabbie = createCard({
  id: 'grand-pabbie-oldest-and-wisest',
  name: 'Grand Pabbie',
  fullName: 'Grand Pabbie - Oldest and Wisest',
  ink: 'Sapphire',
  text: 'ANCIENT INSIGHT Whenever you remove 1 or\nmore damage from one of your characters,\ngain 2 lore.',
});
const rapunzel = createCard({
  id: 'rapunzel-sunshine',
  name: 'Rapunzel',
  fullName: 'Rapunzel - Sunshine',
  text: 'MAGIC HAIR ⟳ — Remove up to 2 damage from\nchosen character.',
});

describe("Healing: a bonus for the card's own heal", () => {
  it('reads the card as a healer only', () => {
    expect(getHealRoles(julieta)).toEqual(['healer']);
    expect(getHealRoles(ohana)).toEqual(['healer']);
  });

  it('reads a heal spread as a damage total as a healer', () => {
    expect(getHealRoles(imNeverNot)).toEqual(['healer']);
  });

  it('keeps a check on damage removed this turn as a payoff', () => {
    expect(getHealRoles(arepas)).toEqual(['healer', 'heal-payoff']);
  });

  it('pairs these healers with a payoff they fire, not with another healer', () => {
    for (const healer of [julieta, ohana, imNeverNot]) {
      expect(healingPair(healer, grandPabbie)?.score).toBe(8);
      expect(healingPair(healer, rapunzel)).toBeUndefined();
    }
  });
});

// Temporary Shift heals the character only as your turn ends, and only if it took damage.
const grandmaWu = createCard({
  id: 'grandma-wu-fierce-red-panda',
  name: 'Grandma Wu',
  fullName: 'Grandma Wu - Fierce Red Panda',
  ink: 'Ruby',
  classifications: ['Storyborn', 'Mentor', 'Red Panda'],
  text: 'Temporary Shift 4 ⬡ (You may pay 4 ⬡ to play this on\ntop of one of your characters named Grandma Wu. At the\nend of your turn, remove all damage from this character\nand return only this card to your hand.)\nINTIMIDATING CHARGE Whenever this character\nchallenges another character, you gain 2 lore and each\nopponent loses 2 lore.',
});

describe("Healing: Temporary Shift's end-of-turn heal", () => {
  it('scores 6 with a heal trigger, the Temporary Shift card as the actor', () => {
    expect(healingPair(grandmaWu, grandPabbie)).toMatchObject({
      score: 6,
      explanation:
        "{A}'s Temporary Shift removes its damage at the end of your turn, firing {B}'s heal payoff when it was damaged.",
    });
    expect(healingPair(grandPabbie, grandmaWu)?.explanation).toBe(
      "{B}'s Temporary Shift removes its damage at the end of your turn, firing {A}'s heal payoff when it was damaged.",
    );
  });

  it('does not pair with a check made while you act', () => {
    expect(healingPair(grandmaWu, arepas)).toBeUndefined();
    expect(healingPair(arepas, grandmaWu)).toBeUndefined();
  });
});
