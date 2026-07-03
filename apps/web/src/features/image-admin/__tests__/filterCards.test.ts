import {describe, it, expect} from 'vitest';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {filterCards} from '../filterCards';

function card(p: Partial<LorcanaCard>): LorcanaCard {
  return {id: '1', name: 'X', fullName: 'X', cost: 1, ink: 'Amber', inkwell: true, type: 'Character', ...p};
}

describe('filterCards', () => {
  it('matches by name substring, case-insensitive', () => {
    const cards = [
      card({id: '1', name: 'Elsa', fullName: 'Elsa - Snow Queen'}),
      card({id: '2', name: 'Anna', fullName: 'Anna - Heir to Arendelle'}),
    ];
    expect(filterCards(cards, 'els').map((c) => c.id)).toEqual(['1']);
  });

  it('matches by id', () => {
    const cards = [card({id: '5001'}), card({id: '5002'})];
    expect(filterCards(cards, '5002').map((c) => c.id)).toEqual(['5002']);
  });

  it('returns the first `limit` cards when the query is blank', () => {
    const cards = [card({id: '1'}), card({id: '2'})];
    expect(filterCards(cards, '  ', 40)).toHaveLength(2);
  });

  it('caps results at `limit`', () => {
    const many = Array.from({length: 100}, (_, i) => card({id: String(i), name: 'Zz', fullName: 'Zz Zz'}));
    expect(filterCards(many, 'zz', 40)).toHaveLength(40);
  });
});
