import {describe, it, expect} from 'vitest';
import {siblingStep} from '../siblingStep';

describe('siblingStep', () => {
  it('steps to the next or the previous card, wrapping at both ends', () => {
    expect(siblingStep(['a', 'b', 'c'], 1, 1)).toBe(2);
    expect(siblingStep(['a', 'b', 'c'], 2, 1)).toBe(0);
    expect(siblingStep(['a', 'b', 'c'], 0, -1)).toBe(2);
  });

  it('steps nowhere from a list of one card, or from a card not in the list', () => {
    expect(siblingStep(['a'], 0, 1)).toBe(-1);
    expect(siblingStep(['a', 'b'], -1, 1)).toBe(-1);
  });
});
