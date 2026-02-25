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
      const shiftGroup = synergies.find((g) => g.groupKey === 'shift-targets');
      expect(shiftGroup).toBeDefined();
      expect(shiftGroup?.category).toBe('direct');
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

      const elsaOnCurve = createCard({
        id: 'elsa-oncurve',
        name: 'Elsa',
        fullName: 'Elsa - Snow Queen',
        cost: 4,
        inkwell: true,
      });

      const elsaOffCurve = createCard({
        id: 'elsa-offcurve',
        name: 'Elsa',
        fullName: 'Elsa - Frost Mage',
        cost: 5,
        inkwell: true,
      });

      const synergies = engine.findSynergies(elsaShift, [elsaOnCurve, elsaOffCurve]);
      const shiftGroup = synergies.find((g) => g.groupKey === 'shift-targets');

      expect(shiftGroup).toBeDefined();
      expect(shiftGroup?.synergies).toHaveLength(2);
      // Strong (curveGap 1, inkable) should come before moderate (curveGap 0)
      expect(shiftGroup?.synergies[0].strength).toBe('strong');
      expect(shiftGroup?.synergies[1].strength).toBe('moderate');
    });

    it('should group direct rules individually and playstyle rules by playstyleId', () => {
      const engine = new SynergyEngine();

      // Card that triggers both shift (direct) and lore-loss (playstyle)
      const elsaShift = createCard({
        id: 'elsa-shift',
        name: 'Elsa',
        fullName: 'Elsa - Ice Maker',
        cost: 7,
        keywords: ['Shift 5'],
        text: 'opponent loses 1 lore',
      });

      const elsaBase = createCard({
        id: 'elsa-base',
        name: 'Elsa',
        fullName: 'Elsa - Snow Queen',
        cost: 3,
      });

      const loreDrain = createCard({
        id: 'lore-drain',
        name: 'Lore Drain',
        fullName: 'Lore Drain - Spell',
        type: 'Action',
        text: 'opponent loses 2 lore',
      });

      const synergies = engine.findSynergies(elsaShift, [elsaBase, loreDrain]);

      // Should have two groups: shift-targets (direct) and lore-denial (playstyle)
      const directGroups = synergies.filter((g) => g.category === 'direct');
      const playstyleGroups = synergies.filter((g) => g.category === 'playstyle');

      expect(directGroups).toHaveLength(1);
      expect(directGroups[0].groupKey).toBe('shift-targets');

      expect(playstyleGroups).toHaveLength(1);
      expect(playstyleGroups[0].groupKey).toBe('lore-denial');
    });

    it('should sort direct groups before playstyle groups', () => {
      const engine = new SynergyEngine();

      const elsaShift = createCard({
        id: 'elsa-shift',
        name: 'Elsa',
        fullName: 'Elsa - Ice Maker',
        cost: 7,
        keywords: ['Shift 5'],
        text: 'opponent loses 1 lore',
      });

      const elsaBase = createCard({
        id: 'elsa-base',
        name: 'Elsa',
        fullName: 'Elsa - Snow Queen',
        cost: 3,
      });

      const loreDrain = createCard({
        id: 'lore-drain',
        name: 'Lore Drain',
        fullName: 'Lore Drain - Spell',
        type: 'Action',
        text: 'opponent loses 2 lore',
      });

      const synergies = engine.findSynergies(elsaShift, [elsaBase, loreDrain]);

      expect(synergies[0].category).toBe('direct');
      expect(synergies[1].category).toBe('playstyle');
    });

    it('should merge multiple playstyle rules with same playstyleId into one group', () => {
      const engine = new SynergyEngine();

      // A location card should trigger multiple location-* rules, all merging into 'location-control'
      const location = createCard({
        id: 'loc-1',
        name: 'Castle',
        fullName: 'Castle - Fortress',
        type: 'Location',
      });

      const atPayoff = createCard({
        id: 'at-payoff',
        name: 'Guard',
        fullName: 'Guard - Sentry',
        text: 'Whenever one of your characters is at a location, they get +1.',
      });

      const moveTo = createCard({
        id: 'mover',
        name: 'Scout',
        fullName: 'Scout - Explorer',
        text: 'Move one of your characters to a location.',
      });

      const synergies = engine.findSynergies(location, [atPayoff, moveTo]);

      // All location rules should merge into a single 'location-control' group
      const locationGroups = synergies.filter((g) => g.groupKey === 'location-control');
      expect(locationGroups).toHaveLength(1);
      expect(locationGroups[0].category).toBe('playstyle');
      expect(locationGroups[0].label).toBe('Location Control');
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
      expect(result.synergies[0].category).toBe('direct');
      expect(result.synergies[0].groupKey).toBe('shift-targets');
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
    it('should return a flat deduplicated list with category info', () => {
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
        expect(r.category).toBeDefined();
        expect(r.groupKey).toBeDefined();
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
        category: 'direct',
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
        category: 'direct',
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

  describe('maxResultsPerGroup', () => {
    it('should limit results per group', () => {
      const customRule: SynergyRule = {
        id: 'many-matches',
        name: 'Many Matches',
        category: 'direct',
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

      const engine = new SynergyEngine({rules: [customRule], maxResultsPerGroup: 3});

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
