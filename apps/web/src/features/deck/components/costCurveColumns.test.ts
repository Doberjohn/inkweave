import {describe, expect, it} from 'vitest';
import {barHeightPct, inkSegments, toColumns, totalCopies} from './costCurveColumns';

describe('barHeightPct', () => {
  it('scales the busiest bucket to full height and the rest proportionally', () => {
    expect(barHeightPct(8, 8)).toBe(100);
    expect(barHeightPct(4, 8)).toBe(50);
  });

  it('returns 0 for an empty deck (no bucket to scale against)', () => {
    expect(barHeightPct(0, 0)).toBe(0);
  });
});

describe('inkSegments', () => {
  it('splits ink counts into percentages that sum to 100, in fixed ALL_INKS order', () => {
    // Given out of order; Amber must come before Emerald and carry 3/4.
    const segs = inkSegments({Emerald: 1, Amber: 3});
    expect(segs.map((s) => s.ink)).toEqual(['Amber', 'Emerald']);
    expect(segs.map((s) => s.pct)).toEqual([75, 25]);
  });

  it('returns no segments for a missing or empty bucket', () => {
    expect(inkSegments(undefined)).toEqual([]);
    expect(inkSegments({})).toEqual([]);
  });

  it('carries each ink its raw count, not a rounded share', () => {
    // A lopsided bucket: the tooltip must say 1, never a percentage of anything.
    // pct is asserted alongside because it is the glow's dominant-ink input and
    // must stay exact; every other pct fixture in this file divides cleanly.
    const segs = inkSegments({Amber: 8, Emerald: 1});
    expect(segs.map((s) => s.count)).toEqual([8, 1]);
    expect(segs[0].pct).toBeCloseTo(88.889, 3);
  });
});

describe('toColumns', () => {
  it('projects onto a fixed 1..7 axis with a "7+" cap and zero-fills gaps', () => {
    const cols = toColumns({2: 4, 5: 3}, {2: {Amber: 4}, 5: {Emerald: 3}});
    expect(cols.map((c) => c.label)).toEqual(['1', '2', '3', '4', '5', '6', '7+']);
    expect(cols.map((c) => c.count)).toEqual([0, 4, 0, 0, 3, 0, 0]);
  });

  it('scales bar heights so the busiest bucket is 100%', () => {
    const cols = toColumns({2: 4, 3: 8}, {2: {Amber: 4}, 3: {Amber: 8}});
    const byBucket = new Map(cols.map((c) => [c.bucket, c.heightPct]));
    expect(byBucket.get(3)).toBe(100);
    expect(byBucket.get(2)).toBe(50);
    expect(byBucket.get(1)).toBe(0);
  });

  it('carries each bucket its ink segments', () => {
    const cols = toColumns({1: 10}, {1: {Amber: 5, Emerald: 5}});
    const one = cols.find((c) => c.bucket === 1)!;
    expect(one.segments).toEqual([
      {ink: 'Amber', pct: 50, count: 5},
      {ink: 'Emerald', pct: 50, count: 5},
    ]);
  });

  it('prepends a 0-cost column only when 0-cost cards are present', () => {
    expect(toColumns({0: 2, 1: 4}, {0: {Steel: 2}, 1: {Amber: 4}})[0]).toMatchObject({bucket: 0, label: '0', count: 2});
    expect(toColumns({1: 4}, {1: {Amber: 4}})[0].bucket).toBe(1);
  });
});

describe('totalCopies', () => {
  it('sums every bucket', () => {
    expect(totalCopies({1: 6, 2: 12, 7: 4})).toBe(22);
    expect(totalCopies({})).toBe(0);
  });
});
