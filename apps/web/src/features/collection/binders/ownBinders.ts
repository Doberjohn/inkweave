import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {CollectionEntries} from '../collectionParser';
import type {CustomBinder, OwnBinders, OwnBindersAsk} from './binderChoices';
import {coverOf} from './binderCovers';
import {filtersCards, rulePool} from './binderRules';
import {viewOf, type BinderShelf, type Held} from './binderShelf';

/*
 * The binder code the page runs (#1074), one chunk that `useOwnBinders` loads once collection mode
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

/**
 * The reader's shelf from what the store holds (`viewOf`), and the binder `?custom=` names over
 * the whole `pool`: its cards, which the binder, the set picker and the set panel then hold and
 * count, and its cover. The import dialog keeps the whole pool.
 */
export function ownBindersOf(
  held: Held | null,
  {requested, ...reader}: OwnBindersAsk,
  pool: LorcanaCard[],
  entries: CollectionEntries,
): OwnBinders {
  const shelf = viewOf(held, reader);
  const binder = requested === null ? undefined : shelf.binders.find((one) => one.id === requested);
  if (binder === undefined) return {shelf, custom: notShown(requested, shelf), pool};
  const cards = rulePool(pool, binder);
  const custom: CustomBinder = {
    status: 'shown',
    binder,
    cover: coverOf(cards, entries, binder.coverId),
    narrowed: filtersCards(binder),
  };
  return {shelf, custom, pool: cards};
}
