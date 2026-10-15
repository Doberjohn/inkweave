import {describe, it, expect} from 'vitest';
import {getNamedReferences, getShiftAliasNames} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard, SynergyRule} from '../types';

// Shift Targets fixes from the 2026-10-14 misread review, kept out of rules.test.ts (CodeScene:
// function count). Real card text.

const shiftRule = getRuleById('shift-targets')!;
const namedRule = getRuleById('named-companions')!;
/** The pair `card` finds with `partner` through `rule`, or undefined when they do not pair. */
const pairThrough = (rule: SynergyRule, card: LorcanaCard, partner: LorcanaCard) =>
  rule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// A character that also counts as being named Syndrome for Shift.
const incrediboy = createCard({
  id: 'incrediboy-buddy-pine',
  name: 'Incrediboy',
  fullName: 'Incrediboy - Buddy Pine',
  ink: 'Steel',
  cost: 2,
  classifications: ['Storyborn', 'Inventor'],
  text: 'NERDING OUT When you play this character, if a\nHero character is in play, gain 1 lore.\nSPOILER ALERT This character also counts as\nbeing named Syndrome for Shift.',
});
// A Shift onto Syndrome, and a Syndrome with no Shift.
const syndromeOutForRevenge = createCard({
  id: 'syndrome-out-for-revenge',
  name: 'Syndrome',
  fullName: 'Syndrome - Out for Revenge',
  ink: 'Steel',
  cost: 6,
  classifications: ['Dreamborn', 'Super', 'Villain', 'Inventor'],
  keywords: ['Shift 4'],
  text: 'Shift 4 ⬡ (You may pay 4 ⬡ to play this on top of\none of your characters named Syndrome.)\nGOT ME MONOLOGUING! Whenever this character\nquests, return a Robot character card from your\ndiscard to your hand. Then, you may play or shift\na Robot character with cost 8 or less for free.',
});
const syndromeEvilInventor = createCard({
  id: 'syndrome-evil-inventor',
  name: 'Syndrome',
  fullName: 'Syndrome - Evil Inventor',
  ink: 'Sapphire',
  cost: 3,
  classifications: ['Storyborn', 'Super', 'Villain', 'Inventor'],
  keywords: ['Alert'],
  text: 'Alert (This character can challenge as if they had\nEvasive.)',
});

describe('Shift Targets: a character that counts as another name for Shift', () => {
  it('takes a Shift onto that name, from either side', () => {
    expect(getShiftAliasNames(incrediboy)).toEqual(['Syndrome']);
    expect(pairThrough(shiftRule, syndromeOutForRevenge, incrediboy)).toBeDefined();
    expect(pairThrough(shiftRule, incrediboy, syndromeOutForRevenge)).toBeDefined();
  });

  it('reads the alias as no named companion', () => {
    expect(getNamedReferences(incrediboy)).toEqual([]);
    expect(pairThrough(namedRule, incrediboy, syndromeEvilInventor)).toBeUndefined();
  });
});
