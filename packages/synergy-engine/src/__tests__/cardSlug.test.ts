import {describe, it, expect} from 'vitest';
import {cardSlug, cardPath} from '../utils';

describe('cardSlug', () => {
  it('slugifies "name - version" without triple hyphens on the separator', () => {
    expect(cardSlug({fullName: 'Bruno Madrigal - Undetected Uncle'})).toBe(
      'bruno-madrigal-undetected-uncle',
    );
  });

  it('drops apostrophes rather than turning them into hyphens', () => {
    expect(cardSlug({fullName: "Bruno's Return"})).toBe('brunos-return');
  });

  it('collapses commas, ampersands and other punctuation runs to single hyphens', () => {
    expect(cardSlug({fullName: 'Hamish, Hubert & Harris - Making Mischief'})).toBe(
      'hamish-hubert-harris-making-mischief',
    );
  });

  it('trims trailing punctuation so there is no edge hyphen', () => {
    expect(cardSlug({fullName: 'Look at This Family!'})).toBe('look-at-this-family');
  });

  it('cardPath prepends /card/{id}/ to the slug', () => {
    expect(cardPath({id: 1936, fullName: 'Bruno Madrigal - Undetected Uncle'})).toBe(
      '/card/1936/bruno-madrigal-undetected-uncle',
    );
  });
});
