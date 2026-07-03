import {describe, expect, it} from 'vitest';
import {biasCopy} from '../biasCopy';

describe('biasCopy', () => {
  it('reads a meaningfully negative gap as the engine over-rating', () => {
    const r = biasCopy(-0.28);
    expect(r.direction).toBe('over');
    expect(r.read).toMatch(/higher/i);
    expect(r.read).toMatch(/0\.28/);
  });

  it('reads a meaningfully positive gap as the engine under-rating', () => {
    expect(biasCopy(0.6).direction).toBe('under');
    expect(biasCopy(0.6).read).toMatch(/lower/i);
  });

  it('reads a small gap as neutral/well-calibrated', () => {
    expect(biasCopy(-0.1).direction).toBe('neutral');
  });

  it('handles a null gap (no scored votes)', () => {
    expect(biasCopy(null).direction).toBe('neutral');
  });
});
