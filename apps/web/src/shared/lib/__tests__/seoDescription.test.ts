import {describe, it, expect} from 'vitest';
import {fitDescription} from '../seoDescription';

describe('fitDescription', () => {
  it('keeps the first wording that fits in 160 characters', () => {
    expect(fitDescription('a'.repeat(160), 'short')).toBe('a'.repeat(160));
    expect(fitDescription('a'.repeat(161), 'b'.repeat(150), 'short')).toBe('b'.repeat(150));
  });

  it('falls back to the last wording when none fits', () => {
    expect(fitDescription('a'.repeat(200), 'b'.repeat(170))).toBe('b'.repeat(170));
  });
});
