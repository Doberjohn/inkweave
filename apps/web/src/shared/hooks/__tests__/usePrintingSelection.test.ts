import {describe, it, expect} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {createCard} from '../../test-utils';
import {printingAlt, usePrintingSelection} from '../usePrintingSelection';

const pongo: LorcanaCard = createCard({
  id: '1938',
  fullName: 'Pongo - Determined Father',
  imageUrl: '/card-images/1938.avif',
  variants: [{id: '2141', rarity: 'Enchanted', number: 223, imageUrl: '/card-images/2141.avif'}],
});
const gosalyn: LorcanaCard = createCard({
  id: '2716',
  fullName: 'Gosalyn Mallard - The Quiverwing Quack',
});

function renderSelection(card: LorcanaCard, resetWhen = false) {
  return renderHook(({card, resetWhen}) => usePrintingSelection(card, {resetWhen}), {
    initialProps: {card, resetWhen},
  });
}

describe('usePrintingSelection', () => {
  it('lists the Standard printing first, then each variant labelled by its rarity', () => {
    const {result} = renderSelection(pongo);

    expect(result.current.printings.map((p) => [p.label, p.imageUrl])).toEqual([
      ['Standard', '/card-images/1938.avif'],
      ['Enchanted', '/card-images/2141.avif'],
    ]);
  });

  it('offers only the Standard printing for a card without variants', () => {
    const {result} = renderSelection(gosalyn);
    expect(result.current.printings).toHaveLength(1);
  });

  it('shows the printing the user selects', () => {
    const {result} = renderSelection(pongo);

    act(() => result.current.select(1));

    expect(result.current.index).toBe(1);
    expect(result.current.current.label).toBe('Enchanted');
  });

  it('starts every other card on its Standard printing', () => {
    const {result, rerender} = renderSelection(pongo);
    act(() => result.current.select(1));

    rerender({card: {...pongo, id: '9999'}, resetWhen: false});

    expect(result.current.index).toBe(0);
  });

  it('starts on the printing initialKey names, or on Standard when it names none', () => {
    const opened = renderHook(() => usePrintingSelection(pongo, {initialKey: '2141'}));
    expect(opened.result.current.current.label).toBe('Enchanted');

    const unknown = renderHook(() => usePrintingSelection(pongo, {initialKey: 'no-such-printing'}));
    expect(unknown.result.current.index).toBe(0);
  });

  it('reads initialKey once: resetWhen drops that printing for good', () => {
    const {result, rerender} = renderHook(
      ({resetWhen}) => usePrintingSelection(pongo, {resetWhen, initialKey: '2141'}),
      {initialProps: {resetWhen: false}},
    );
    expect(result.current.index).toBe(1);

    rerender({resetWhen: true});
    rerender({resetWhen: false});
    expect(result.current.index).toBe(0);
  });

  it('returns to Standard while resetWhen holds, and stays there once it clears', () => {
    const {result, rerender} = renderSelection(pongo);
    act(() => result.current.select(1));

    rerender({card: pongo, resetWhen: true});
    expect(result.current.index).toBe(0);

    rerender({card: pongo, resetWhen: false});
    expect(result.current.index).toBe(0);
  });
});

describe('printingAlt', () => {
  it('names a variant printing after the card, and leaves the Standard one as the card name', () => {
    const {result} = renderSelection(pongo);
    const [standard, enchanted] = result.current.printings;

    expect(printingAlt(pongo, standard)).toBe('Pongo - Determined Father');
    expect(printingAlt(pongo, enchanted)).toBe('Pongo - Determined Father, Enchanted printing');
  });
});
