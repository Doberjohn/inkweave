import {describe, expect, it} from 'vitest';
import {RARITIES, SPECIAL_RARITIES, hasRaritySymbol, rarityConfigOf} from '../rarity';

describe('rarityConfigOf', () => {
  it("finds a main-set rarity from a card's raw rarity, trimmed and in any case", () => {
    expect(rarityConfigOf(' Super Rare ')).toEqual({key: 'super rare', name: 'Super rare'});
  });

  it('finds nothing for a special printing or a missing rarity', () => {
    expect(rarityConfigOf('Enchanted')).toBeUndefined();
    expect(rarityConfigOf(undefined)).toBeUndefined();
  });
});

describe('hasRaritySymbol', () => {
  it("takes each main-set rarity, special printing and promos' Special, but not Foil", () => {
    const names = [...RARITIES.map((r) => r.name), ...Object.keys(SPECIAL_RARITIES), 'Special'];
    for (const name of names) expect(hasRaritySymbol(name), name).toBe(true);
    expect(hasRaritySymbol('Foil')).toBe(false);
  });
});
