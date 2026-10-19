import type {LorcanaCard} from 'inkweave-synergy-engine';
import {BINDER_CARDS} from '../cards/components/binderStoryCards';
import {isChaseRarity} from '../cards/loader';
import type {CollectionEntries, CollectionEntry} from './collectionParser';
import type {CollectionPromo} from './collectionPromos';
import {tallyCollection} from './collectionStats';

/**
 * Story-only fixture for the collection panel: Set 9's fixture cards copied under six set
 * codes, newest first, each held in its own way, so the set list shows every state a
 * row can be in. A `.ts` file, so the story-coverage gate skips it.
 */
export const STORY_SETS = ['14', '13', '12', '11', '10', '9'];

/** How each set is held, by card position: none, a third, all, all but one, all in both finishes, mixed. */
const HOLDING: Record<string, (i: number) => CollectionEntry> = {
  '14': () => ({normal: 0, foil: 0}),
  '13': (i) => ({normal: i % 3 === 0 ? 1 : 0, foil: 0}),
  '12': (i) => ({normal: 2, foil: i % 2}),
  '11': (i) => ({normal: i === 0 ? 0 : 4, foil: 0}),
  '10': () => ({normal: 1, foil: 1}),
  '9': (i) => ({normal: i % 3 === 0 ? 2 : i % 2, foil: i % 5 === 0 ? 1 : 0}),
};

/**
 * A rarity per card position, a real set's mix in small with the chase printings last, so
 * the rarity breakdown shows all eight rows. The story cards are all Common on their own.
 */
const RARITY_MIX: string[] = [
  ...Array<string>(8).fill('Common'),
  ...Array<string>(6).fill('Uncommon'),
  ...Array<string>(5).fill('Rare'),
  'Super Rare',
  'Super Rare',
  'Legendary',
  'Epic',
  'Epic',
  'Enchanted',
  'Iconic',
];

/** A chase printing names a card it reprints, as every one in the data does (#796): one finish counts as both. */
export const STORY_POOL: LorcanaCard[] = STORY_SETS.flatMap((code) =>
  BINDER_CARDS.map((card, i) => {
    const rarity = RARITY_MIX[i % RARITY_MIX.length];
    return {
      ...card,
      id: `${code}-${card.id}`,
      setCode: code,
      rarity,
      ...(isChaseRarity(rarity) ? {baseId: `${code}-${BINDER_CARDS[0].id}`} : {}),
    };
  }),
);

export const STORY_ENTRIES: CollectionEntries = Object.fromEntries(
  STORY_SETS.flatMap((code) => BINDER_CARDS.map((card, i) => [`${code}-${card.id}`, HOLDING[code](i)])),
);

export const STORY_STATS = tallyCollection(STORY_POOL, STORY_ENTRIES, STORY_SETS);

/** A search for "Stitch": the panel's numbers count only each set's three Stitches. */
export const STORY_STITCH_STATS = tallyCollection(
  STORY_POOL.filter((card) => card.name === 'Stitch'),
  STORY_ENTRIES,
  STORY_SETS,
);

/** The promo set the promo stories show (#805), after the sets as the picker lists it. */
export const STORY_PROMO_SET = 'C1';

/** A promo's card in the story's promo set, as `printingCard` builds one from its card. */
const storyPromo = (card: LorcanaCard, setNumber: number | undefined, finish?: LorcanaCard['finish']): LorcanaCard => ({
  ...card,
  id: `${STORY_PROMO_SET}-${setNumber ?? 'x'}${finish ?? ''}`,
  baseId: card.id,
  rarity: 'Special',
  setCode: STORY_PROMO_SET,
  setNumber,
  finish,
});

/**
 * A promo set in small: a promo each at 1, 2, 5 and 7, twins at 3, foil and non-foil, none
 * listed at 4, a promo whose card is not out at 6 (`STORY_WAITING`), and one with no number.
 */
export const STORY_PROMO_CARDS: LorcanaCard[] = [
  storyPromo(BINDER_CARDS[3], 1),
  storyPromo(BINDER_CARDS[13], 2),
  storyPromo(BINDER_CARDS[9], 3, 'foil'),
  storyPromo(BINDER_CARDS[9], 3, 'normal'),
  storyPromo(BINDER_CARDS[5], 5),
  storyPromo(BINDER_CARDS[20], 7),
  storyPromo(BINDER_CARDS[1], undefined),
];

/** The story set's promo whose card no dataset holds yet. */
export const STORY_WAITING: CollectionPromo[] = [
  {id: '80033', rarity: 'Special', number: 6, promoGrouping: STORY_PROMO_SET, fullName: 'Hades - Dark Usurper'},
];

/** Half the promos held, the non-foil twin among them. */
export const STORY_PROMO_ENTRIES: CollectionEntries = Object.fromEntries(
  STORY_PROMO_CARDS.map((card, i) => [card.id, {normal: i % 2 === 1 ? 1 : 0, foil: 0}]),
);

/** The sets with the promo set after them, as the picker lists them. */
export const STORY_SETS_WITH_PROMOS = [...STORY_SETS, STORY_PROMO_SET];

/** The panel's numbers over the sets and the promo set. */
export const STORY_PROMO_STATS = tallyCollection(
  [...STORY_POOL, ...STORY_PROMO_CARDS],
  {...STORY_ENTRIES, ...STORY_PROMO_ENTRIES},
  STORY_SETS_WITH_PROMOS,
);
