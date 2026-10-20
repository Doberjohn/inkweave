import {describe, expect, it} from 'vitest';
import type {Ink} from 'inkweave-synergy-engine';
import {createCard} from '../../shared/test-utils';
import {percentOf, tallyCollection, tallySet} from './collectionStats';
import type {CollectionEntries} from './collectionParser';

/** Every chase printing and promo in the data names the card it reprints (#796, #805), so these do too. */
const PRINTINGS = new Set(['Epic', 'Enchanted', 'Iconic', 'Special']);
const card = (id: string, rarity: string, ink: Ink = 'Amber', ink2?: Ink) =>
  createCard({
    id,
    setCode: '1',
    rarity,
    ink,
    ...(ink2 === undefined ? {} : {ink2}),
    ...(PRINTINGS.has(rarity) ? {baseId: 'base'} : {}),
  });

describe('tallySet', () => {
  it('counts a card held in either finish as complete, both finishes as master', () => {
    const entries: CollectionEntries = {
      a: {normal: 1, foil: 0},
      b: {normal: 0, foil: 2},
      c: {normal: 1, foil: 1},
    };
    const t = tallySet([card('a', 'Common'), card('b', 'Common'), card('c', 'Common')], entries);
    expect(t.complete).toBe(3);
    expect(t.master).toBe(1);
  });

  it('counts every card the binder holds, the chase printings too', () => {
    // A search the binder answers with 25 cards, 21 held, reads 21 of 25 (owner, 2026-10-15).
    const t = tallySet([card('a', 'Common'), card('b', 'Enchanted'), card('c', 'Iconic')], {
      a: {normal: 1, foil: 0},
    });
    expect(t.cards).toBe(3);
    expect(t.complete).toBe(1);
  });

  it('counts a held chase printing as mastered, since it comes in one finish', () => {
    const t = tallySet([card('a', 'Common'), card('b', 'Enchanted')], {
      a: {normal: 1, foil: 0},
      b: {normal: 1, foil: 0},
    });
    expect(t.complete).toBe(2);
    expect(t.master).toBe(1);
  });

  it("counts a held printing that keeps its base card's rarity as mastered, under that rarity (#796)", () => {
    // Violet Parr #247: a Super Rare printing of a Super Rare card, in foil only.
    const sameRarity = createCard({id: 'p', setCode: '1', rarity: 'Super Rare', baseId: 'base'});
    const t = tallySet([sameRarity], {p: {normal: 0, foil: 1}});
    expect(t.byRarity).toEqual([{rarity: 'Super Rare', complete: 1, master: 1, total: 1}]);
  });

  it('attributes a dual-ink card to BOTH inks, matching inkDistribution', () => {
    const t = tallySet([card('a', 'Common', 'Amber', 'Steel')], {a: {normal: 1, foil: 0}});
    const byInk = Object.fromEntries(t.byInk.map((r) => [r.ink, r]));
    expect(byInk.Amber).toMatchObject({complete: 1, total: 1});
    expect(byInk.Steel).toMatchObject({complete: 1, total: 1});
  });

  it('ignores a zero-copy entry, which the parser can leave behind', () => {
    const t = tallySet([card('a', 'Common')], {a: {normal: 0, foil: 0}});
    expect(t.complete).toBe(0);
  });

  it('orders rarity rows common-to-scarce, so the rows read as a difficulty ramp', () => {
    const t = tallySet(
      [card('a', 'Iconic'), card('b', 'Legendary'), card('c', 'Enchanted'), card('d', 'Common'), card('e', 'Epic'), card('f', 'Rare')],
      {},
    );
    expect(t.byRarity.map((r) => r.rarity)).toEqual(['Common', 'Rare', 'Legendary', 'Epic', 'Enchanted', 'Iconic']);
  });

  it('gives the chase printings and the promos rarity rows of their own, and counts them in the inks', () => {
    // A foil-only Enchanted held is mastered: it comes in no other finish. So is a promo (#805),
    // a printing in one finish, whose twin in the other is a pocket of its own.
    const t = tallySet([card('a', 'Common'), card('c', 'Special'), card('b', 'Enchanted')], {
      a: {normal: 1, foil: 0},
      b: {normal: 0, foil: 1},
      c: {normal: 1, foil: 0},
    });
    expect(t.byRarity).toEqual([
      {rarity: 'Common', complete: 1, master: 0, total: 1},
      {rarity: 'Enchanted', complete: 1, master: 1, total: 1},
      {rarity: 'Special', complete: 1, master: 1, total: 1},
    ]);
    expect(t.cards).toBe(3);
    expect(t.byInk).toEqual([{ink: 'Amber', complete: 3, master: 2, total: 3}]);
  });
});

describe('tallyCollection', () => {
  // Set 2 is held whole, in both finishes for one card; Set 1 half, one card as a playset.
  const cards = [
    createCard({id: 's2a', setCode: '2', setNumber: 1, rarity: 'Common'}),
    createCard({id: 's2b', setCode: '2', setNumber: 2, rarity: 'Rare'}),
    createCard({id: 's1a', setCode: '1', setNumber: 1, rarity: 'Common'}),
    createCard({id: 's1b', setCode: '1', setNumber: 2, rarity: 'Legendary'}),
    createCard({id: 's1e', setCode: '1', setNumber: 205, rarity: 'Enchanted', baseId: 's1b'}),
  ];
  const entries: CollectionEntries = {
    s2a: {normal: 1, foil: 1},
    s2b: {normal: 1, foil: 0},
    s1a: {normal: 3, foil: 2},
    s1e: {normal: 1, foil: 0},
  };

  it('tallies every set in the order given, as the set list shows them', () => {
    const {sets} = tallyCollection(cards, entries, ['2', '1']);
    expect(sets.map((set) => [set.code, set.tally.complete, set.tally.cards])).toEqual([
      ['2', 2, 2],
      ['1', 2, 3],
    ]);
  });

  it('sums the sets, the Enchanted included', () => {
    const {totals} = tallyCollection(cards, entries, ['2', '1']);
    expect(totals).toMatchObject({cards: 5, complete: 4, master: 3});
  });

  it("counts a promo set's promos with the rest, one figure for the whole collection (owner, 2026-10-17)", () => {
    const promo = createCard({id: 'p1', setCode: 'P1', setNumber: 1, rarity: 'Special', baseId: 's1a'});
    const {totals, sets} = tallyCollection([...cards, promo], {...entries, p1: {normal: 0, foil: 1}}, ['2', '1', 'P1']);
    expect(sets.find((set) => set.code === 'P1')?.tally).toMatchObject({cards: 1, complete: 1, master: 1});
    expect(totals).toMatchObject({cards: 6, complete: 5, master: 4});
  });

  it("sums the promo sets alone into every promo set's figures (owner, 2026-10-20)", () => {
    const promos = [
      createCard({id: 'p1', setCode: 'P1', setNumber: 1, rarity: 'Special', baseId: 's1a'}),
      createCard({id: 'p2', setCode: 'P2', setNumber: 1, rarity: 'Special', baseId: 's2a'}),
    ];
    const held = {...entries, p1: {normal: 0, foil: 1}};
    const {promoTotals} = tallyCollection([...cards, ...promos], held, ['2', '1', 'P2', 'P1']);
    expect(promoTotals).toMatchObject({cards: 2, complete: 1, master: 1});
  });

  it('counts only the cards it is given, as the panel does for the cards a filter lets through', () => {
    const {totals, sets} = tallyCollection(cards.filter((c) => c.id !== 's1b'), entries, ['2', '1']);
    expect(totals).toMatchObject({cards: 4, complete: 4});
    expect(sets.find((set) => set.code === '1')?.tally).toMatchObject({cards: 2, complete: 2});
  });

  it("sums every set's breakdowns into the whole collection's, rarities in order", () => {
    const {totals} = tallyCollection(cards, entries, ['2', '1']);
    expect(totals.byInk).toEqual([{ink: 'Amber', complete: 4, master: 3, total: 5}]);
    expect(totals.byRarity).toEqual([
      {rarity: 'Common', complete: 2, master: 2, total: 2},
      {rarity: 'Rare', complete: 1, master: 0, total: 1},
      {rarity: 'Legendary', complete: 0, master: 0, total: 1},
      {rarity: 'Enchanted', complete: 1, master: 1, total: 1},
    ]);
  });
});

describe('percentOf', () => {
  it('reads 100% only when finished, never one card short', () => {
    // Winterspell's 203 of 204 rounded to 100% before.
    expect(percentOf(203, 204)).toBe(99);
    expect(percentOf(204, 204)).toBe(100);
  });

  it('reads nothing to count as 0%, not NaN', () => {
    expect(percentOf(0, 0)).toBe(0);
  });

  it('reads an exact whole percent as itself, which float division read one short', () => {
    expect(percentOf(29, 100)).toBe(29);
    expect(percentOf(58, 200)).toBe(29);
    expect(percentOf(29, 50)).toBe(58);
  });
});
