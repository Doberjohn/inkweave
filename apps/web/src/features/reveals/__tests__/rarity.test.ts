import {describe, it, expect} from 'vitest';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {isSlotDimmed} from '../rarity';

const card = (rarity: string) => ({rarity}) as LorcanaCard;

describe('isSlotDimmed', () => {
  it('never dims when no rarity is selected', () => {
    expect(isSlotDimmed(card('rare'), null)).toBe(false);
  });
  it('never dims an empty slot', () => {
    expect(isSlotDimmed(undefined, 'rare')).toBe(false);
  });
  it('does not dim a matching rarity', () => {
    expect(isSlotDimmed(card('rare'), 'rare')).toBe(false);
  });
  it('dims a non-matching revealed card', () => {
    expect(isSlotDimmed(card('legendary'), 'rare')).toBe(true);
  });
  it('matches case-insensitively via rarityConfigOf', () => {
    expect(isSlotDimmed(card('Super Rare'), 'super rare')).toBe(false);
  });
});
