import {describe, it, expect, vi, beforeEach} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {createCard} from '../../test-utils';
import {trackEvent} from '../../lib/analytics';
import {printingSpokenName, printingsOf} from 'inkweave-ui/lib/printings';
import {printedCardNumber, usePrintingSelection} from '../usePrintingSelection';

vi.mock('../../lib/analytics', () => ({trackEvent: vi.fn()}));

beforeEach(() => {
  vi.mocked(trackEvent).mockClear();
});

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
  return renderHook(
    ({card, resetWhen}) => usePrintingSelection(card, {resetWhen, surface: 'card_page'}),
    {initialProps: {card, resetWhen}},
  );
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
    const opened = renderHook(() => usePrintingSelection(pongo, {surface: 'modal', initialKey: '2141'}));
    expect(opened.result.current.current.label).toBe('Enchanted');

    const unknown = renderHook(() =>
      usePrintingSelection(pongo, {surface: 'modal', initialKey: 'no-such-printing'}),
    );
    expect(unknown.result.current.index).toBe(0);
  });

  it('starts each card it arrives on at the printing initialKey names for it', () => {
    // Browse's modal arrows: every card opens on the art its grid tile showed.
    const perdita = createCard({id: '1939', variants: [{id: '2142', rarity: 'Epic', number: 210}]});
    const {result, rerender} = renderHook(
      ({card, initialKey}) => usePrintingSelection(card, {surface: 'modal', initialKey}),
      {initialProps: {card: pongo, initialKey: '2141'}},
    );
    expect(result.current.current.label).toBe('Enchanted');

    rerender({card: perdita, initialKey: '2142'});
    expect(result.current.current.label).toBe('Epic');

    rerender({card: pongo, initialKey: '2141'});
    expect(result.current.current.label).toBe('Enchanted');
  });

  it('starts the same card again when it is reached with another printing to start on', () => {
    // A binder under Name A-Z: pongo's own pocket, then its Enchanted's, side by side.
    const {result, rerender} = renderHook(
      ({initialKey}: {initialKey: string | null}) => usePrintingSelection(pongo, {surface: 'modal', initialKey}),
      {initialProps: {initialKey: null as string | null}},
    );
    expect(result.current.index).toBe(0);

    rerender({initialKey: '2141'});
    expect(result.current.current.label).toBe('Enchanted');

    rerender({initialKey: null});
    expect(result.current.index).toBe(0);
  });

  it('lets a card that started on a printing switch back to Standard', () => {
    const {result} = renderHook(() => usePrintingSelection(pongo, {surface: 'modal', initialKey: '2141'}));

    act(() => result.current.select(0));

    expect(result.current.index).toBe(0);
  });

  it('reads initialKey once: resetWhen drops that printing for good', () => {
    const {result, rerender} = renderHook(
      ({resetWhen}) => usePrintingSelection(pongo, {resetWhen, surface: 'modal', initialKey: '2141'}),
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

// card_printing_view counts settled views: the strip at rest on a printing, or turned to it by a
// peek or a key.
describe('usePrintingSelection views', () => {
  it('records the printing the strip comes to rest on, once', () => {
    const {result} = renderSelection(pongo);

    act(() => result.current.select(1));
    act(() => result.current.settle(1));

    expect(result.current.index).toBe(1);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('card_printing_view', {
      cardId: '1938',
      printingId: '2141',
      rarity: 'Enchanted',
      surface: 'card_page',
    });
  });

  it('records nothing for a printing the strip only passes through', () => {
    const {result} = renderSelection(pongo);

    act(() => result.current.select(1));

    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('never records the Standard printing', () => {
    const {result} = renderSelection(pongo);

    act(() => result.current.settle(0));
    act(() => result.current.settle(1));
    act(() => result.current.settle(0));

    expect(trackEvent).toHaveBeenCalledTimes(1);
  });
});

describe('printedCardNumber', () => {
  it("reads the card's own number out of its set's printed size, which is 207 for Set 13", () => {
    expect(printedCardNumber(createCard({setCode: '12', setNumber: 52}))).toBe('52/204');
    expect(printedCardNumber(createCard({setCode: '13', setNumber: 12}))).toBe('12/207');
  });

  it("reads a chase printing's own number, and a promo's code, its own card's too", () => {
    const card = createCard({
      setCode: '9',
      setNumber: 6,
      variants: [
        {id: 'e', rarity: 'Enchanted', number: 223},
        {id: 'p', rarity: 'Special', number: 25, promoGrouping: 'P1'},
      ],
    });
    const [standard, enchanted, promo] = printingsOf(card);

    expect(printedCardNumber(card, standard)).toBe('6/204');
    expect(printedCardNumber(card, enchanted)).toBe('223/204');
    expect(printedCardNumber(card, promo)).toBe('25/P1');
    expect(printedCardNumber(createCard({rarity: 'Special', setCode: 'P2', setNumber: 15}))).toBe('15/P2');
  });

  it("reads nothing when the number or its set's size is unknown", () => {
    expect(printedCardNumber(createCard({setCode: '15', setNumber: 3}))).toBeUndefined();
    expect(printedCardNumber(createCard({setCode: '12', setNumber: undefined}))).toBeUndefined();
  });
});

describe('printingsOf', () => {
  it("carries a two-art promo's letter into its label, its spoken name and the header: 24A/P2 (#891)", () => {
    // Hiro Hamada - Armor Designer's two P2 promos share #24: Dreamborn's 24A/P2 and 24B/P2.
    const hiro = createCard({
      id: '1529',
      setCode: '7',
      setNumber: 96,
      variants: [{id: '1661', rarity: 'Special', number: 24, promoGrouping: 'P2', artVariant: 'A'}],
    });
    const [, promo] = printingsOf(hiro);

    expect(promo.label).toBe('24A/P2');
    expect(printingSpokenName(promo)).toBe('Promo 24A/P2');
    expect(printedCardNumber(hiro, promo)).toBe('24A/P2');
  });
});
