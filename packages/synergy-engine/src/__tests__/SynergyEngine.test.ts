import {describe, it, expect} from 'vitest';
import {SynergyEngine} from '../engine/SynergyEngine.js';
import type {SynergyRule} from '../types/synergy.js';
import {createCard} from './fixtures.js';

describe('SynergyEngine', () => {
  describe('findSynergies', () => {
    it('should find synergies based on registered rules', () => {
      const engine = new SynergyEngine();

      const elsaShift = createCard({
        id: 'elsa-shift',
        name: 'Elsa',
        fullName: 'Elsa - Ice Maker',
        cost: 7,
        keywords: ['Shift 5'],
      });

      const elsaBase = createCard({
        id: 'elsa-base',
        name: 'Elsa',
        fullName: 'Elsa - Snow Queen',
        cost: 3,
      });

      const allCards = [elsaShift, elsaBase];
      const synergies = engine.findSynergies(elsaShift, allCards);

      expect(synergies.length).toBeGreaterThan(0);
      const shiftGroup = synergies.find((g) => g.type === 'shift');
      expect(shiftGroup).toBeDefined();
      expect(shiftGroup?.synergies.some((s) => s.card.id === 'elsa-base')).toBe(true);
    });

    it('should not include the source card in results', () => {
      const engine = new SynergyEngine();

      const elsaShift = createCard({
        id: 'elsa-shift',
        name: 'Elsa',
        keywords: ['Shift 5'],
      });

      const synergies = engine.findSynergies(elsaShift, [elsaShift]);

      const allCards = synergies.flatMap((g) => g.synergies.map((s) => s.card.id));
      expect(allCards).not.toContain('elsa-shift');
    });

    it('should sort synergies by strength (strong first)', () => {
      const engine = new SynergyEngine();

      const elsaShift = createCard({
        id: 'elsa-shift',
        name: 'Elsa',
        fullName: 'Elsa - Ice Maker',
        cost: 7,
        keywords: ['Shift 5'],
      });

      const elsaCheap = createCard({
        id: 'elsa-cheap',
        name: 'Elsa',
        fullName: 'Elsa - Snow Queen',
        cost: 2,
      });

      const elsaMid = createCard({
        id: 'elsa-mid',
        name: 'Elsa',
        fullName: 'Elsa - Frost Mage',
        cost: 5,
      });

      const synergies = engine.findSynergies(elsaShift, [elsaCheap, elsaMid]);
      const shiftGroup = synergies.find((g) => g.type === 'shift');

      expect(shiftGroup).toBeDefined();
      expect(shiftGroup?.synergies).toHaveLength(2);
      // Strong (cost diff 5) should come before moderate (cost diff 2)
      expect(shiftGroup?.synergies[0].strength).toBe('strong');
      expect(shiftGroup?.synergies[1].strength).toBe('moderate');
    });
  });

  describe('checkSynergy', () => {
    it('should return true when cards have synergy', () => {
      const engine = new SynergyEngine();

      const elsaShift = createCard({
        id: 'elsa-shift',
        name: 'Elsa',
        fullName: 'Elsa - Ice Maker',
        cost: 7,
        keywords: ['Shift 5'],
      });

      const elsaBase = createCard({
        id: 'elsa-base',
        name: 'Elsa',
        fullName: 'Elsa - Snow Queen',
        cost: 3,
      });

      const result = engine.checkSynergy(elsaShift, elsaBase);

      expect(result.hasSynergy).toBe(true);
      expect(result.synergies.length).toBeGreaterThan(0);
      expect(result.synergies[0].type).toBe('shift');
    });

    it('should return false when cards have no synergy', () => {
      const engine = new SynergyEngine();

      const card1 = createCard({
        id: 'card-1',
        name: 'Random Card 1',
        cost: 3,
      });

      const card2 = createCard({
        id: 'card-2',
        name: 'Random Card 2',
        cost: 5,
      });

      const result = engine.checkSynergy(card1, card2);

      expect(result.hasSynergy).toBe(false);
      expect(result.synergies).toHaveLength(0);
    });
  });

  describe('findSynergiesFlat', () => {
    it('should return a flat deduplicated list', () => {
      const engine = new SynergyEngine();

      const elsaShift = createCard({
        id: 'elsa-shift',
        name: 'Elsa',
        fullName: 'Elsa - Ice Maker',
        cost: 7,
        keywords: ['Shift 5'],
      });

      const elsaBase = createCard({
        id: 'elsa-base',
        name: 'Elsa',
        fullName: 'Elsa - Snow Queen',
        cost: 3,
      });

      const results = engine.findSynergiesFlat(elsaShift, [elsaShift, elsaBase]);

      expect(Array.isArray(results)).toBe(true);
      results.forEach((r) => {
        expect(r.type).toBeDefined();
        expect(r.card).toBeDefined();
        expect(r.strength).toBeDefined();
      });
    });
  });

  describe('custom rules', () => {
    it('should allow adding custom rules', () => {
      const engine = new SynergyEngine({rules: []});

      const customRule: SynergyRule = {
        id: 'custom-test',
        name: 'Custom Test Rule',
        type: 'mechanic',
        description: 'Test rule',
        matches: (card) => card.name === 'Test',
        findSynergies: (card, allCards) =>
          allCards
            .filter((c) => c.id !== card.id && c.name === 'Synergy Target')
            .map((c) => ({
              card: c,
              strength: 'strong' as const,
              explanation: 'Custom synergy',
            })),
      };

      engine.addRule(customRule);

      const rules = engine.getRules();
      expect(rules.some((r) => r.id === 'custom-test')).toBe(true);
    });

    it('should use custom rules for synergy detection', () => {
      const customRule: SynergyRule = {
        id: 'custom-test',
        name: 'Custom Test Rule',
        type: 'mechanic',
        description: 'Test rule',
        matches: (card) => card.name === 'Source',
        findSynergies: (card, allCards) =>
          allCards
            .filter((c) => c.id !== card.id && c.name === 'Target')
            .map((c) => ({
              card: c,
              strength: 'strong' as const,
              explanation: 'Custom synergy found',
            })),
      };

      const engine = new SynergyEngine({rules: [customRule]});

      const source = createCard({id: '1', name: 'Source'});
      const target = createCard({id: '2', name: 'Target'});
      const other = createCard({id: '3', name: 'Other'});

      const synergies = engine.findSynergies(source, [source, target, other]);

      expect(synergies).toHaveLength(1);
      expect(synergies[0].synergies).toHaveLength(1);
      expect(synergies[0].synergies[0].card.name).toBe('Target');
      expect(synergies[0].synergies[0].explanation).toBe('Custom synergy found');
    });
  });

  describe('maxResultsPerType', () => {
    it('should limit results per type', () => {
      const customRule: SynergyRule = {
        id: 'many-matches',
        name: 'Many Matches',
        type: 'mechanic',
        description: 'Matches everything',
        matches: () => true,
        findSynergies: (card, allCards) =>
          allCards
            .filter((c) => c.id !== card.id)
            .map((c) => ({
              card: c,
              strength: 'moderate' as const,
              explanation: 'Match',
            })),
      };

      const engine = new SynergyEngine({rules: [customRule], maxResultsPerType: 3});

      const source = createCard({id: '0', name: 'Source'});
      const cards = [
        source,
        ...Array.from({length: 10}, (_, i) =>
          createCard({id: String(i + 1), name: `Card ${i + 1}`}),
        ),
      ];

      const synergies = engine.findSynergies(source, cards);

      expect(synergies[0].synergies.length).toBeLessThanOrEqual(3);
    });
  });
});
