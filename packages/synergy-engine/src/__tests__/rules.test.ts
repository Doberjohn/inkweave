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

    it('should not match non-Character cards', () => {
      const shiftAction = createCard({
        id: 'action-1',
        type: 'Action',
        keywords: ['Shift 3'],
      });

      expect(shiftRule.matches(shiftAction)).toBe(false);
    });
  });

  describe('Lore Loss', () => {
    const loreLossRule = getRuleById('lore-loss')!;

    const thievery = createCard({
      id: 'thievery',
      name: 'Thievery',
      fullName: 'Thievery',
      type: 'Action',
      ink: 'Ruby',
      cost: 1,
      text: 'Chosen opponent loses 1 lore. Gain 1 lore.',
    });

    const jasmine = createCard({
      id: 'jasmine-rebellious',
      name: 'Jasmine',
      fullName: 'Jasmine - Rebellious Princess',
      ink: 'Ruby',
      cost: 3,
      text: "YOU'LL NEVER MISS IT Whenever this character quests, each opponent loses 1 lore.",
    });

    const flotilla = createCard({
      id: 'flotilla',
      name: 'Flotilla',
      fullName: 'Flotilla - Coconut Armada',
      type: 'Location',
      ink: 'Ruby',
      cost: 2,
      text: 'TINY THIEVES At the start of your turn, if you have a character here, all opponents lose 1 lore and you gain lore equal to the lore lost this way.',
    });

    const unrelatedCard = createCard({
      id: 'anna-1',
      name: 'Anna',
      fullName: 'Anna - Heir to Arendelle',
      cost: 3,
      text: 'When you play this character, draw a card.',
    });

    it('should match cards with lore loss text', () => {
      expect(loreLossRule.matches(thievery)).toBe(true);
      expect(loreLossRule.matches(jasmine)).toBe(true);
      expect(loreLossRule.matches(flotilla)).toBe(true);
    });

    it('should not match cards without lore loss text', () => {
      expect(loreLossRule.matches(unrelatedCard)).toBe(false);
      expect(loreLossRule.matches(createCard({}))).toBe(false);
    });

    it('should match lore loss without numeric amount', () => {
      const nanisPayback = createCard({
        id: 'nanis-payback',
        name: "Nani's Payback",
        text: 'Each opponent loses lore equal to the damage on chosen character of yours, to a maximum of 4 lore each.',
      });
      expect(loreLossRule.matches(nanisPayback)).toBe(true);
    });

    it('should find other lore removers as strong synergies', () => {
      const allCards = [thievery, jasmine, flotilla, unrelatedCard];
      const synergies = loreLossRule.findSynergies(thievery, allCards);

      expect(synergies).toHaveLength(2);
      expect(synergies.every((s) => s.strength === 'strong')).toBe(true);
      expect(synergies.find((s) => s.card.id === 'jasmine-rebellious')).toBeDefined();
      expect(synergies.find((s) => s.card.id === 'flotilla')).toBeDefined();
    });

    it('should not include the selected card itself', () => {
      const allCards = [thievery, jasmine];
      const synergies = loreLossRule.findSynergies(thievery, allCards);

      expect(synergies.find((s) => s.card.id === 'thievery')).toBeUndefined();
    });

    it('should mark synergies as bidirectional', () => {
      const allCards = [thievery, jasmine];
      const synergies = loreLossRule.findSynergies(thievery, allCards);

      expect(synergies[0].bidirectional).toBe(true);
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
