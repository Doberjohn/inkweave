import {describe, it, expect} from 'vitest';
import {SynergyEngine} from '../engine';

import type {LorcanaCard, SynergyRule} from '../types';
import {createCard} from './fixtures.js';

/** Shared Shift pair for multiple tests */
function makeShiftPair() {
  return {
    shift: createCard({
      id: 'elsa-shift',
      name: 'Elsa',
      fullName: 'Elsa - Ice Maker',
      cost: 7,
      keywords: ['Shift 5'],
    }),
    base: createCard({id: 'elsa-base', name: 'Elsa', fullName: 'Elsa - Snow Queen', cost: 3}),
  };
}

describe('SynergyEngine', () => {
  describe('findSynergies', () => {
    it('should find synergies based on registered rules', () => {
      const {shift, base} = makeShiftPair();
      const synergies = new SynergyEngine().findSynergies(shift, [shift, base]);

      expect(synergies.length).toBeGreaterThan(0);
      const shiftGroup = synergies.find((g) => g.groupKey === 'shift-targets');
      expect(shiftGroup).toBeDefined();
      expect(shiftGroup?.category).toBe('direct');
      expect(shiftGroup?.synergies.some((s) => s.card.id === 'elsa-base')).toBe(true);
    });

    it('should not include the source card in results', () => {
      const {shift} = makeShiftPair();
      const synergies = new SynergyEngine().findSynergies(shift, [shift]);
      const allCards = synergies.flatMap((g) => g.synergies.map((s) => s.card.id));
      expect(allCards).not.toContain('elsa-shift');
    });

    it('should sort synergies by score (highest first)', () => {
      const {shift} = makeShiftPair();
      const onCurve = createCard({id: 'elsa-oncurve', name: 'Elsa', cost: 4, inkwell: true});
      const offCurve = createCard({id: 'elsa-offcurve', name: 'Elsa', cost: 5, inkwell: true});

      const shiftGroup = new SynergyEngine()
        .findSynergies(shift, [onCurve, offCurve])
        .find((g) => g.groupKey === 'shift-targets');

      expect(shiftGroup?.synergies).toHaveLength(2);
      expect(shiftGroup?.synergies[0].score).toBeGreaterThanOrEqual(
        shiftGroup?.synergies[1].score ?? 0,
      );
    });

    it('should group direct rules individually and playstyle rules by playstyleId, direct first', () => {
      const {base} = makeShiftPair();
      const shiftLoreDrain = createCard({
        id: 'elsa-shift',
        name: 'Elsa',
        cost: 7,
        keywords: ['Shift 5'],
        text: 'opponent loses 1 lore',
      });
      const loreDrain = createCard({
        id: 'lore-drain',
        name: 'Lore Drain',
        type: 'Action',
        text: 'opponent loses 2 lore',
      });

      const synergies = new SynergyEngine().findSynergies(shiftLoreDrain, [base, loreDrain]);

      const directGroups = synergies.filter((g) => g.category === 'direct');
      const playstyleGroups = synergies.filter((g) => g.category === 'playstyle');

      expect(directGroups).toHaveLength(1);
      expect(directGroups[0].groupKey).toBe('shift-targets');
      expect(playstyleGroups).toHaveLength(1);
      expect(playstyleGroups[0].groupKey).toBe('lore-denial');

      // Direct groups should come first
      expect(synergies[0].category).toBe('direct');
      expect(synergies[1].category).toBe('playstyle');
    });

    it('should merge multiple playstyle rules with same playstyleId into one group', () => {
      const location = createCard({id: 'loc-1', name: 'Castle', type: 'Location'});
      const atPayoff = createCard({
        id: 'at-payoff',
        name: 'Guard',
        text: 'Whenever one of your characters is at a location, they get +1.',
      });
      const moveTo = createCard({
        id: 'mover',
        name: 'Scout',
        text: 'Move one of your characters to a location.',
      });

      const synergies = new SynergyEngine().findSynergies(location, [atPayoff, moveTo]);
      const locationGroups = synergies.filter((g) => g.groupKey === 'location-control');

      expect(locationGroups).toHaveLength(1);
      expect(locationGroups[0].category).toBe('playstyle');
      expect(locationGroups[0].label).toBe('Location Control');
    });
  });

  describe('checkSynergy', () => {
    it('should return true when cards have synergy', () => {
      const {shift, base} = makeShiftPair();
      const result = new SynergyEngine().checkSynergy(shift, base);

      expect(result.hasSynergy).toBe(true);
      expect(result.synergies[0].category).toBe('direct');
      expect(result.synergies[0].groupKey).toBe('shift-targets');
    });

    it('should return false when cards have no synergy', () => {
      const card1 = createCard({id: 'card-1', name: 'Random Card 1'});
      const card2 = createCard({id: 'card-2', name: 'Random Card 2'});
      const result = new SynergyEngine().checkSynergy(card1, card2);

      expect(result.hasSynergy).toBe(false);
      expect(result.synergies).toHaveLength(0);
    });
  });

  describe('findSynergiesFlat', () => {
    it('should return a flat deduplicated list with category info', () => {
      const {shift, base} = makeShiftPair();
      const results = new SynergyEngine().findSynergiesFlat(shift, [shift, base]);

      expect(Array.isArray(results)).toBe(true);
      results.forEach((r) => {
        expect(r.category).toBeDefined();
        expect(r.groupKey).toBeDefined();
        expect(typeof r.score).toBe('number');
      });
    });
  });

  describe('custom rules', () => {
    it('should allow adding and using custom rules', () => {
      const customRule: SynergyRule = {
        id: 'custom-test',
        name: 'Custom Test Rule',
        category: 'direct',
        description: 'Test rule',
        matches: (card) => card.name === 'Source',
        findSynergies: (card, allCards) =>
          allCards
            .filter((c) => c.id !== card.id && c.name === 'Target')
            .map((c) => ({card: c, score: 7, explanation: 'Custom synergy found'})),
      };

      const engine = new SynergyEngine({rules: [customRule]});
      expect(engine.getRules().some((r) => r.id === 'custom-test')).toBe(true);

      const source = createCard({id: '1', name: 'Source'});
      const target = createCard({id: '2', name: 'Target'});
      const other = createCard({id: '3', name: 'Other'});
      const synergies = engine.findSynergies(source, [source, target, other]);

      expect(synergies).toHaveLength(1);
      expect(synergies[0].synergies[0].card.name).toBe('Target');
    });
  });

  describe('getPairSynergies', () => {
    it('should return connections for a Shift pair', () => {
      const {shift, base} = makeShiftPair();
      const result = new SynergyEngine().getPairSynergies(shift, base);

      expect(result.cardA.id).toBe('elsa-shift');
      expect(result.cardB.id).toBe('elsa-base');

      const shiftConn = result.connections.find((c) => c.ruleId === 'shift-targets');
      expect(shiftConn).toBeDefined();
      expect(shiftConn!.category).toBe('direct');
      expect(shiftConn!.score).toBeGreaterThan(0);
    });

    it('should return multiple connections when cards match multiple rules', () => {
      const shiftLoreDrain = createCard({
        id: 'shift-drain',
        name: 'Elsa',
        cost: 7,
        keywords: ['Shift 5'],
        text: 'opponent loses 1 lore',
      });
      const elsaBase = createCard({
        id: 'elsa-base',
        name: 'Elsa',
        cost: 3,
        text: 'opponent loses 2 lore',
      });

      const result = new SynergyEngine().getPairSynergies(shiftLoreDrain, elsaBase);
      expect(result.connections.length).toBeGreaterThanOrEqual(2);
      expect(result.connections.some((c) => c.ruleId === 'shift-targets')).toBe(true);
      expect(result.connections.some((c) => c.category === 'playstyle')).toBe(true);
    });

    it('should return empty connections and score 0 for unrelated cards', () => {
      const card1 = createCard({id: 'card-1', name: 'Random Card 1'});
      const card2 = createCard({id: 'card-2', name: 'Random Card 2'});

      const result = new SynergyEngine().getPairSynergies(card1, card2);
      expect(result.connections).toHaveLength(0);
      expect(result.aggregateScore).toBe(0);
    });

    it('should deduplicate bidirectional matches by ruleId', () => {
      const {shift, base} = makeShiftPair();
      const result = new SynergyEngine().getPairSynergies(shift, base);
      const shiftConnections = result.connections.filter((c) => c.ruleId === 'shift-targets');
      expect(shiftConnections).toHaveLength(1);
    });
  });

  describe('ink compatibility filtering', () => {
    it('should filter out ink-incompatible cards when source is dual-ink', () => {
      const dualInkShift = createCard({
        id: 'dual-shift',
        name: 'Elsa',
        cost: 7,
        ink: 'Amethyst',
        ink2: 'Sapphire',
        keywords: ['Shift 5'],
      });
      const compatBase = createCard({id: 'compat-base', name: 'Elsa', cost: 3, ink: 'Amethyst'});
      const incompatBase = createCard({id: 'incompat-base', name: 'Elsa', cost: 3, ink: 'Ruby'});

      const allCardIds = new SynergyEngine()
        .findSynergies(dualInkShift, [compatBase, incompatBase])
        .flatMap((g) => g.synergies.map((s) => s.card.id));

      expect(allCardIds).toContain('compat-base');
      expect(allCardIds).not.toContain('incompat-base');
    });

    it('should allow any single-ink pair (deck inks unknown)', () => {
      const singleInkShift = createCard({
        id: 'single-shift',
        name: 'Elsa',
        cost: 7,
        ink: 'Amethyst',
        keywords: ['Shift 5'],
      });
      const rubyBase = createCard({id: 'ruby-base', name: 'Elsa', cost: 3, ink: 'Ruby'});

      const allCardIds = new SynergyEngine()
        .findSynergies(singleInkShift, [rubyBase])
        .flatMap((g) => g.synergies.map((s) => s.card.id));
      expect(allCardIds).toContain('ruby-base');
    });

    it('should filter out dual-ink results incompatible with single-ink source', () => {
      const rubyElsa = createCard({id: 'ruby-elsa', name: 'Elsa', cost: 3, ink: 'Ruby'});
      const dualElsa = createCard({
        id: 'dual-elsa',
        name: 'Elsa',
        cost: 7,
        ink: 'Amethyst',
        ink2: 'Sapphire',
        keywords: ['Shift 5'],
      });

      const allCardIds = new SynergyEngine()
        .findSynergies(rubyElsa, [dualElsa])
        .flatMap((g) => g.synergies.map((s) => s.card.id));
      expect(allCardIds).not.toContain('dual-elsa');
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
            .map((c) => ({card: c, score: 5, explanation: 'Match'})),
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

  describe('getPlaystyleCards', () => {
    const mockPlaystyleRule = (
      playstyleId: 'lore-denial' | 'location-control',
      matchFn: (card: LorcanaCard) => boolean,
    ): SynergyRule => ({
      id: `mock-${playstyleId}`,
      name: `Mock ${playstyleId}`,
      description: 'test rule',
      category: 'playstyle' as const,
      playstyleId,
      matches: matchFn,
      findSynergies: () => [],
    });

    it('returns cards matching a playstyle rule', () => {
      const engine = new SynergyEngine({
        rules: [mockPlaystyleRule('lore-denial', (c) => c.cost >= 5)],
      });
      const cards = [
        createCard({id: '1', name: 'Cheap', cost: 2}),
        createCard({id: '2', name: 'Expensive', cost: 6}),
        createCard({id: '3', name: 'Also Expensive', cost: 5}),
      ];
      expect(engine.getPlaystyleCards('lore-denial', cards).map((c) => c.name)).toEqual([
        'Also Expensive',
        'Expensive',
      ]);
    });

    it('returns empty array for a playstyle with no rules', () => {
      const engine = new SynergyEngine({rules: [mockPlaystyleRule('lore-denial', () => true)]});
      expect(engine.getPlaystyleCards('location-control', [createCard({})])).toEqual([]);
    });

    it('deduplicates cards matching multiple rules in the same playstyle', () => {
      const engine = new SynergyEngine({
        rules: [
          mockPlaystyleRule('lore-denial', (c) => c.cost >= 5),
          mockPlaystyleRule('lore-denial', (c) => c.ink === 'Amethyst'),
        ],
      });
      const cards = [
        createCard({id: '1', name: 'Both Match', cost: 7, ink: 'Amethyst'}),
        createCard({id: '2', name: 'Cost Only', cost: 6, ink: 'Ruby'}),
      ];
      expect(engine.getPlaystyleCards('lore-denial', cards)).toHaveLength(2);
    });

    it('returns results sorted by name', () => {
      const engine = new SynergyEngine({rules: [mockPlaystyleRule('lore-denial', () => true)]});
      const cards = [
        createCard({id: '1', name: 'Zebra'}),
        createCard({id: '2', name: 'Alpha'}),
        createCard({id: '3', name: 'Middle'}),
      ];
      expect(engine.getPlaystyleCards('lore-denial', cards).map((c) => c.name)).toEqual([
        'Alpha',
        'Middle',
        'Zebra',
      ]);
    });
  });
});
