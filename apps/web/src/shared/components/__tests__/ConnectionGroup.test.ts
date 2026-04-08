import {describe, it, expect} from 'vitest';
import {groupConnections} from '../ConnectionGroup';
import type {PairSynergyConnection} from 'inkweave-synergy-engine';

const direct = (id: string, score: number): PairSynergyConnection => ({
  ruleId: id,
  ruleName: id,
  category: 'direct',
  score,
  explanation: `Explanation for ${id}`,
});

const playstyle = (ruleId: string, playstyleId: string, score: number): PairSynergyConnection => ({
  ruleId,
  ruleName: ruleId,
  category: 'playstyle',
  playstyleId,
  score,
  explanation: `Explanation for ${ruleId}`,
});

describe('groupConnections', () => {
  it('keeps direct connections as individual groups', () => {
    const groups = groupConnections([direct('shift-targets', 8), direct('singer-songs', 6)]);
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe('shift-targets');
    expect(groups[0].connections).toHaveLength(1);
    expect(groups[1].key).toBe('singer-songs');
  });

  it('merges playstyle connections by playstyleId', () => {
    const conns = [
      playstyle('location-at-payoff', 'location-control', 7),
      playstyle('location-move', 'location-control', 5),
    ];
    const groups = groupConnections(conns);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('location-control');
    expect(groups[0].connections).toHaveLength(2);
  });

  it('uses max score for merged playstyle groups', () => {
    const conns = [
      playstyle('location-at-payoff', 'location-control', 5),
      playstyle('location-move', 'location-control', 9),
    ];
    const groups = groupConnections(conns);
    expect(groups[0].score).toBe(9);
  });

  it('sorts groups by score descending', () => {
    const conns = [direct('low', 3), direct('high', 9), direct('mid', 6)];
    const groups = groupConnections(conns);
    expect(groups.map((g) => g.score)).toEqual([9, 6, 3]);
  });

  it('handles mix of direct and playstyle connections', () => {
    const conns = [
      direct('shift-targets', 8),
      playstyle('location-at-payoff', 'location-control', 7),
      playstyle('location-move', 'location-control', 5),
    ];
    const groups = groupConnections(conns);
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe('shift-targets');
    expect(groups[1].key).toBe('location-control');
  });

  it('returns empty array for empty input', () => {
    expect(groupConnections([])).toEqual([]);
  });
});
