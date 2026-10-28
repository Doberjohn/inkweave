import {describe, it, expect} from 'vitest';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {createCard} from '../../shared/test-utils';
import {browseCountMessage, browseView, gridModalTarget, printingIdsFor, searchPool, tilePrintingFor} from '../browseView';
import {binderRarities} from '../../features/collection/binderCards';
import {countCompare, inViewOf} from '../../features/collection/compareCollections';
import type {Axis} from '../../features/collection/collectionStats';
import {LAYOUT} from '../../shared/constants';

// Core folds Elsa's Enchanted printing into her card; the collection's wide pool
// also holds that printing as a card of its own, and cards from before Core.
const elsa = createCard({id: 'elsa', rarity: 'Legendary', variants: [{id: 'elsa-ench', rarity: 'Enchanted', number: 205}]});
const anna = createCard({id: 'anna', rarity: 'Rare'});
const core = [elsa, anna];
const wide = [...core, createCard({id: 'elsa-ench', rarity: 'Enchanted'}), createCard({id: 'set-1', setCode: '1'})];

const params = (rarities?: string[], setCodes?: string[]) => ({
  filters: {...(rarities && {rarities}), ...(setCodes && {setCodes})},
  inkFilters: [],
  typeFilters: [],
  costFilters: [],
  searchQuery: '',
  sortOrder: 'ink-cost' as const,
});

/** Holds Anna and the Set 1 card, and nothing else. */
const owns = (card: LorcanaCard) => card.id === 'anna' || card.id === 'set-1';
/** Collection mode's slots, its binder showing every card unless told otherwise. */
const binder = (
  active: boolean,
  show: 'all' | 'owned' | 'missing' = 'all',
  kept: ReadonlySet<string> = new Set(),
) => ({
  active,
  pool: wide,
  show,
  inView: show === 'all' ? null : (card: LorcanaCard) => owns(card) === (show === 'owned'),
  kept,
  rarityOptions: binderRarities,
  promoOnly: false,
});

const ids = (cards: LorcanaCard[]) => cards.map((card) => card.id).sort();

describe('browseView', () => {
  it('lists Core while the binder is off, even with the wide pool loaded for an import', () => {
    expect(ids(browseView(binder(false), core, params()).sortedCards)).toEqual(['anna', 'elsa']);
  });

  it("finds the grid's cards through a picked printing, and offers their printings' rarities", () => {
    const view = browseView(null, core, params(['Enchanted']));
    expect(ids(view.sortedCards)).toEqual(['elsa']);
    expect(view.rarities).toEqual(['Rare', 'Legendary', 'Enchanted']);
  });

  it("offers the binder its pool's keywords and classifications, which sets 1-8 widen", () => {
    const broom = createCard({id: 'broom', setCode: '1', keywords: ['Vanish'], classifications: ['Broom']});
    const view = browseView({...binder(true), pool: [...wide, broom]}, core, params());
    expect(view.binderOptions?.keywords).toContain('Vanish');
    expect(view.binderOptions?.classifications).toContain('Broom');
    // The grid keeps Core's options, which CardDataContext already holds.
    expect(browseView(null, core, params()).binderOptions).toBeNull();
  });

  it("matches the binder's printings by their own rarity, not their base card", () => {
    expect(ids(browseView(binder(true), core, params(['Enchanted'])).sortedCards)).toEqual(['elsa-ench']);
  });

  it('shows the binder the cards you hold, or the ones you hold none of', () => {
    expect(ids(browseView(binder(true, 'owned'), core, params()).sortedCards)).toEqual(['anna', 'set-1']);
    expect(ids(browseView(binder(true, 'missing'), core, params()).sortedCards)).toEqual(['elsa', 'elsa-ench']);
  });

  it('keeps a card changed by hand in the view it left, though not past the filters (#826)', () => {
    // Anna's first copy took her out of Missing; she stays until the view changes.
    const kept = new Set(['anna']);
    expect(ids(browseView(binder(true, 'missing', kept), core, params()).sortedCards)).toEqual([
      'anna',
      'elsa',
      'elsa-ench',
    ]);
    const enchanted = browseView(binder(true, 'missing', kept), core, params(['Enchanted']));
    expect(ids(enchanted.sortedCards)).toEqual(['elsa-ench']);
  });

  it('leaves the grid alone: it has no binder view', () => {
    expect(ids(browseView(binder(false, 'owned'), core, params()).sortedCards)).toEqual(['anna', 'elsa']);
  });

  it('applies no set filter to the binder, whose set is chosen in the collection panel', () => {
    expect(ids(browseView(binder(true), core, params(undefined, ['99'])).sortedCards)).toHaveLength(4);
    expect(ids(browseView(binder(false), core, params(undefined, ['99'])).sortedCards)).toEqual([]);
  });

  it('offers a binder of promos alone no rarities and applies none, so no hidden filter empties it (owner, 2026-10-20)', () => {
    const view = browseView({...binder(true), promoOnly: true}, core, params(['Common']));
    expect(view.rarities).toEqual([]);
    expect(ids(view.sortedCards)).toHaveLength(4);
    expect(view.filtered).toBe(false);
  });

  it("hands the collection panel the cards before the binder's view, or Owned would read 100%", () => {
    const view = browseView(binder(true, 'owned'), core, params());
    expect(ids(view.sortedCards)).toEqual(['anna', 'set-1']);
    expect(ids(view.matchedCards)).toEqual(['anna', 'elsa', 'elsa-ench', 'set-1']);
  });

  it('calls the list filtered for a search or a filter it applies, never for the set filter the binder drops', () => {
    expect(browseView(binder(true), core, params()).filtered).toBe(false);
    expect(browseView(binder(true), core, {...params(), searchQuery: 'Elsa'}).filtered).toBe(true);
    expect(browseView(binder(true), core, params(['Enchanted'])).filtered).toBe(true);
    expect(browseView(binder(true), core, params(undefined, ['99'])).filtered).toBe(false);
  });
});

describe("a friend's binder: You need and They need (#1045)", () => {
  // Hand-counted: Nani a, Belle b, Chip c and Dale e come in both finishes; Elsa d is an
  // Enchanted, foil alone. You hold a in normal, b in both, d in foil and e in normal; the
  // friend holds only the foil of a, the normal of b and two normals of c.
  const two = (id: string) => createCard({id, setCode: '1', rarity: 'Uncommon'});
  const cards = [two('a'), two('b'), two('c'), createCard({id: 'd', setCode: '1', rarity: 'Enchanted', baseId: 'x'}), two('e')];
  const mine = {a: {normal: 1, foil: 0}, b: {normal: 1, foil: 1}, d: {normal: 0, foil: 1}, e: {normal: 1, foil: 0}};
  const theirs = {a: {normal: 0, foil: 1}, b: {normal: 1, foil: 0}, c: {normal: 2, foil: 0}};
  const compare = {mine, theirs};
  const shown = (show: 'you-need' | 'they-need', axis: Axis) =>
    ids(
      browseView(
        {...binder(true), pool: cards, inView: inViewOf(show, axis, {shown: theirs, compare})},
        cards,
        params(),
      ).sortedCards,
    );

  it('lists under Complete set the cards one of you holds and the other holds none of', () => {
    expect(shown('you-need', 'complete')).toEqual(['c']);
    expect(shown('they-need', 'complete')).toEqual(['d', 'e']);
    expect(countCompare(cards, compare, 'complete')).toEqual({youNeed: 1, theyNeed: 2});
  });

  it("lists under Master set each finish the other lacks: their only foil of your normal Nani, both ways", () => {
    expect(shown('you-need', 'master')).toEqual(['a', 'c']);
    expect(shown('they-need', 'master')).toEqual(['a', 'b', 'd', 'e']);
    expect(countCompare(cards, compare, 'master')).toEqual({youNeed: 2, theyNeed: 4});
  });

  it("asks Owned and Missing of the friend's copies, and shows All for You need without your own", () => {
    const view = (show: 'owned' | 'missing' | 'you-need') =>
      ids(
        browseView(
          {...binder(true), pool: cards, inView: inViewOf(show, 'complete', {shown: theirs, compare: null})},
          cards,
          params(),
        ).sortedCards,
      );
    expect(view('owned')).toEqual(['a', 'b', 'c']);
    expect(view('missing')).toEqual(['d', 'e']);
    expect(view('you-need')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('printingIdsFor', () => {
  it('opens each card on its printing of a picked rarity, and the rest on their own art', () => {
    const byId = new Map(core.map((card) => [card.id, card]));
    const printingFor = printingIdsFor((id) => byId.get(id), ['Enchanted']);
    expect(printingFor('elsa')).toBe('elsa-ench');
    expect(printingFor('anna')).toBeUndefined();
  });
});

// Each promo is a tile of its own once promos are picked (owner, 2026-10-17, #805).
describe('promo tiles', () => {
  const promo = (id: string, number: number, promoGrouping: string) => ({
    id,
    rarity: 'Special',
    number,
    promoGrouping,
    imageUrl: `/card-images/${id}.avif`,
  });
  // Mickey Mouse - True Friend's promos in two promo sets, and a Legendary with one.
  const mickey = createCard({
    id: '1949',
    rarity: 'Rare',
    variants: [promo('2432', 10, 'P3'), promo('80042', 25, 'P1')],
  });
  const elsaWithPromo = {...elsa, setCode: '9', variants: [...elsa.variants!, promo('elsa-p3', 4, 'P3')]};
  const pool = [elsaWithPromo, anna, mickey];
  const byId = new Map(pool.map((card) => [card.id, card]));
  const cardById = (id: string) => byId.get(id);
  const tile = (cards: LorcanaCard[], id: string) => cards.find((card) => card.id === id)!;

  it('lists each promo as a tile of its own, and no tile for a card only a promo matched', () => {
    const {sortedCards} = browseView(null, pool, params(['Special']));

    expect(ids(sortedCards)).toEqual(['2432', '80042', 'elsa-p3']);
    expect(tile(sortedCards, '80042')).toMatchObject({
      baseId: '1949',
      rarity: 'Special',
      setCode: 'P1',
      setNumber: 25,
      imageUrl: '/card-images/80042.avif',
    });
  });

  it("keeps a card's own tile when another picked rarity matches it, its promos beside it", () => {
    const {sortedCards} = browseView(null, pool, params(['Rare', 'Special']));

    expect(ids(sortedCards)).toEqual(['1949', '2432', '80042', 'anna', 'elsa-p3']);
  });

  it("puts the promo tiles after the main sets' cards in Newest first, newest promo set first", () => {
    const {sortedCards} = browseView(null, pool, {...params(['Enchanted', 'Special']), sortOrder: 'newest'});

    expect(sortedCards.map((card) => card.id)).toEqual(['elsa', 'elsa-p3', '2432', '80042']);
  });

  it("shows each tile's printing: a promo tile its promo, a card's tile its picked printing but never a promo", () => {
    const printingFor = tilePrintingFor(cardById, ['Enchanted', 'Special']);
    const {sortedCards} = browseView(null, pool, params(['Enchanted', 'Special']));

    expect(printingFor(tile(sortedCards, '80042'))?.promoGrouping).toBe('P1');
    expect(printingFor(elsaWithPromo)?.id).toBe('elsa-ench');
    expect(printingIdsFor(cardById, ['Legendary', 'Special'])('elsa')).toBeUndefined();
  });

  it('opens a promo tile as its card on that promo, each place keeping its own printing', () => {
    const {sortedCards} = browseView(null, pool, {...params(['Enchanted', 'Special']), sortOrder: 'newest'});
    const target = gridModalTarget('80042', sortedCards, printingIdsFor(cardById, ['Enchanted', 'Special']));

    expect(target.cardId).toBe('1949');
    expect(target.siblingIds).toEqual(['elsa', 'elsa', '1949', '1949']);
    expect(target.options.siblingIndex).toBe(3);
    expect([0, 1, 2, 3].map((at) => target.options.printingFor(target.siblingIds[at], at))).toEqual([
      'elsa-ench',
      'elsa-p3',
      '2432',
      '80042',
    ]);
  });
});

// A search lists the sets 1-8 cards Core doesn't have too (#911), with their real ids.
describe("Browse's search over sets 1-8", () => {
  // Ariel - Singing Mermaid is in Set 4 and Set 9: Core's card stands for both printings.
  const singing = createCard({id: '1951', name: 'Ariel', fullName: 'Ariel - Singing Mermaid', setCode: '9', rarity: 'Rare'});
  const singingSet4 = {...singing, id: '694', setCode: '4'};
  const onHumanLegs = createCard({
    id: '1',
    name: 'Ariel',
    fullName: 'Ariel - On Human Legs',
    setCode: '1',
    rarity: 'Uncommon',
  });
  // Captain Hook - Forceful Duelist is in sets 1 and 8, both before Core.
  const hook = createCard({id: '174', name: 'Captain Hook', fullName: 'Captain Hook - Forceful Duelist', setCode: '1'});
  const hookSet8 = {...hook, id: '1850', setCode: '8'};
  const preCore = [singingSet4, onHumanLegs, hook, hookSet8];
  const search = (searchQuery: string) => ({...params(), searchQuery});

  it("adds each sets 1-8 card whose name Core doesn't have, once, from its newest set", () => {
    expect(ids(searchPool([singing], preCore))).toEqual(['1', '1850', '1951']);
  });

  it("lists sets 1-8 only while a search is on, and keeps the grid's rarity options Core's", () => {
    expect(ids(browseView(null, [singing], params(), preCore).sortedCards)).toEqual(['1951']);

    const view = browseView(null, [singing], search('ariel'), preCore);
    expect(ids(view.sortedCards)).toEqual(['1', '1951']);
    expect(view.rarities).toEqual(['Rare']);
  });

  it("leaves the binder's pool as it is, since it holds sets 1-8 already", () => {
    expect(ids(browseView(binder(true), core, search('ariel'), [onHumanLegs]).sortedCards)).toEqual([]);
  });

  it('hands the card window the resolver for the cards Core cannot open', () => {
    const resolveCard = (id: string) => (id === '1' ? onHumanLegs : undefined);
    const target = gridModalTarget('1', [singing, onHumanLegs], () => undefined, resolveCard);

    expect(target.cardId).toBe('1');
    expect(target.siblingIds).toEqual(['1951', '1']);
    expect(target.options.resolveCard).toBe(resolveCard);
  });
});

describe("Browse's status line", () => {
  const max = LAYOUT.maxDisplayedCards;

  it('counts the cards the grid lists, and says when none match', () => {
    expect(browseCountMessage(0)).toBe('No cards match your filters.');
    expect(browseCountMessage(1)).toBe('1 card');
    expect(browseCountMessage(3)).toBe('3 cards');
    expect(browseCountMessage(max)).toBe(`${max} cards`);
  });

  it('says the grid lists only its first cards when more match, the total digits grouped', () => {
    expect(browseCountMessage(max + 1)).toBe(`Showing ${max} of ${max + 1} cards`);
    expect(browseCountMessage(1393)).toBe(`Showing ${max} of 1,393 cards`);
  });
});
