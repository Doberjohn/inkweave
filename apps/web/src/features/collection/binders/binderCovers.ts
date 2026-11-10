import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {CollectionEntries} from '../collectionParser';
import {WHOLE_COLLECTION, binderSets} from '../binderCards';
import {scopeTally, tallyCollection} from '../collectionStats';
import {rulePool, type Binder} from './binderRules';
import {coverDesign, type CoverDesign} from './coverDesigns';

/** What a binder's cover reads: its headlines' counts, and how many cards it holds. */
export interface BinderFigures {
  complete: number;
  master: number;
  cards: number;
}

/** The cards a binder holds: its rules' over the pool, or for My collection (null) the whole pool. */
const cardsOf = (pool: readonly LorcanaCard[], binder: Binder | null) =>
  binder === null ? [...pool] : rulePool(pool, binder);

/** What a binder's cover shows: its design, and its numbers. */
export interface BinderFace {
  cover: CoverDesign;
  figures: BinderFigures;
}

/**
 * A binder's cover design and its numbers, from one pass of its rules over the pool. My
 * collection (null) holds the whole pool, under the design its shelf row names (`myCover`).
 */
export function binderFace(
  pool: readonly LorcanaCard[],
  entries: CollectionEntries,
  binder: Binder | null,
  myCover: string | null = null,
): BinderFace {
  return {cover: coverDesign(binder === null ? myCover : binder.cover), figures: binderFigures(pool, entries, binder)};
}

/** A binder's numbers alone, for a caller that draws its design before the pool is in. */
export function binderFigures(pool: readonly LorcanaCard[], entries: CollectionEntries, binder: Binder | null): BinderFigures {
  return figuresOf(cardsOf(pool, binder), entries, binder?.scope ?? WHOLE_COLLECTION);
}

/**
 * A binder's numbers, counted as the set panel counts them with that binder open at its own
 * Sets and no filter on (`tallyCollection` over its cards, then `scopeTally`), so a cover and
 * the panel always agree.
 */
export function figuresOf(cards: LorcanaCard[], entries: CollectionEntries, scope: string): BinderFigures {
  const tally = scopeTally(tallyCollection(cards, entries, binderSets(cards)), scope);
  return {complete: tally?.complete ?? 0, master: tally?.master ?? 0, cards: tally?.cards ?? 0};
}
