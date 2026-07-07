import {describe, it, expect} from 'vitest';
import {MIN_CORE_SET, isCoreSet} from '../constants';

describe('isCoreSet (Core rotation floor)', () => {
  it('MIN_CORE_SET is a positive integer', () => {
    expect(Number.isInteger(MIN_CORE_SET)).toBe(true);
    expect(MIN_CORE_SET).toBeGreaterThan(0);
  });

  it('accepts sets at or above the floor (string or number)', () => {
    expect(isCoreSet(MIN_CORE_SET)).toBe(true);
    expect(isCoreSet(String(MIN_CORE_SET))).toBe(true);
    expect(isCoreSet('13')).toBe(true);
  });

  it('rejects sets below the floor, non-numeric codes, and undefined', () => {
    expect(isCoreSet(MIN_CORE_SET - 1)).toBe(false);
    expect(isCoreSet('5')).toBe(false);
    expect(isCoreSet('Q1')).toBe(false);
    expect(isCoreSet(undefined)).toBe(false);
  });
});
