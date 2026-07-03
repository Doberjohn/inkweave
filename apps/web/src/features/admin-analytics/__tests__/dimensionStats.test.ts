import {describe, expect, it} from 'vitest';
import {dimensionStats} from '../dimensionStats';

describe('dimensionStats', () => {
  it('computes each dimension as a percentage of total votes, in order', () => {
    const rows = dimensionStats(
      {score: 1730, accuracy: 115, isReal: 24, wouldPlay: 24, difficulty: 24},
      1823,
    );
    expect(rows.map((r) => r.label)).toEqual(['Synergy score', 'Accuracy', 'Is real', 'Would play', 'Difficulty']);
    expect(rows[0].pct).toBe(94.9);
    expect(rows[1].pct).toBe(6.3);
  });

  it('returns [] when fill is null or there are no votes', () => {
    expect(dimensionStats(null, 1823)).toEqual([]);
    expect(dimensionStats({score: 1, accuracy: 0, isReal: 0, wouldPlay: 0, difficulty: 0}, 0)).toEqual([]);
  });
});
