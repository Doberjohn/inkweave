import {describe, it, expect} from 'vitest';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {
  WHOLE_COLLECTION,
  binderContents,
  binderOrder,
  binderRarities,
  setFromFilter,
  withPrintingCards,
  withoutStrays,
} from './binderCards';

const card = (rarity: string) => ({rarity}) as LorcanaCard;

describe('binderRarities', () => {
  it('offers the special printings the binder holds, in rarity order, but never the Special promos', () => {
    // The binder drops Special, so a Special chip would veil every slot.
    const pool = ['Special', 'Enchanted', 'Rare', 'Common', 'Special'].map(card);
    expect(binderRarities(pool)).toEqual(['Common', 'Rare', 'Enchanted']);
  });
});

describe('binderOrder', () => {
  const pocket = (id: string, setNumber: number, cost: number, extra: Partial<LorcanaCard> = {}) =>
    ({id, fullName: id, setCode: '9', setNumber, cost, rarity: 'Common', ...extra}) as LorcanaCard;
  const ids = (cards: LorcanaCard[]) => cards.map((c) => c.id);

  const POOL = [
    pocket('c3', 3, 1),
    pocket('c1', 1, 5),
    pocket('promo', 1, 2, {rarity: 'Special'}),
    pocket('c2', 2, 3),
    pocket('next-set', 1, 1, {setCode: '10'}),
  ];

  it('fills the pockets in collector order under the default sort, with only this set and no promos', () => {
    expect(ids(binderOrder(POOL, '9', 'newest'))).toEqual(['c1', 'c2', 'c3']);
  });

  it('re-pockets the set in the order of another sort', () => {
    expect(ids(binderOrder(POOL, '9', 'cost-asc'))).toEqual(['c3', 'c2', 'c1']);
  });

  it('keeps collector order between cards the sort ties, so a base card stays ahead of its Enchanted', () => {
    const elsa = [pocket('enchanted', 205, 4, {fullName: 'Elsa'}), pocket('base', 12, 4, {fullName: 'Elsa'})];
    expect(ids(binderOrder(elsa, '9', 'name-asc'))).toEqual(['base', 'enchanted']);
  });
});

describe('the whole collection in one binder', () => {
  const pocket = (id: string, setCode: string, setNumber: number, fullName = id) =>
    ({id, fullName, setCode, setNumber, cost: 1, rarity: 'Common'}) as LorcanaCard;
  const POOL = [pocket('a2', '9', 2, 'Zurg'), pocket('b1', '10', 1, 'Elsa'), pocket('a1', '9', 1, 'Elsa'), pocket('b2', '10', 2, 'Yzma')];
  const SETS = ['10', '9'];
  const ids = (cards: readonly LorcanaCard[]) => cards.map((c) => c.id);

  it('goes set by set in collector order, newest set first, each set straight after the one before', () => {
    expect(ids(binderContents(POOL, WHOLE_COLLECTION, 'newest', SETS))).toEqual(['b1', 'b2', 'a1', 'a2']);
  });

  it('sorts across every set under any other sort, so cards of a name sit together', () => {
    expect(ids(binderContents(POOL, WHOLE_COLLECTION, 'name-asc', SETS)).slice(0, 2).sort()).toEqual(['a1', 'b1']);
  });

  it("holds a lone set's cards alone, in the page's sort", () => {
    expect(ids(binderContents(POOL, '9', 'newest', SETS))).toEqual(['a1', 'a2']);
  });
});

describe('withPrintingCards', () => {
  const base = {
    id: '14012',
    fullName: 'Miguel Rivera - Street Musician',
    setCode: '14',
    setNumber: 12,
    rarity: 'Rare',
    imageUrl: '/base.avif',
    imageHash: 'basehash',
    variants: [{id: '14224', rarity: 'Enchanted', number: 224, imageUrl: '/enchanted.avif'}],
  } as LorcanaCard;

  it("gives a printing with no card of its own one, under the printing's id, rarity, number and art", () => {
    // A preview set has no chunk, so its Enchanted lives only in the base card's variants.
    const [, printing] = withPrintingCards([base]);
    expect(printing).toMatchObject({id: '14224', rarity: 'Enchanted', setNumber: 224, imageUrl: '/enchanted.avif'});
    expect(printing.fullName).toBe(base.fullName);
    expect(printing.imageHash).toBeUndefined();
    expect(printing.variants).toBeUndefined();
  });

  it('leaves alone a printing the pool already holds as a card, as a chunk supplies it', () => {
    const fromChunk = {...base, id: '14224', rarity: 'Enchanted', setNumber: 224, variants: undefined} as LorcanaCard;
    expect(withPrintingCards([base, fromChunk])).toHaveLength(2);
  });
});

describe('withoutStrays', () => {
  it("drops a set filter in collection mode, and the binder's view outside it", () => {
    const left = (url: string) => withoutStrays(new URLSearchParams(url)).toString();
    expect(left('binder=9&set=10&owned=missing')).toBe('binder=9&owned=missing');
    expect(left('set=10&owned=missing&keyword=Ward')).toBe('set=10&keyword=Ward');
  });
});

describe('setFromFilter', () => {
  it('opens the newest set a Browse set filter names, among the sets the binder has', () => {
    expect(setFromFilter('9,13,5', ['14', '13', '9'])).toBe('13');
  });

  it('opens none for a filter naming no set the binder has, or no filter at all', () => {
    expect(setFromFilter('99', ['14', '13'])).toBeUndefined();
    expect(setFromFilter(null, ['14'])).toBeUndefined();
  });

  it('trusts the filter until the list of sets is known', () => {
    expect(setFromFilter('3,7', null)).toBe('7');
  });
});
