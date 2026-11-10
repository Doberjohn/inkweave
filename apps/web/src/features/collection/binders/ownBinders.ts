import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {CollectionEntries} from '../collectionParser';
import type {CustomBinder, OfferAsk, OwnBinders, OwnBindersAsk, SaveOffer} from './binderChoices';
import {filtersCards, rulePool, type Binder} from './binderRules';
import {viewOf, type BinderShelf, type Held} from './binderShelf';
import {coverDesign} from './coverDesigns';
import {saveOffer} from './saveRules';
import {SHELF_MAX} from './shelfWords';

/*
 * The binder code the page runs, one chunk that `useOwnBinders` loads once collection mode
 * wants your binders, and only with binders on (`flag.ts`): the store, the rules and the covers.
 */
export {follow, snapshot, subscribe} from './binderShelf';

const NONE: CustomBinder = {status: 'none'};
const LOADING: CustomBinder = {status: 'loading'};
const UNKNOWN: CustomBinder = {status: 'unknown'};

/** What a requested binder the shelf doesn't hold comes to: nothing asked, a wait, a failure, or not on the shelf. */
function notShown(requested: string | null, shelf: BinderShelf): CustomBinder {
  if (requested === null) return NONE;
  if (shelf.status === 'failed') return {status: 'failed', retry: shelf.retry};
  return shelf.status === 'ready' ? UNKNOWN : LOADING;
}

/** The open binder's cards, kept while the pool and the binder stay: a count changed inside it reruns no rule. */
let lastCards: {pool: LorcanaCard[]; binder: Binder; cards: LorcanaCard[]} | null = null;

function cardsOf(pool: LorcanaCard[], binder: Binder): LorcanaCard[] {
  if (lastCards?.pool !== pool || lastCards.binder !== binder) lastCards = {pool, binder, cards: rulePool(pool, binder)};
  return lastCards.cards;
}

/** Save as a binder, over the whole pool, once the shelf has loaded with room for one more. */
function offersOf(
  shelf: BinderShelf,
  binder: Binder | null,
  {pool, entries}: {pool: readonly LorcanaCard[]; entries: CollectionEntries},
): ((page: OfferAsk) => SaveOffer | null) | null {
  if (shelf.status !== 'ready' || shelf.binders.length >= SHELF_MAX) return null;
  return ({draft, query, scope}) => saveOffer({binder, scope, pool, entries}, draft, query);
}

/**
 * The reader's shelf from what the store holds (`viewOf`), and the binder `?custom=` names over
 * the whole `pool`: its cards, which the binder, the set picker and the set panel then hold and
 * count, and its cover's design. The import dialog keeps the whole pool.
 */
export function ownBindersOf(
  held: Held | null,
  {requested, ...reader}: OwnBindersAsk,
  pool: LorcanaCard[],
  entries: CollectionEntries,
): OwnBinders {
  const shelf = viewOf(held, reader);
  const binder = requested === null ? undefined : shelf.binders.find((one) => one.id === requested);
  if (binder === undefined) {
    // My collection offers Save as a binder; a binder asked for and not shown offers none.
    const offerOf = requested === null ? offersOf(shelf, null, {pool, entries}) : null;
    return {shelf, custom: notShown(requested, shelf), pool, offerOf};
  }
  const cards = cardsOf(pool, binder);
  const custom: CustomBinder = {
    status: 'shown',
    binder,
    cover: coverDesign(binder.cover),
    narrowed: filtersCards(binder),
  };
  return {shelf, custom, pool: cards, offerOf: offersOf(shelf, binder, {pool, entries})};
}
