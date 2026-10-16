import {describe, it, expect} from 'vitest';
import {getHealRoles, isHealCard} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

describe('Healing rule (Heal Matters)', () => {
  const healingRule = getRuleById('healing')!;

  // Healer (enabler) — removes damage from a character.
  const healingTouch = createCard({
    id: 'healing-touch',
    fullName: 'Healing Touch',
    ink: 'Amber',
    type: 'Action',
    text: 'Remove up to 3 damage from chosen character.',
  });

  // Heal-payoffs — reward the removal event.
  const grandPabbie = createCard({
    id: '2086',
    fullName: 'Grand Pabbie - Oldest and Wisest',
    ink: 'Sapphire',
    text: 'ANCIENT INSIGHT Whenever you remove 1 or more damage from one of your characters, gain 2 lore.',
  });
  const isabela = createCard({
    id: '2734',
    fullName: 'Isabela Madrigal - Caring Cultivator',
    ink: 'Amber',
    text: 'DO NO WRONG Whenever you remove damage from one of your characters, gain 1 lore for each 1 damage removed.',
  });
  // Dual-role: heals, and pays off any removal, its own included.
  const bruno = createCard({
    id: '2869',
    fullName: 'Bruno Madrigal - Oasis Oracle',
    ink: 'Sapphire',
    text: "FIND THAT VISION Once during your turn, whenever you\nremove damage from one of your characters, you may\nlook at the top 2 cards of your deck. Put one into your\nhand and the other on the bottom of your deck.\nYOU'LL BE OKAY Whenever this character quests, you\nmay remove all damage from chosen character.",
  });

  // Excluded / unrelated.
  const moveDamage = createCard({
    id: 'mover',
    fullName: 'Damage Mover',
    ink: 'Sapphire',
    text: 'You may move all damage from chosen character of yours to this character.',
  });
  const unrelated = createCard({id: 'unrelated', fullName: 'Anna', text: 'Draw a card.'});

  describe('role detection', () => {
    it('detects a healer from "remove up to N damage from"', () => {
      expect(getHealRoles(healingTouch)).toEqual(['healer']);
    });

    it('detects a heal-payoff from "whenever you remove ... damage"', () => {
      expect(getHealRoles(grandPabbie)).toEqual(['heal-payoff']);
    });

    it('detects a dual-role card as healer + heal-payoff (Bruno Madrigal - Oasis Oracle)', () => {
      expect(getHealRoles(bruno)).toEqual(['healer', 'heal-payoff']);
    });

    it('excludes a pure move-damage card and text-less / unrelated cards', () => {
      expect(getHealRoles(moveDamage)).toEqual([]);
      expect(getHealRoles(unrelated)).toEqual([]);
      expect(isHealCard(unrelated)).toBe(false);
    });
  });

  describe('rule matching', () => {
    it('matches healers and payoffs, not unrelated cards', () => {
      expect(healingRule.matches(healingTouch)).toBe(true);
      expect(healingRule.matches(grandPabbie)).toBe(true);
      expect(healingRule.matches(unrelated)).toBe(false);
    });
  });

  describe('synergy scoring', () => {
    const scoreWith = (a: typeof healingTouch, b: typeof grandPabbie) =>
      healingRule.findSynergies(a, [a, b]).find((m) => m.card.id === b.id);

    it('healer ↔ heal-payoff scores 8, healer reads as the actor', () => {
      const match = scoreWith(healingTouch, grandPabbie);
      expect(match!.score).toBe(8);
      // healingTouch is the searcher ({A}); it is the healer, so it stays the actor.
      expect(match!.explanation).toBe(
        "{A} clears damage off your characters, firing {B}'s heal payoff.",
      );
    });

    it('keeps the healer as the actor when the payoff is the searcher', () => {
      const match = scoreWith(grandPabbie, healingTouch);
      expect(match!.score).toBe(8);
      // grandPabbie is the searcher ({A}) but is the payoff, so the healer reads as {B}.
      expect(match!.explanation).toBe(
        "{B} clears damage off your characters, firing {A}'s heal payoff.",
      );
    });

    it('heal-payoff ↔ heal-payoff scores 7 (two engines compound)', () => {
      expect(scoreWith(grandPabbie, isabela)?.score).toBe(7);
    });

    it('does not pair two plain healers (payoff-anchored)', () => {
      const healer2 = createCard({id: 'h2', fullName: 'Second Healer', text: 'Remove 2 damage from chosen character.'});
      expect(healingRule.findSynergies(healingTouch, [healingTouch, healer2])).toHaveLength(0);
    });
  });
});

// Fixes from the 2026-10-14 misread review. Real card text.

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

// Temporary Shift heals the character only as your turn ends, and only if it has damage then.
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
