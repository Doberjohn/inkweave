import {describe, it, expect} from 'vitest';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {
  WHOLE_COLLECTION,
  binderCardsForSet,
  binderContents,
  binderOrder,
  binderRarities,
  binderSets,
  binderSlots,
  isOpenPocket,
  namesStretches,
  promoSetPockets,
  setFromFilter,
  setLabel,
  setName,
  withPrintingCards,
  withoutStrays,
  type BinderSlot,
} from './binderCards';

/** The facts a test gives a card: its id, and whatever else it is about. */
type CardFacts = Partial<LorcanaCard> & Pick<LorcanaCard, 'id'>;

/** A card for these tests, named by its id: a 1-cost Common unless told otherwise. */
const cardOf = (facts: CardFacts) => ({fullName: facts.id, cost: 1, rarity: 'Common', ...facts}) as LorcanaCard;

describe('binderRarities', () => {
  it('offers every rarity the binder holds, in rarity order, the promos last (#805)', () => {
    const pool = [
      {rarity: 'Special'},
      {rarity: 'Enchanted'},
      {rarity: 'Rare'},
      {rarity: 'Common'},
      {rarity: 'Special'},
    ] as LorcanaCard[];
    expect(binderRarities(pool)).toEqual(['Common', 'Rare', 'Enchanted', 'Special']);
  });
});

describe('binderOrder', () => {
  /** A Set 9 card. */
  const pocket = (facts: CardFacts) => cardOf({setCode: '9', ...facts});
  const ids = (cards: LorcanaCard[]) => cards.map((c) => c.id);

  const POOL = [
    pocket({id: 'c3', setNumber: 3, cost: 1}),
    pocket({id: 'c1', setNumber: 1, cost: 5}),
    // A promo of Set 9's card #1 is in its promo set, not in Set 9 (#805).
    pocket({id: 'promo', setNumber: 1, cost: 2, rarity: 'Special', setCode: 'P1'}),
    pocket({id: 'c2', setNumber: 2, cost: 3}),
    pocket({id: 'next-set', setNumber: 1, cost: 1, setCode: '10'}),
  ];

  it('fills the pockets in collector order under the default sort, with only this set', () => {
    expect(ids(binderOrder(POOL, '9', 'newest'))).toEqual(['c1', 'c2', 'c3']);
  });

  it("orders a promo set's twins foil first and its promo with no number last", () => {
    const promos = [
      pocket({id: 'unnumbered', setCode: 'C1'}),
      pocket({id: '3-normal', setNumber: 3, setCode: 'C1', finish: 'normal'}),
      pocket({id: '3-foil', setNumber: 3, setCode: 'C1', finish: 'foil'}),
      pocket({id: '1', setNumber: 1, setCode: 'C1'}),
    ];
    expect(ids(binderOrder(promos, 'C1', 'newest'))).toEqual(['1', '3-foil', '3-normal', 'unnumbered']);
  });

  it('re-pockets the set in the order of another sort', () => {
    expect(ids(binderOrder(POOL, '9', 'cost-asc'))).toEqual(['c3', 'c2', 'c1']);
  });

  it('keeps collector order between cards the sort ties, so a base card stays ahead of its Enchanted', () => {
    const elsa = [
      pocket({id: 'enchanted', setNumber: 205, cost: 4, fullName: 'Elsa'}),
      pocket({id: 'base', setNumber: 12, cost: 4, fullName: 'Elsa'}),
    ];
    expect(ids(binderOrder(elsa, '9', 'name-asc'))).toEqual(['base', 'enchanted']);
  });
});

describe('the whole collection in one binder', () => {
  const POOL = [
    cardOf({id: 'a2', setCode: '9', setNumber: 2, fullName: 'Zurg'}),
    cardOf({id: 'b1', setCode: '10', setNumber: 1, fullName: 'Elsa'}),
    cardOf({id: 'a1', setCode: '9', setNumber: 1, fullName: 'Elsa'}),
    cardOf({id: 'b2', setCode: '10', setNumber: 2, fullName: 'Yzma'}),
  ];
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

  it('names the card a printing it gives a card to reprints, as a chunk card does (#796)', () => {
    const [, printing] = withPrintingCards([base]);
    expect(printing.baseId).toBe('14012');
  });

  it('leaves alone a printing the pool already holds as a card, as a chunk supplies it', () => {
    const fromChunk = {...base, id: '14224', rarity: 'Enchanted', setNumber: 224, variants: undefined} as LorcanaCard;
    expect(withPrintingCards([base, fromChunk])).toHaveLength(2);
  });

  it("leaves a card's promos to the collection's promo list, which puts each in its promo set (#805)", () => {
    const promo = {id: '80042', rarity: 'Special', number: 25, promoGrouping: 'P1'};
    expect(withPrintingCards([{...base, variants: [promo]}])).toHaveLength(1);
  });
});

describe('promoSetPockets (#805)', () => {
  /** A promo of Promo Set 4. */
  const promo = (facts: CardFacts) => cardOf({setCode: 'P4', rarity: 'Special', ...facts});
  const waiting = [{id: '80033', rarity: 'Special', number: 3, promoGrouping: 'P4', fullName: 'Hades - Dark Usurper'}];
  /** Each pocket as its card's id, or its number for an open one, its card's name after it if it waits for one. */
  const laidOut = (slots: BinderSlot[]) =>
    slots.map((slot) => {
      if (!isOpenPocket(slot)) return slot.id;
      return slot.fullName ? `open ${slot.setNumber} ${slot.fullName}` : `open ${slot.setNumber}`;
    });

  it('gives every number up to the highest a pocket, open where no promo is known, and names a waiting one', () => {
    const pockets = promoSetPockets([promo({id: '5', setNumber: 5}), promo({id: '1', setNumber: 1})], waiting, 'P4');
    expect(laidOut(pockets)).toEqual(['1', 'open 2', 'open 3 Hades - Dark Usurper', 'open 4', '5']);
  });

  it('gives twins a pocket each under their number, and the promos with no number the last ones', () => {
    const pockets = promoSetPockets(
      [
        promo({id: 'x'}),
        promo({id: '2n', setNumber: 2, finish: 'normal'}),
        promo({id: '2f', setNumber: 2, finish: 'foil'}),
      ],
      [],
      'P4',
    );
    expect(laidOut(pockets)).toEqual(['open 1', '2f', '2n', 'x']);
  });

  it('marks a number its promo set never released: Promo Set 2 skipped 37 to 41 outside China', () => {
    const pockets = promoSetPockets(
      [promo({id: '36', setNumber: 36, setCode: 'P2'}), promo({id: '43', setNumber: 43, setCode: 'P2'})],
      [],
      'P2',
    );
    const unreleased = pockets.filter((pocket) => isOpenPocket(pocket) && pocket.unreleased);

    expect(unreleased.map((pocket) => pocket.setNumber)).toEqual([37, 38, 39, 40, 41]);
    // A number below 36 is only unlisted.
    expect(pockets.find((pocket) => pocket.setNumber === 35)).toEqual({open: true, setCode: 'P2', setNumber: 35});
  });

  it('marks a number its promo set has still to release: Promo Set 4 skipped 2 to 6 for now', () => {
    const pockets = promoSetPockets([promo({id: '1', setNumber: 1}), promo({id: '7', setNumber: 7})], [], 'P4');
    const open = pockets.filter(isOpenPocket);

    expect(open.map((pocket) => pocket.setNumber)).toEqual([2, 3, 4, 5, 6]);
    expect(open.every((pocket) => pocket.upcoming && !pocket.unreleased)).toBe(true);
  });

  it("gives a waiting promo's pocket its art, so a scan shows before its card is out (owner, 2026-10-19)", () => {
    const scanned = [{...waiting[0], imageUrl: '/card-images-preview/80033.avif', imageHashSm: 'sm'}];
    const [, , open] = promoSetPockets([promo({id: '1', setNumber: 1})], scanned, 'P4');
    expect(open).toMatchObject({id: '80033', imageUrl: '/card-images-preview/80033.avif', imageHashSm: 'sm'});
  });

  it("leaves out another promo set's waiting promos", () => {
    expect(laidOut(promoSetPockets([promo({id: '1', setNumber: 1, setCode: 'C3'})], waiting, 'C3'))).toEqual(['1']);
  });
});

describe("a promo set that gathers editions: Curator's Collection (owner, 2026-10-18)", () => {
  /** A promo of one edition, named by its edition and number: "CC1-2". */
  const cc = (place: Pick<LorcanaCard, 'setCode' | 'setNumber'>) =>
    cardOf({id: `${place.setCode}-${place.setNumber}`, fullName: 'A', rarity: 'Special', ...place});

  it('is one set in the binder, listed once for all its editions', () => {
    const set14 = cardOf({id: '14-1', fullName: 'A card', setCode: '14', setNumber: 1});
    const pool = [
      cc({setCode: 'CC2', setNumber: 1}),
      cc({setCode: 'CC1', setNumber: 1}),
      set14,
      cc({setCode: 'CC1', setNumber: 2}),
    ];
    expect(binderSets(pool)).toEqual(['14', 'CC']);
  });

  it('holds its editions in turn, oldest first, each in collector order', () => {
    const cards = [
      cc({setCode: 'CC2', setNumber: 1}),
      cc({setCode: 'CC1', setNumber: 2}),
      cc({setCode: 'CC1', setNumber: 1}),
      cc({setCode: 'CC2', setNumber: 2}),
    ];
    expect(binderCardsForSet(cards, 'CC').map((card) => card.id)).toEqual(['CC1-1', 'CC1-2', 'CC2-1', 'CC2-2']);
  });

  it("lays out each edition's numbers in turn, open where an edition skips one", () => {
    const promos = [
      cc({setCode: 'CC1', setNumber: 1}),
      cc({setCode: 'CC1', setNumber: 3}),
      cc({setCode: 'CC2', setNumber: 2}),
    ];
    const slots = promoSetPockets(promos, [], 'CC');
    expect(slots.map((slot) => (isOpenPocket(slot) ? `open ${slot.setNumber}/${slot.setCode}` : slot.id))).toEqual([
      'CC1-1',
      'open 2/CC1',
      'CC1-3',
      'open 1/CC2',
      'CC2-2',
    ]);
  });

  it('names its editions in the spread map, as the whole collection names its sets, in collector order only', () => {
    expect(namesStretches('CC', 'newest')).toBe(true);
    expect(namesStretches(WHOLE_COLLECTION, 'newest')).toBe(true);
    expect(namesStretches('P1', 'newest')).toBe(false);
    expect(namesStretches('CC', 'name-asc')).toBe(false);
  });
});

describe('binderSlots (#805)', () => {
  const SHOWN = [cardOf({id: 'main', setCode: '14', setNumber: 1}), cardOf({id: 'promo', setCode: 'P4', setNumber: 2})];
  const context = {
    scope: WHOLE_COLLECTION,
    sets: ['14', 'P4'],
    sortOrder: 'newest' as const,
    narrowed: false,
    waiting: [],
  };

  it("opens a promo set's unlisted numbers in its stretch of the whole collection, and leaves a set's cards be", () => {
    const slots = binderSlots(SHOWN, context);
    expect(slots.map((slot) => (isOpenPocket(slot) ? 'open' : slot.id))).toEqual(['main', 'open', 'promo']);
  });

  it('packs the cards when a filter or a view narrows them, or another sort orders them', () => {
    expect(binderSlots(SHOWN, {...context, narrowed: true})).toEqual(SHOWN);
    expect(binderSlots(SHOWN, {...context, sortOrder: 'name-asc'})).toEqual(SHOWN);
  });
});

describe('set names (#805)', () => {
  it("names a promo set by its name, and an edition by its set's and its own", () => {
    expect(setName('P1')).toBe('Promo Set 1');
    expect(setName('CC')).toBe("Curator's Collection");
    expect(setName('CC1')).toBe("Curator's Collection: Heroines Edition");
  });

  it('says what kind of set it is when naming it whole', () => {
    expect(setLabel('11')).toBe('Set 11, Winterspell');
    expect(setLabel('P1')).toBe('Promo set P1, Promo Set 1');
    expect(setLabel('CC')).toBe("Promo set CC, Curator's Collection");
    expect(setLabel('CC2')).toBe("Promo set CC2, Curator's Collection: Beauty and the Beast Edition");
  });
});

describe('withoutStrays', () => {
  it("drops a set filter in collection mode, and the binder's view outside it", () => {
    const left = (params: URLSearchParams) => withoutStrays(params).toString();
    expect(left(new URLSearchParams('binder=9&set=10&owned=missing'))).toBe('binder=9&owned=missing');
    expect(left(new URLSearchParams('set=10&owned=missing&keyword=Ward'))).toBe('set=10&keyword=Ward');
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
