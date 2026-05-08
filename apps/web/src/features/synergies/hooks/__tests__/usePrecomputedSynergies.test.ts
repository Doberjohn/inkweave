import {describe, it, expect} from 'vitest';
import type {PairSynergyConnection} from 'inkweave-synergy-engine';
import {filterPairByGroup} from '../usePrecomputedSynergies';
import type {PrecomputedPairData} from '../usePrecomputedSynergies';

const directConnection = (overrides: Partial<PairSynergyConnection> = {}): PairSynergyConnection => ({
  ruleId: 'shift-targets',
  ruleName: 'Shift Targets',
  category: 'direct',
  score: 9,
  explanation: 'Anna can Shift onto Anna - Heir to Arendelle',
  ...overrides,
} as PairSynergyConnection);

const playstyleConnection = (overrides: Partial<PairSynergyConnection> = {}): PairSynergyConnection => ({
  ruleId: 'location-at-payoff',
  ruleName: 'At Location',
  category: 'playstyle',
  playstyleId: 'location-control',
  score: 5,
  explanation: 'Earns extra lore at Arendelle Castle',
  ...overrides,
} as PairSynergyConnection);

describe('filterPairByGroup', () => {
  it('returns the pair unchanged when groupKey is undefined', () => {
    const pair: PrecomputedPairData = {
      connections: [directConnection({score: 9}), playstyleConnection({score: 5})],
      aggregateScore: 9,
    };
    const result = filterPairByGroup(pair, undefined);
    expect(result).toEqual({connections: pair.connections, aggregateScore: 9});
  });

  it('keeps only the matching direct rule and recomputes aggregateScore', () => {
    const pair: PrecomputedPairData = {
      connections: [
        directConnection({ruleId: 'shift-targets', score: 9}),
        directConnection({ruleId: 'named-companions', ruleName: 'Named Companions', score: 6}),
        playstyleConnection({score: 5}),
      ],
      aggregateScore: 9,
    };
    const result = filterPairByGroup(pair, 'shift-targets');
    expect(result?.connections).toHaveLength(1);
    expect(result?.connections[0].ruleId).toBe('shift-targets');
    expect(result?.aggregateScore).toBe(9);
  });

  it('merges multi-role playstyle connections under the playstyle groupKey', () => {
    const pair: PrecomputedPairData = {
      connections: [
        directConnection({score: 9}),
        playstyleConnection({ruleId: 'location-at-payoff', score: 5}),
        playstyleConnection({ruleId: 'location-buff', score: 4}),
        playstyleConnection({ruleId: 'location-move', score: 3}),
      ],
      aggregateScore: 9,
    };
    const result = filterPairByGroup(pair, 'location-control');
    expect(result?.connections).toHaveLength(3);
    expect(result?.connections.every((c) => c.category === 'playstyle')).toBe(true);
    expect(result?.aggregateScore).toBe(5);
  });

  it('returns null when no connections match the group', () => {
    const pair: PrecomputedPairData = {
      connections: [directConnection({score: 9})],
      aggregateScore: 9,
    };
    const result = filterPairByGroup(pair, 'ramp');
    expect(result).toBeNull();
  });

  it('does not match a direct ruleId against a playstyle groupKey', () => {
    // Defensive: a direct rule with id 'location-at-payoff' should NOT match
    // the 'location-control' playstyle key — playstyle filters check playstyleId only.
    const pair: PrecomputedPairData = {
      connections: [
        directConnection({ruleId: 'location-at-payoff', category: 'direct', score: 7}),
      ],
      aggregateScore: 7,
    };
    const result = filterPairByGroup(pair, 'location-control');
    expect(result).toBeNull();
  });
});
