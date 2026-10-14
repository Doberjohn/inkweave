import {describe, it, expect} from 'vitest';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Named Companions fixes from the 2026-10-14 misread review, kept out of rules.test.ts (CodeScene:
// function count). Real card text.

const namedRule = getRuleById('named-companions')!;
/** The Named Companions pair `card` finds with `partner`, or undefined when they do not pair. */
const namedPair = (card: LorcanaCard, partner: LorcanaCard) =>
  namedRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// A cost threshold beside the named card, and a cost reduction for having the named card.
const johnSmithsCompass = createCard({
  id: 'john-smiths-compass',
  name: "John Smith's Compass",
  fullName: "John Smith's Compass",
  type: 'Item',
  text: "SPINNING ARROW At the end of your turn, if a character of\nyours challenged this turn, banish this item.\nYOUR PATH At the end of your turn, if none of your\ncharacters challenged this turn, reveal the top card of your\ndeck. If it's a character card with cost 3 or less or named\nPocahontas, you may put it into your hand. Otherwise, put it\non the bottom of your deck.",
});
const vixey = createCard({
  id: 'vixey-forest-friend',
  name: 'Vixey',
  fullName: 'Vixey - Forest Friend',
  ink: 'Emerald',
  keywords: ['Evasive'],
  classifications: ['Storyborn', 'Ally'],
  text: "SHOWIN' UP If you have a character named Tod\nin play, you pay 1 ⬡ less to play this character.\nEvasive (Only characters with Evasive can\nchallenge this character.)",
});
const pocahontas = createCard({
  id: 'pocahontas-peacekeeper',
  name: 'Pocahontas',
  fullName: 'Pocahontas - Peacekeeper',
  cost: 5,
  classifications: ['Floodborn', 'Hero', 'Princess'],
  keywords: ['Shift 3'],
  text: "Shift 3 ⬡ (You may pay 3 ⬡ to play this on top of\none of your characters named Pocahontas.)\nCALMING WORDS When you play this character,\nif you used Shift to play her and none of your\ncharacters challenged this turn, characters can't\nchallenge until the start of your next turn.",
});
const tod = createCard({
  id: 'tod-all-alone',
  name: 'Tod',
  fullName: 'Tod - All Alone',
  ink: 'Emerald',
  cost: 1,
  classifications: ['Storyborn', 'Hero'],
  text: '',
});

describe('Named Companions: a cost threshold is no cost reduction', () => {
  it('scores "cost 3 or less" beside the named card as a minor effect', () => {
    expect(namedPair(johnSmithsCompass, pocahontas)).toMatchObject({
      score: 5,
      explanation: '{A} has a minor effect that names {B}.',
    });
  });

  it('keeps the strong tier for "pay 1 ⬡ less"', () => {
    expect(namedPair(vixey, tod)?.score).toBe(7);
  });
});
