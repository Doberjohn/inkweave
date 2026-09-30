import {describe, it, expect, vi} from 'vitest';
import {renderHook} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useRevealProgress} from '../useRevealProgress';
import {REVEAL_SET_CODE, SET_TOTAL} from '../../../shared/constants';

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
    setCode: REVEAL_SET_CODE,
    setNumber: 1,
    ...overrides,
  };
}

const mockCards: LorcanaCard[] = [
  make('a1', {ink: 'Amber', rarity: 'Common'}),
  make('a2', {ink: 'Amber', rarity: 'Super Rare'}),
  // An Epic in Emerald's lineup (#211-213), and a stray numbered outside it.
  make('e1', {
    ink: 'Emerald',
    rarity: 'Rare',
    variants: [
      {id: '14213', rarity: 'Epic', number: 213},
      {id: '14299', rarity: 'Enchanted', number: 299},
    ],
  }),
  make('d1', {ink: 'Amber', ink2: 'Emerald', rarity: 'Legendary'}), // dual-ink
  make('s1', {ink: 'Steel', rarity: undefined}), // revealed but no rarity yet
  make('x1', {ink: 'Ruby', setCode: '11'}), // not the reveal set → excluded
];

describe('useRevealProgress', () => {
  it('sums per-ink counts to the unique total revealed (reveal set only)', () => {
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

  it('fills a revealed printing into its ink lineup slot and tallies its rarity', () => {
    const {result} = renderHook(() => useRevealProgress());
    const {specials, rarityCounts, count} = result.current.byInk.Emerald;
    expect(specials.find((slot) => slot.number === 213)?.printing?.id).toBe('14213');
    expect(rarityCounts.epic).toBe(1);
    expect(count).toBe(1); // printings never count toward the board's N / 34
  });

  it('appends a printing numbered outside its ink lineup instead of dropping it', () => {
    const {result} = renderHook(() => useRevealProgress());
    const {specials} = result.current.byInk.Emerald;
    expect(specials).toHaveLength(7); // Emerald's 3 Epic + 3 Enchanted slots, plus the stray
    expect(specials.at(-1)?.number).toBe(299);
  });

  it('derives overallPct from the unique total against the whole set', () => {
    const {result} = renderHook(() => useRevealProgress());
    expect(result.current.overallPct).toBe(Math.round((5 / SET_TOTAL) * 100));
  });
});
