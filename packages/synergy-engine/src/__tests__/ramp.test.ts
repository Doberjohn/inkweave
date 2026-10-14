import {describe, it, expect} from 'vitest';
import {getRampRoles, inkLandsOffTriggerTurn} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Ramp fixes from the 2026-10-14 misread review, kept out of rules.test.ts (CodeScene: function
// count). Real card text.

const rampRule = getRuleById('ramp')!;
/** The Ramp pair `card` finds with `partner`, or undefined when they do not pair. */
const rampPair = (card: LorcanaCard, partner: LorcanaCard) =>
  rampRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// Discounts for the cards of one name.
const munchings = createCard({
  id: 'munchings-and-crunchings',
  name: 'Munchings and Crunchings',
  fullName: 'Munchings and Crunchings',
  type: 'Item',
  text: 'WHAT A JUICY APPLE ⟳ — Remove up to 2 damage\nfrom chosen character.\nCOME ON OUT You pay 1 ⬡ less to play characters\nnamed Gurgi.',
});
const carl = createCard({
  id: 'carl-fredricksen-loving-husband',
  name: 'Carl Fredricksen',
  fullName: 'Carl Fredricksen - Loving Husband',
  ink: 'Emerald',
  text: 'TAKE MY HAND When you play this character, you\npay 2 ⬡ less for the next character named Ellie\nFredricksen you play this turn.',
});
const pluto = createCard({
  id: 'pluto-friendly-pooch',
  name: 'Pluto',
  fullName: 'Pluto - Friendly Pooch',
  text: 'GOOD DOG ⟳ — You pay 1 ⬡ less for the next\ncharacter you play this turn.',
});

describe('Ramp: a discount for the cards of one name', () => {
  it('reads no cost reduction from it', () => {
    expect(getRampRoles(munchings)).toEqual([]);
    expect(getRampRoles(carl)).toEqual([]);
    expect(getRampRoles(pluto)).toEqual(['cost-reduction']);
  });

  it('does not pair it with a general discount', () => {
    expect(rampPair(carl, pluto)).toBeUndefined();
    expect(rampPair(pluto, munchings)).toBeUndefined();
  });
});

// Ink that lands on the opponent's turn, and inkwell triggers that fire only on yours.
const inkAmplifier = createCard({
  id: 'ink-amplifier',
  name: 'Ink Amplifier',
  fullName: 'Ink Amplifier',
  type: 'Item',
  ink: 'Sapphire',
  text: "ENERGY CAPTURE Whenever an opponent draws a card\nduring their turn, if it's the second card they've drawn\nthis turn, you may put the top card of your deck into\nyour inkwell facedown and exerted.",
});
const scrooge = createCard({
  id: 'scrooge-mcduck-miserly-ebenezer',
  name: 'Scrooge McDuck',
  fullName: 'Scrooge McDuck - Miserly Ebenezer',
  ink: 'Sapphire',
  text: 'BAH, HUMBUG During your turn, whenever a\ncard is put into your inkwell, chosen character\ngets -1 ¤ this turn.',
});
const chiefTui = createCard({
  id: 'chief-tui-weaving-a-tale',
  name: 'Chief Tui',
  fullName: 'Chief Tui - Weaving a Tale',
  ink: 'Sapphire',
  text: 'AND THEN... Once during your turn, whenever a card\nis put into your inkwell, look at the top card of your\ndeck. You may put it on either the top or the bottom of\nyour deck.',
});
const mamaOdie = createCard({
  id: 'mama-odie-mystical-maven',
  name: 'Mama Odie',
  fullName: 'Mama Odie - Mystical Maven',
  ink: 'Sapphire',
  text: 'THIS GOING TO BE GOOD Whenever you play a song,\nyou may put the top card of your deck into your inkwell\nfacedown and exerted.',
});

describe("Ramp: ink that lands on the turn a trigger can't fire", () => {
  it('reads when the ramp and the trigger fall on different turns', () => {
    expect(inkLandsOffTriggerTurn(inkAmplifier, scrooge)).toBe(true);
    expect(inkLandsOffTriggerTurn(inkAmplifier, chiefTui)).toBe(true);
    expect(inkLandsOffTriggerTurn(mamaOdie, scrooge)).toBe(false);
  });

  it('scores the pair at 5, from either side', () => {
    const pairs = [scrooge, chiefTui].flatMap((trigger) => [
      rampPair(inkAmplifier, trigger),
      rampPair(trigger, inkAmplifier),
    ]);
    for (const pair of pairs) {
      expect(pair).toMatchObject({score: 5, explanation: '{A} and {B} both go in a Ramp deck.'});
    }
  });

  it('keeps the chain for ramp on your own turn', () => {
    expect(rampPair(mamaOdie, scrooge)?.score).toBe(9);
    expect(rampPair(mamaOdie, chiefTui)?.score).toBe(8);
  });
});

// Ramps from the discard; the Boost reminder before it puts a card under him, not into your inkwell.
const jiminyAbility =
  'LOOK INTO YOUR PAST Whenever you put a card\nunder this character, you may put a card from your\ndiscard into your inkwell facedown and exerted.';
const jiminy = createCard({
  id: 'jiminy-cricket-ghost-of-christmas-past',
  name: 'Jiminy Cricket',
  fullName: 'Jiminy Cricket - Ghost of Christmas Past',
  ink: 'Sapphire',
  text: `Boost 2 ⬡ (Once during your turn, you may pay 2 ⬡\nto put the top card of your deck facedown under this\ncharacter.)\n${jiminyAbility}`,
});

describe('Ramp: a card put into your inkwell from your discard', () => {
  it('reads ramp from that clause, not from the Boost reminder', () => {
    expect(getRampRoles({...jiminy, text: jiminyAbility})).toEqual(['inkwell-ramp']);
    expect(getRampRoles(jiminy)).toEqual(['inkwell-ramp']);
  });
});
