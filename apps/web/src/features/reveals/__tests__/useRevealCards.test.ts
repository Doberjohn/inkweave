import {describe, it, expect, vi} from 'vitest';
import {renderHook} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useRevealCards} from '../useRevealCards';

vi.mock('../../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({
    cards: mockCards,
    isLoading: false,
    error: null,
    totalCards: mockCards.length,
    uniqueKeywords: [],
    uniqueClassifications: [],
    uniqueSets: [],
    sets: [],
    retryLoad: () => {},
    getCardById: () => undefined,
  }),
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
  make('t1', {franchise: 'Monsters, Inc.', setNumber: 5}),
  make('i1', {franchise: 'Up', setNumber: 6}),
  make('b1', {franchise: 'Turning Red', setNumber: 7}),
  make('r1', {franchise: 'Peter Pan', setNumber: 2}),
  make('r2', {franchise: 'Aladdin', setNumber: 4}),
  make('r3', {setNumber: 3}), // no franchise → Returning
  make('x1', {setCode: '11', franchise: 'Monsters, Inc.'}), // wrong set, excluded
];

describe('useRevealCards', () => {
  it('partitions Set 13 cards into the locked 4-tier order', () => {
    const {result} = renderHook(() => useRevealCards());
    const ids = result.current.tiers.map((t) => t.id);
    expect(ids).toEqual(['monsters-inc', 'up', 'turning-red', 'returning']);
  });

  it('places each franchise card in its tier and excludes non-Set-13 cards', () => {
    const {result} = renderHook(() => useRevealCards());
    const byId = Object.fromEntries(result.current.tiers.map((t) => [t.id, t.cards]));
    expect(byId['monsters-inc'].map((c) => c.id)).toEqual(['t1']);
    expect(byId['up'].map((c) => c.id)).toEqual(['i1']);
    expect(byId['turning-red'].map((c) => c.id)).toEqual(['b1']);
  });

  it('puts cards without new-IP franchise into Returning, sorted by setNumber ascending', () => {
    const {result} = renderHook(() => useRevealCards());
    const returning = result.current.tiers.find((t) => t.id === 'returning')!;
    expect(returning.cards.map((c) => c.id)).toEqual(['r1', 'r3', 'r2']);
  });
});
