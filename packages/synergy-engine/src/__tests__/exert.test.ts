import {describe, it, expect} from 'vitest';
import {exertEnablerReachesPayoff, getExertRoles, isExertCard} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

describe('Exert rule (Exert Matters)', () => {
  const exertRule = getRuleById('exert')!;

  // Enabler — an effect that exerts an OPPOSING character.
  const petrify = createCard({
    id: 'petrify',
    fullName: 'Petrify',
    ink: 'Amethyst',
    type: 'Action',
    text: 'Exert chosen opposing character.',
  });
  // Consume payoffs (score 8 vs enabler).
  const teKa = createCard({
    id: 'te-ka',
    fullName: 'Te Kā - Elemental Terror',
    ink: 'Amethyst',
    text: 'ANCIENT RAGE During your turn, whenever an opposing character is exerted, banish them.',
  });
  const imStuck = createCard({
    id: 'im-stuck',
    fullName: "I'm Stuck!",
    ink: 'Amethyst',
    type: 'Action',
    text: "Chosen exerted character can't ready at the start of their next turn.",
  });
  // State payoff (score 6 vs enabler).
  const honeymaren = createCard({
    id: 'honeymaren',
    fullName: 'Honeymaren - Northuldra Guide',
    ink: 'Amethyst',
    text: 'TALE OF THE FIFTH SPIRIT When you play this character, if an opponent has an exerted character in play, gain 1 lore.',
  });
  // A second pure enabler, to prove enabler↔enabler is not emitted.
  const elsaFifth = createCard({
    id: 'elsa-fifth',
    fullName: 'Elsa - The Fifth Spirit',
    ink: 'Amethyst',
    text: 'CRYSTALLIZE When you play this character, exert chosen opposing character.',
  });

  // Excluded cases.
  const costGlyph = createCard({
    id: 'freeze-cost',
    fullName: 'Cost Glyph Card',
    ink: 'Amethyst',
    text: 'FREEZE ⟳ — Draw a card.', // ⟳ is an activation cost; exerts nothing opposing
  });
  const inkwellRamp = createCard({
    id: 'ink-ramp-exerted',
    fullName: 'Inkwell Ramp Card',
    ink: 'Sapphire',
    text: 'When you play this character, each opponent puts the top card of their deck into their inkwell facedown and exerted.',
  });
  const selfExert = createCard({
    id: 'genie-main',
    fullName: 'Genie - Main Attraction',
    ink: 'Amethyst',
    text: "PHENOMENAL SHOWMAN While this character is exerted, opposing characters can't ready at the start of their turn.",
  });
  const itemExert = createCard({
    id: 'heihei',
    fullName: 'HeiHei - Not-So-Tricky Chicken',
    ink: 'Sapphire',
    text: "EAT ANYTHING When you play this character, exert chosen opposing item. It can't ready at the start of its next turn.",
  });

  describe('role detection', () => {
    it('detects exert-enabler from "exert chosen opposing character"', () => {
      expect(getExertRoles(petrify)).toEqual(['exert-enabler']);
    });

    it('detects a consume payoff from an exert-trigger', () => {
      expect(getExertRoles(teKa)).toEqual(['exert-payoff']);
    });

    it('detects a consume payoff from a can’t-ready lock', () => {
      expect(getExertRoles(imStuck)).toEqual(['exert-payoff']);
    });

    it('detects a state payoff from an opponent-exerted-state check', () => {
      expect(getExertRoles(honeymaren)).toEqual(['exert-payoff']);
    });

    it('excludes exert-as-cost (⟳ glyph, no opposing exert)', () => {
      expect(getExertRoles(costGlyph)).toEqual([]);
    });

    it('excludes inkwell ramp ("into inkwell facedown and exerted")', () => {
      expect(getExertRoles(inkwellRamp)).toEqual([]);
    });

    it('excludes self-exert-state payoffs', () => {
      expect(getExertRoles(selfExert)).toEqual([]);
    });

    it('excludes exert-an-item effects', () => {
      expect(getExertRoles(itemExert)).toEqual([]);
      expect(isExertCard(itemExert)).toBe(false);
    });
  });

  describe('rule matching', () => {
    it('matches enablers and payoffs, not excluded cards', () => {
      expect(exertRule.matches(petrify)).toBe(true);
      expect(exertRule.matches(teKa)).toBe(true);
      expect(exertRule.matches(selfExert)).toBe(false);
    });
  });

  describe('synergy scoring', () => {
    const allCards = [petrify, teKa, imStuck, honeymaren, elsaFifth];

    it('enabler ↔ consume payoff (exert-trigger) scores 8, enabler reads as actor', () => {
      const synergies = exertRule.findSynergies(petrify, allCards);
      const match = synergies.find((s) => s.card.id === 'te-ka');
      expect(match!.score).toBe(8);
      // Petrify is the searcher ({A}) and the enabler, so it reads as the actor.
      expect(match!.explanation).toBe(
        '{A} exerts an opposing character, and {B} punishes the exerted body.',
      );
    });

    it('keeps the enabler as the actor when the payoff is the searcher', () => {
      const synergies = exertRule.findSynergies(teKa, allCards);
      const match = synergies.find((s) => s.card.id === 'petrify');
      expect(match!.score).toBe(8);
      // Now the enabler (Petrify) is the partner ({B}), so the tokens swap.
      expect(match!.explanation).toBe(
        '{B} exerts an opposing character, and {A} punishes the exerted body.',
      );
    });

    it('enabler ↔ consume payoff (can’t-ready lock) scores 8', () => {
      const synergies = exertRule.findSynergies(petrify, allCards);
      const match = synergies.find((s) => s.card.id === 'im-stuck');
      expect(match!.score).toBe(8);
    });

    it('enabler ↔ state payoff scores 6', () => {
      const synergies = exertRule.findSynergies(petrify, allCards);
      const match = synergies.find((s) => s.card.id === 'honeymaren');
      expect(match!.score).toBe(6);
      expect(match!.explanation).toBe(
        '{A} keeps an opposing character exerted, switching on {B}.',
      );
    });

    it('enabler ↔ enabler is not emitted (payoff-anchored)', () => {
      const synergies = exertRule.findSynergies(petrify, allCards);
      expect(synergies.find((s) => s.card.id === 'elsa-fifth')).toBeUndefined();
    });
  });
});

// Fixes from the 2026-10-14 misread review. Real card text.

const exertRule = getRuleById('exert')!;
/** The Exert pair `card` finds with `partner`, or undefined when they do not pair. */
const exertPair = (card: LorcanaCard, partner: LorcanaCard) =>
  exertRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// Banishes only an exerted character with 5 ¤ or more.
const minnie = createCard({
  id: 'minnie-mouse-sweetheart-princess',
  name: 'Minnie Mouse',
  fullName: 'Minnie Mouse - Sweetheart Princess',
  text: "ROYAL FAVOR Your characters named Mickey Mouse\ngain Support. (Whenever they quest, you may add their\n¤ to another chosen character's ¤ this turn.)\nBYE BYE, NOW Whenever this character quests,\nyou may banish chosen exerted character with 5 ¤\nor more.",
});
// Exert only an opposing character with 2 ¤ or less.
const ghostlyTale = createCard({
  id: 'ghostly-tale',
  name: 'Ghostly Tale',
  fullName: 'Ghostly Tale',
  type: 'Action',
  ink: 'Ruby',
  text: 'Exert all opposing characters with 2 ¤ or less.',
});
const screamCanister = createCard({
  id: 'scream-canister',
  name: 'Scream Canister',
  fullName: 'Scream Canister',
  type: 'Item',
  ink: 'Ruby',
  text: 'ERRATIC SCREAMS ⟳, 2 ⬡ — Exert all cards in your\ninkwell. Exert chosen opposing character with 2 ¤\nor less.',
});
const petrify = createCard({
  id: 'petrify',
  name: 'Petrify',
  fullName: 'Petrify',
  type: 'Action',
  ink: 'Amethyst',
  text: 'Exert chosen opposing character.',
});
const imStuck = createCard({
  id: 'im-stuck',
  name: "I'm Stuck!",
  fullName: "I'm Stuck!",
  type: 'Action',
  ink: 'Amethyst',
  text: "Chosen exerted character can't ready at the start of\ntheir next turn.",
});

describe("Exert: a payoff's strength floor above the enabler's strength cap", () => {
  it('reads whether an enabler exerts a character strong enough for the payoff', () => {
    expect(exertEnablerReachesPayoff(ghostlyTale, minnie)).toBe(false);
    expect(exertEnablerReachesPayoff(screamCanister, minnie)).toBe(false);
    expect(exertEnablerReachesPayoff(petrify, minnie)).toBe(true);
    expect(exertEnablerReachesPayoff(ghostlyTale, imStuck)).toBe(true);
  });

  it('scores a capped enabler with a payoff it cannot reach at 5, from either side', () => {
    const pairs = [ghostlyTale, screamCanister].flatMap((enabler) => [
      exertPair(enabler, minnie),
      exertPair(minnie, enabler),
    ]);
    for (const pair of pairs) {
      expect(pair).toMatchObject({
        score: 5,
        explanation: '{A} and {B} both go in an Exert deck.',
      });
    }
  });

  it('keeps the 8 combo when the enabler reaches the payoff', () => {
    expect(exertPair(petrify, minnie)?.score).toBe(8);
    expect(exertPair(ghostlyTale, imStuck)?.score).toBe(8);
  });
});
