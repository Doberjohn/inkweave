import {describe, it, expect} from 'vitest';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {createCard} from '../../test-utils/cards';
import {
  printedFullName,
  printingAlt,
  printingName,
  printingSpokenName,
  printingsOf,
} from '../printings';

const pongo: LorcanaCard = createCard({
  id: '1938',
  fullName: 'Pongo - Determined Father',
  imageUrl: '/card-images/1938.avif',
  variants: [{id: '2141', rarity: 'Enchanted', number: 223, imageUrl: '/card-images/2141.avif'}],
});
/** A printing that keeps its base card's rarity, so it has no rarity symbol of its own (#796). */
const violet: LorcanaCard = createCard({
  id: '3147',
  fullName: 'Violet Parr - Super Resilient',
  rarity: 'Super Rare',
  variants: [{id: '3573', rarity: 'Super Rare', number: 247}],
});

describe('printingAlt', () => {
  it('names a variant printing after the card, and leaves the Standard one as the card name', () => {
    const [standard, enchanted] = printingsOf(pongo);

    expect(printingAlt(pongo, standard)).toBe('Pongo - Determined Father');
    expect(printingAlt(pongo, enchanted)).toBe('Pongo - Determined Father, Enchanted printing');
  });

  it("names a printing that keeps its base card's rarity an alt foil (#802)", () => {
    const [, sameRarity] = printingsOf(violet);

    expect(printingAlt(violet, sameRarity)).toBe('Violet Parr - Super Resilient, Alt foil printing');
  });
});

/** Moana - Adventurer of Land and Sea, whose European 26/P2 reads "Vaiana" (owner, 2026-10-18). */
const moana: LorcanaCard = createCard({
  id: '1589',
  name: 'Moana',
  version: 'Adventurer of Land and Sea',
  fullName: 'Moana - Adventurer of Land and Sea',
  variants: [
    {id: '1663', rarity: 'Special', number: 26, promoGrouping: 'P2', printedName: 'Vaiana'},
  ],
});

describe('printedFullName', () => {
  it("names a printing by the name printed on it, with its card's version: 26/P2's Vaiana (#891)", () => {
    expect(printedFullName(moana, 'Vaiana')).toBe('Vaiana - Adventurer of Land and Sea');
    expect(printedFullName(moana, undefined)).toBe('Moana - Adventurer of Land and Sea');
  });

  it("names a promo printed under another name by it too: Moana's two 26/P2s are 26/P2 and 26/P2 Vaiana (#891)", () => {
    const vaiana = {rarity: 'Special', number: 26, promoGrouping: 'P2', printedName: 'Vaiana'};

    expect(printingName(vaiana)).toBe('26/P2 Vaiana');
    expect(printingSpokenName({...vaiana, label: '26/P2 Vaiana'})).toBe('Promo 26/P2, Vaiana');
  });

  it("names a printing's art by the name printed on it, carried from the card's variant (#891)", () => {
    const [, vaiana] = printingsOf(moana);

    expect(printingAlt(moana, vaiana)).toBe('Vaiana - Adventurer of Land and Sea, 26/P2 printing');
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
