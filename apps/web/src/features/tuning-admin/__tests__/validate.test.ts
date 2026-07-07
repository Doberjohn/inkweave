import {describe, it, expect} from 'vitest';
import {validateScore, validateText} from '../validate';

describe('tuning edit validation', () => {
  it('accepts integer scores 1-10', () => {
    expect(validateScore('6')).toEqual({ok: true, value: 6});
    expect(validateScore('1').ok).toBe(true);
    expect(validateScore('10').ok).toBe(true);
  });
  it('rejects out-of-range / non-integer / empty scores', () => {
    expect(validateScore('11').ok).toBe(false);
    expect(validateScore('0').ok).toBe(false);
    expect(validateScore('4.5').ok).toBe(false);
    expect(validateScore('').ok).toBe(false);
    expect(validateScore('abc').ok).toBe(false);
  });
  it('accepts non-empty text and rejects blank', () => {
    expect(validateText('Wide gap').ok).toBe(true);
    expect(validateText('   ').ok).toBe(false);
    expect(validateText('').ok).toBe(false);
  });
});
