import {describe, it, expect} from 'vitest';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {INK_BASE} from '../../../shared/constants';
import {createCard} from '../../../shared/test-utils';
import {mosaicOrder, specialsOrder} from '../boardOrder';
import type {SpecialSlot} from '../useRevealProgress';

const base = INK_BASE.Amber;
const card = (id: string, setNumber?: number): LorcanaCard => createCard({id, ink: 'Amber', setNumber});

describe('mosaicOrder', () => {
  it('lists the cards slot by slot, as the board shows them, with a numberless card spilled to the end', () => {
    const cards = [card('third', base + 9), card('numberless'), card('first', base), card('second', base + 2)];
    expect(mosaicOrder('Amber', cards).map((c) => c.id)).toEqual(['first', 'second', 'third', 'numberless']);
  });
});

describe('specialsOrder', () => {
  it('lists the revealed printings in lineup order, each card opening on its printing', () => {
    const slots: SpecialSlot[] = [
      {number: 205, rarity: 'Enchanted', card: card('aurora'), printing: {id: 'aurora-ench', rarity: 'Enchanted', number: 205}},
      {number: 206, rarity: 'Enchanted'}, // not revealed yet
      {number: 241, rarity: 'Iconic', card: card('mickey'), printing: {id: 'mickey-iconic', rarity: 'Iconic', number: 241}},
    ];
    const order = specialsOrder(slots);
    expect(order.ids).toEqual(['aurora', 'mickey']);
    expect(order.printingFor('mickey')).toBe('mickey-iconic');
  });
});
