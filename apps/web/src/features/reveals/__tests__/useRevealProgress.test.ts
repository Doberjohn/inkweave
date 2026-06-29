import {describe, it, expect, vi} from 'vitest';
import {renderHook} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useRevealProgress} from '../useRevealProgress';

vi.mock('../../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({cards: mockCards, isLoading: false, error: null}),
}));

function make(id: string, overrides: Partial<LorcanaCard> = {}): LorcanaCard {
  return {
    id,
    name: id,
    version: '',
    fullName: id,
    cost: 1,
    ink: 'Amber',
    inkwell: true,
    type: 'Character',
    classifications: [],
    keywords: [],
    text: '',
    strength: 1,
    willpower: 1,
    lore: 1,
    imageUrl: '',
    setCode: '13',
    setNumber: 1,
    ...overrides,
  };
}

const mockCards: LorcanaCard[] = [
  make('a1', {ink: 'Amber', rarity: 'Common'}),
  make('a2', {ink: 'Amber', rarity: 'Super Rare'}),
  make('e1', {ink: 'Emerald', rarity: 'Rare'}),
  make('d1', {ink: 'Amber', ink2: 'Emerald', rarity: 'Legendary'}), // dual-ink
  make('s1', {ink: 'Steel', rarity: undefined}), // revealed but no rarity yet
  make('x1', {ink: 'Ruby', setCode: '11'}), // not Set 13 → excluded
];

describe('useRevealProgress', () => {
  it('sums per-ink counts to the unique total revealed (Set 13 only)', () => {
    const {result} = renderHook(() => useRevealProgress());
    const {inks, totalRevealed} = result.current;
    expect(totalRevealed).toBe(5); // a1, a2, e1, d1, s1 — x1 excluded
    expect(inks.reduce((s, p) => s + p.count, 0)).toBe(totalRevealed);
    expect(result.current.byInk.Ruby.count).toBe(0); // x1 is set 11
  });

  it('buckets a dual-ink card to its primary ink only', () => {
    const {result} = renderHook(() => useRevealProgress());
    // d1 is Amber-Emerald → counts toward Amber (a1, a2, d1 = 3), not Emerald (e1 = 1).
    expect(result.current.byInk.Amber.count).toBe(3);
    expect(result.current.byInk.Emerald.count).toBe(1);
  });

  it('tallies rarity from the real card.rarity, skipping cards without one', () => {
    const {result} = renderHook(() => useRevealProgress());
    expect(result.current.byInk.Amber.rarityCounts).toEqual({
      common: 1,
      'super rare': 1,
      legendary: 1,
    });
    expect(result.current.byInk.Steel.rarityCounts).toEqual({}); // s1 has no rarity
  });

  it('derives overallPct from the unique total against the 207-card set', () => {
    const {result} = renderHook(() => useRevealProgress());
    expect(result.current.overallPct).toBe(Math.round((5 / 207) * 100)); // 2
  });
});
