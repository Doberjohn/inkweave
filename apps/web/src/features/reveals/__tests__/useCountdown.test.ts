import {describe, it, expect} from 'vitest';
import {daysUntil} from '../useCountdown';

describe('daysUntil', () => {
  it('returns 0 when now is past the target', () => {
    const target = new Date(2026, 4, 8, 0, 0, 0);
    const now = new Date(2026, 4, 10, 10, 0, 0);
    expect(daysUntil(now, target)).toBe(0);
  });

  it('returns 0 when now is on the target calendar day (any time)', () => {
    const target = new Date(2026, 4, 8, 0, 0, 0);
    expect(daysUntil(new Date(2026, 4, 8, 0, 0, 0), target)).toBe(0);
    expect(daysUntil(new Date(2026, 4, 8, 23, 59, 59), target)).toBe(0);
  });

  it('returns 1 for the day before the target, regardless of time', () => {
    const target = new Date(2026, 4, 8, 0, 0, 0);
    expect(daysUntil(new Date(2026, 4, 7, 0, 0, 1), target)).toBe(1);
    expect(daysUntil(new Date(2026, 4, 7, 23, 59, 59), target)).toBe(1);
  });

  it('counts whole calendar days to the target', () => {
    const target = new Date(2026, 4, 15, 0, 0, 0);
    expect(daysUntil(new Date(2026, 4, 8, 12), target)).toBe(7);
    expect(daysUntil(new Date(2026, 4, 1, 12), target)).toBe(14);
  });
});
