import {describe, expect, it} from 'vitest';
import {clampBinderName, isValidBinderName, trimBinderName} from './binderName';

describe('binderName', () => {
  it('counts letters as the table does: 30 with an emoji fit, and a 31st is cut off', () => {
    const thirty = `${'a'.repeat(29)}🦁`;
    expect(clampBinderName(thirty)).toBe(thirty);
    expect(isValidBinderName(thirty)).toBe(true);
    expect(clampBinderName(`${thirty}b`)).toBe(thirty);
    expect(isValidBinderName(`${thirty}b`)).toBe(false);
  });

  it('refuses a name that is blank, or holds a control character or a line break', () => {
    for (const name of ['', '  ', '\u00a0', '\u200b', 'Am\u0007ber', 'Am\nber', 'Am\u2028ber']) {
      expect(isValidBinderName(name), JSON.stringify(name)).toBe(false);
    }
  });

  it('trims spaces and zero-width characters off either end, and keeps those inside', () => {
    expect(trimBinderName(' \u200bAmber\u00a0\u200dSteel\u2060 ')).toBe('Amber\u00a0\u200dSteel');
    expect(isValidBinderName(' \u200bAmber\u2060 ')).toBe(true);
  });
});
