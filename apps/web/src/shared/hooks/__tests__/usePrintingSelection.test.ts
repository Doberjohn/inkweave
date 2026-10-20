import {describe, it, expect, vi, beforeEach} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {createCard} from '../../test-utils';
import {trackEvent} from '../../lib/analytics';
import {
  printedCardNumber,
  printingAlt,
  printingName,
  printingSpokenName,
  printingsOf,
  usePrintingSelection,
} from '../usePrintingSelection';

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
/** A printing that keeps its base card's rarity, so it has no rarity symbol of its own (#796). */
const violet: LorcanaCard = createCard({
  id: '3147',
  fullName: 'Violet Parr - Super Resilient',
  rarity: 'Super Rare',
  variants: [{id: '3573', rarity: 'Super Rare', number: 247}],
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

// card_printing_view counts settled views: a pill pick, or the strip at rest on a printing.
describe('usePrintingSelection views', () => {
  it('records a picked printing once', () => {
    const {result} = renderSelection(pongo);

    act(() => result.current.pick(1));

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

  it('records the printing the strip comes to rest on', () => {
    const {result} = renderSelection(pongo);

    act(() => result.current.settle(1));

    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('never records the Standard printing', () => {
    const {result} = renderSelection(pongo);

    act(() => result.current.settle(0));
    act(() => result.current.pick(1));
    act(() => result.current.pick(0));

    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('does not record a pick of the printing already shown', () => {
    const {result} = renderSelection(pongo);

    act(() => result.current.pick(1));
    act(() => result.current.pick(1));

    expect(trackEvent).toHaveBeenCalledTimes(1);
  });
});

describe('printingAlt', () => {
  it('names a variant printing after the card, and leaves the Standard one as the card name', () => {
    const {result} = renderSelection(pongo);
    const [standard, enchanted] = result.current.printings;

    expect(printingAlt(pongo, standard)).toBe('Pongo - Determined Father');
    expect(printingAlt(pongo, enchanted)).toBe('Pongo - Determined Father, Enchanted printing');
  });

  it("names a printing that keeps its base card's rarity an alt foil (#802)", () => {
    const [, sameRarity] = printingsOf(violet);

    expect(printingAlt(violet, sameRarity)).toBe('Violet Parr - Super Resilient, Alt foil printing');
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

describe('printingName', () => {
  it('names a promo by the code printed on it, adding the finish only to twins (#802)', () => {
    expect(printingName({rarity: 'Special', number: 25, promoGrouping: 'P1'})).toBe('25/P1');
    expect(printingName({rarity: 'Special', number: 8, promoGrouping: 'C1', finish: 'foil'})).toBe('8/C1 foil');
    expect(printingName({rarity: 'Special', number: 8, promoGrouping: 'C1', finish: 'normal'})).toBe(
      '8/C1 non-foil',
    );
    // A promo whose number nobody knows yet goes by its set alone.
    expect(printingName({rarity: 'Special', promoGrouping: 'C2', finish: 'normal'})).toBe('C2 non-foil');
  });

  it("names a promo by what is known of its code when no set came with it (#802)", () => {
    expect(printingName({rarity: 'Special', number: 1})).toBe('#1');
    expect(printingName({rarity: 'Special'})).toBe('Promo');
  });
});

describe('printingSpokenName', () => {
  it("tells assistive tech an alt foil's number and that a promo is one (#802)", () => {
    expect(printingSpokenName({label: 'Alt foil', rarity: 'Legendary', number: 243})).toBe('Alt foil, #243');
    expect(printingSpokenName({label: '25/P1', rarity: 'Special', number: 25, promoGrouping: 'P1'})).toBe(
      'Promo 25/P1',
    );
    expect(
      printingSpokenName({label: '8/C1 non-foil', rarity: 'Special', number: 8, promoGrouping: 'C1', finish: 'normal'}),
    ).toBe('Promo 8/C1, non-foil');
    expect(printingSpokenName({label: 'Enchanted', rarity: 'Enchanted', number: 234})).toBe('Enchanted');
  });
});

describe('printingsOf', () => {
  it("gives Standard the card's scan language and each variant its own", () => {
    const italianEpic = createCard({
      id: '14085',
      variants: [{id: '14213', rarity: 'Epic', number: 213, scanLanguage: 'it'}],
    });
    const japaneseBase = createCard({
      id: '14014',
      scanLanguage: 'ja',
      variants: [{id: '14241', rarity: 'Iconic', number: 241}],
    });

    expect(printingsOf(italianEpic).map((p) => p.scanLanguage)).toEqual([undefined, 'it']);
    expect(printingsOf(japaneseBase).map((p) => p.scanLanguage)).toEqual(['ja', undefined]);
  });

  it("labels a printing that keeps its base card's rarity \"Alt foil\" (#802)", () => {
    expect(printingsOf(violet).map((p) => p.label)).toEqual(['Standard', 'Alt foil']);
  });

  it('orders Standard, then the chase and alt foil printings by number, then promos by set and number (#802)', () => {
    const card = createCard({
      id: '2887',
      variants: [
        {id: 'p3', rarity: 'Special', number: 10, promoGrouping: 'P3'},
        {id: 'enchanted', rarity: 'Enchanted', number: 234},
        {id: 'p1', rarity: 'Special', number: 25, promoGrouping: 'P1'},
        {id: 'alt', rarity: 'Super Rare', number: 243},
      ],
    });

    expect(printingsOf(card).map((p) => p.label)).toEqual(['Standard', 'Enchanted', 'Alt foil', '25/P1', '10/P3']);
  });

  it("puts a promo whose number is unknown after its set's numbered ones (#805)", () => {
    const minnie = createCard({
      id: '2224',
      variants: [
        {id: '80016', rarity: 'Special', promoGrouping: 'C2', finish: 'normal'},
        {id: '80015', rarity: 'Special', number: 20, promoGrouping: 'C2', finish: 'foil'},
      ],
    });

    expect(printingsOf(minnie).map((p) => p.label)).toEqual([
      'Standard',
      '20/C2 foil',
      'C2 non-foil',
    ]);
  });
});
