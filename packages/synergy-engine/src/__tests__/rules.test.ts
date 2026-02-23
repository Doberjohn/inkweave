import {describe, it, expect} from 'vitest';
import {getRuleById} from '../engine/rules.js';
import {hasNegativeTargeting, hasPositiveClassificationEffect} from '../utils/cardHelpers.js';
import {createCard} from './fixtures.js';

describe('Synergy Rules', () => {
  describe('Shift Targets', () => {
    const shiftRule = getRuleById('shift-targets')!;

    it('should find same-named characters for Shift', () => {
      const elsaShift = createCard({
        id: 'elsa-shift',
        name: 'Elsa',
        fullName: 'Elsa - Ice Maker',
        cost: 7,
        keywords: ['Shift 5'],
        classifications: ['Floodborn'],
      });

      const elsaBase = createCard({
        id: 'elsa-base',
        name: 'Elsa',
        fullName: 'Elsa - Snow Queen',
        cost: 4,
      });

      const anna = createCard({
        id: 'anna-1',
        name: 'Anna',
        fullName: 'Anna - Heir to Arendelle',
        cost: 3,
      });

      const allCards = [elsaShift, elsaBase, anna];
      const synergies = shiftRule.findSynergies(elsaShift, allCards);

      expect(synergies.find((s) => s.card.id === 'elsa-base')).toBeDefined();
      expect(synergies.find((s) => s.card.id === 'anna-1')).toBeUndefined();
    });

    it('should find Shift cards when selecting a base character (reverse)', () => {
      const elsaShift = createCard({
        id: 'elsa-shift',
        name: 'Elsa',
        fullName: 'Elsa - Ice Maker',
        cost: 7,
        keywords: ['Shift 5'],
        classifications: ['Floodborn'],
      });

      const elsaBase = createCard({
        id: 'elsa-base',
        name: 'Elsa',
        fullName: 'Elsa - Snow Queen',
        cost: 4,
      });

      const anna = createCard({
        id: 'anna-1',
        name: 'Anna',
        fullName: 'Anna - Heir to Arendelle',
        cost: 3,
      });

      const allCards = [elsaShift, elsaBase, anna];
      const synergies = shiftRule.findSynergies(elsaBase, allCards);

      expect(synergies.find((s) => s.card.id === 'elsa-shift')).toBeDefined();
      expect(synergies.find((s) => s.card.id === 'anna-1')).toBeUndefined();
    });

    it('should not show other Shift cards in forward direction', () => {
      const elsaShift1 = createCard({
        id: 'elsa-shift-1',
        name: 'Elsa',
        fullName: 'Elsa - Ice Maker',
        cost: 7,
        keywords: ['Shift 5'],
      });

      const elsaShift2 = createCard({
        id: 'elsa-shift-2',
        name: 'Elsa',
        fullName: 'Elsa - Frost Mage',
        cost: 6,
        keywords: ['Shift 4'],
      });

      const elsaBase = createCard({
        id: 'elsa-base',
        name: 'Elsa',
        fullName: 'Elsa - Snow Queen',
        cost: 3,
      });

      const allCards = [elsaShift1, elsaShift2, elsaBase];
      const synergies = shiftRule.findSynergies(elsaShift1, allCards);

      expect(synergies.find((s) => s.card.id === 'elsa-base')).toBeDefined();
      expect(synergies.find((s) => s.card.id === 'elsa-shift-2')).toBeUndefined();
    });
  });
});

describe('Card Helper Functions', () => {
  describe('hasNegativeTargeting', () => {
    it('should detect exert targeting', () => {
      const card = createCard({
        text: 'When you play this character, you may exert chosen Princess character.',
      });

      expect(hasNegativeTargeting(card, 'Princess')).toBe(true);
      expect(hasNegativeTargeting(card, 'Villain')).toBe(false);
    });

    it('should detect banish targeting', () => {
      const card = createCard({
        text: 'Banish target Villain character.',
      });

      expect(hasNegativeTargeting(card, 'Villain')).toBe(true);
    });
  });

  describe('hasPositiveClassificationEffect', () => {
    it('should detect positive buff effects', () => {
      const card = createCard({
        text: 'Your Princess characters get +2 strength.',
      });

      expect(hasPositiveClassificationEffect(card, 'Princess')).toBe(true);
    });

    it('should detect conditional benefits', () => {
      const card = createCard({
        text: 'If you have a Villain character, draw a card.',
      });

      expect(hasPositiveClassificationEffect(card, 'Villain')).toBe(true);
    });
  });
});
