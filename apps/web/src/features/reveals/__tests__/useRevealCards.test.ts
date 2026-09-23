import {describe, it, expect, vi} from 'vitest';
import {renderHook} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useRevealCards} from '../useRevealCards';
import {FRANCHISES} from '../franchise';
import {REVEAL_SET_CODE} from '../../../shared/constants';

// Read from the season's config so these fixtures never need a per-season edit.
const DEBUT = FRANCHISES[0];

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
    setCode: REVEAL_SET_CODE,
    setNumber: 1,
    ...overrides,
  };
}

const mockCards: LorcanaCard[] = [
  make('f1', {franchise: DEBUT.match, setNumber: 5}),
  make('r1', {franchise: 'Peter Pan', setNumber: 2}),
  make('r2', {franchise: 'Aladdin', setNumber: 4}),
  make('r3', {setNumber: 3}), // no franchise → Returning
  make('x1', {setCode: '11', franchise: DEBUT.match}), // wrong set, excluded
];

describe('useRevealCards', () => {
  it('orders the tiers as the debut franchises, then Returning', () => {
    const {result} = renderHook(() => useRevealCards());
    const ids = result.current.tiers.map((t) => t.id);
    expect(ids).toEqual([...FRANCHISES.map((f) => f.id), 'returning']);
  });

  it('places a franchise card in its tier and excludes cards from other sets', () => {
    const {result} = renderHook(() => useRevealCards());
    const byId = Object.fromEntries(result.current.tiers.map((t) => [t.id, t.cards]));
    expect(byId[DEBUT.id].map((c) => c.id)).toEqual(['f1']);
  });

  it('puts cards without new-IP franchise into Returning, sorted by setNumber ascending', () => {
    const {result} = renderHook(() => useRevealCards());
    const returning = result.current.tiers.find((t) => t.id === 'returning')!;
    expect(returning.cards.map((c) => c.id)).toEqual(['r1', 'r3', 'r2']);
  });
});
