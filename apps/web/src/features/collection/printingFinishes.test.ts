import {describe, expect, it} from 'vitest';
import {finishesOf} from './printingFinishes';

describe('finishesOf', () => {
  it("names the one finish a printing's data names, whatever its rarity says (#880)", () => {
    // Yen Sid #223, an alt foil, and 1/C3, a promo printed in normal alone.
    expect(finishesOf({rarity: 'Legendary', finishes: ['foil']})).toEqual(['foil']);
    expect(finishesOf({rarity: 'Special', finishes: ['normal']})).toEqual(['normal']);
  });

  it.each(['Enchanted', 'Epic', 'Iconic'])(
    'gives an %s without the field foil alone, as its rarity says',
    (rarity) => {
      expect(finishesOf({rarity})).toEqual(['foil']);
    },
  );

  it('gives every other printing without the field both finishes, normal first, a promo included', () => {
    expect(finishesOf({rarity: 'Common'})).toEqual(['normal', 'foil']);
    expect(finishesOf({rarity: 'Special'})).toEqual(['normal', 'foil']);
    expect(finishesOf({})).toEqual(['normal', 'foil']);
  });
});
