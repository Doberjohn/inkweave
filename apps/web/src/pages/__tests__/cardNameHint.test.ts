import {describe, expect, it} from 'vitest';
import {cardNameHint} from '../cardNameHint';

describe('cardNameHint', () => {
  it('capitalizes the words and puts the separator after the first', () => {
    expect(cardNameHint('bruno-madrigal-undetected-uncle')).toBe('Bruno - Madrigal Undetected Uncle');
  });

  it('keeps small words in lower case after the first word', () => {
    expect(cardNameHint('mickey-mouse-leader-of-the-band')).toBe('Mickey - Mouse Leader of the Band');
    expect(cardNameHint('the-queen-commanding-presence')).toBe('The - Queen Commanding Presence');
  });

  it('spells a one-word slug alone', () => {
    expect(cardNameHint('dragon')).toBe('Dragon');
  });

  it('gives no hint without a slug', () => {
    expect(cardNameHint(undefined)).toBe('');
    expect(cardNameHint('')).toBe('');
  });

  it('ignores stray hyphens', () => {
    expect(cardNameHint('-stitch--rock-star-')).toBe('Stitch - Rock Star');
  });
});
