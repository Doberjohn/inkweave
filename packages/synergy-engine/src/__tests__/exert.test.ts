import {describe, it, expect} from 'vitest';
import {exertEnablerReachesPayoff} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Exert fixes from the 2026-10-14 misread review, kept out of rules.test.ts (CodeScene: function
// count). Real card text.

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
