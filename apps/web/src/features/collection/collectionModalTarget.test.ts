import {describe, it, expect} from 'vitest';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {binderModalTarget, collectionModalTarget} from './collectionModalTarget';

const card = (id: string, extra: Partial<LorcanaCard> = {}) => ({id, name: id, ...extra}) as LorcanaCard;

const CORE = [card('core-1', {variants: [{id: 'ench-1', rarity: 'Enchanted', number: 205}]})];
/** A pre-Core card that holds its Enchanted in `variants` too, as collection mode gives it (#891). */
const PRE_CORE = card('set1-base', {
  variants: [{id: 'set1-ench', rarity: 'Enchanted', number: 205}],
});
const POOL = [
  ...CORE,
  card('ench-1'),
  card('set1-card'),
  PRE_CORE,
  card('set1-ench', {baseId: 'set1-base'}),
];

describe('collectionModalTarget', () => {
  it('opens a Core card as itself', () => {
    expect(collectionModalTarget('core-1', POOL, [])).toMatchObject({
      cardId: 'core-1',
      options: {},
    });
    expect(collectionModalTarget('core-1', POOL, []).options.printingId).toBeUndefined();
  });

  it('opens an alternate printing on its Core base card, so it keeps real synergies', () => {
    expect(collectionModalTarget('ench-1', POOL, [])).toMatchObject({
      cardId: 'core-1',
      options: {printingId: 'ench-1'},
    });
  });

  it('opens a pre-Core printing on its base card too, on that printing (#891)', () => {
    expect(collectionModalTarget('set1-ench', POOL, [])).toMatchObject({
      cardId: 'set1-base',
      options: {printingId: 'set1-ench'},
    });
  });

  it('resolves an outside-Core card from the pool, and a printing sibling to its base', () => {
    const {cardId, options} = collectionModalTarget('set1-card', POOL, []);
    expect(cardId).toBe('set1-card');
    expect(options.resolveCard('set1-card')?.id).toBe('set1-card');
    expect(options.resolveCard('ench-1')?.id).toBe('core-1');
  });

  it('maps a printing in the sibling list to its base card, so every place opens a card', () => {
    const {siblingIds} = collectionModalTarget('ench-1', POOL, ['set1-card', 'ench-1']);
    expect(siblingIds).toEqual(['set1-card', 'core-1']);
  });

  it("keeps the clicked pocket's place and each place's printing when a card and its printing are both listed", () => {
    // The binder holds core-1's own pocket and its Enchanted's pocket: one id, two places.
    const {siblingIds, options} = collectionModalTarget('ench-1', POOL, [
      'core-1',
      'set1-card',
      'ench-1',
    ]);
    expect(siblingIds).toEqual(['core-1', 'set1-card', 'core-1']);
    expect(options.siblingIndex).toBe(2);
    expect(options.printingFor('core-1', 0)).toBeUndefined();
    expect(options.printingFor('core-1', 2)).toBe('ench-1');
  });
});

describe('binderModalTarget', () => {
  const pocket = (id: string, setNumber: number, cost: number, setCode = '9') =>
    ({id, name: id, fullName: id, setCode, setNumber, cost, rarity: 'Common'}) as LorcanaCard;
  const [p1, p2, p3, nextSet] = [pocket('p1', 1, 5), pocket('p2', 2, 1), pocket('p3', 3, 3), pocket('n1', 1, 2, '10')];
  const binder = {pool: [p1, p2, p3, nextSet], setCode: '9', sets: ['10', '9']};

  it("steps through this set's lit cards in the binder's order, not the page's list", () => {
    // p3 is filtered out and n1 is another set's; the listing's own order is ignored.
    const listing = {cards: [p1, nextSet, p2], sortOrder: 'cost-asc' as const};
    expect(binderModalTarget('p1', listing, binder).siblingIds).toEqual(['p2', 'p1']);
  });

  it('steps through the whole collection set by set, newest first, when the binder holds it', () => {
    const listing = {cards: [p1, nextSet, p2], sortOrder: 'newest' as const};
    expect(binderModalTarget('p1', listing, {...binder, setCode: 'all'}).siblingIds).toEqual(['n1', 'p1', 'p2']);
  });
});
