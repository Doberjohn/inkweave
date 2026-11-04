import type {LorcanaCard} from 'inkweave-synergy-engine';
import {PROMO_RARITY, latestSetFirst} from '../../cards/loader';
import {binderSetOf} from '../../../shared/constants';
import type {CollectionEntries} from '../collectionParser';
import {WHOLE_COLLECTION, binderSets} from '../binderCards';
import {isHeld, scopeTally, tallyCollection} from '../collectionStats';
import {rulePool, type Binder} from './binderRules';

/** What a binder's cover reads: its headlines' counts, and how many cards it holds. */
export interface BinderFigures {
  complete: number;
  master: number;
  cards: number;
}

/** The cards a binder holds: its rules' over the pool, or for My collection (null) the whole pool. */
export const cardsOf = (pool: readonly LorcanaCard[], binder: Binder | null) =>
  binder === null ? [...pool] : rulePool(pool, binder);

/** What a binder's cover shows: its card, and its numbers. */
export interface BinderFace {
  cover: LorcanaCard | null;
  figures: BinderFigures;
}

/**
 * A binder's cover card (`coverOf`) and its numbers, from one pass of its rules over the pool. My
 * collection (null) holds the whole pool, under the cover its shelf picked (`shelfCover`).
 */
export function binderFace(
  pool: readonly LorcanaCard[],
  entries: CollectionEntries,
  binder: Binder | null,
  shelfCover: string | null = null,
): BinderFace {
  return faceOf(cardsOf(pool, binder), entries, binder ?? {scope: WHOLE_COLLECTION, coverId: shelfCover});
}

/** A face from the cards a binder holds already: the New binder window's, whose cards it shows too. */
export function faceOf(
  cards: LorcanaCard[],
  entries: CollectionEntries,
  {scope, coverId}: Pick<Binder, 'scope' | 'coverId'>,
): BinderFace {
  return {cover: coverOf(cards, entries, coverId), figures: figuresOf(cards, entries, scope)};
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

/** The cover's pick, rarest first: the chase printings, then a promo, then the five, scarcest first. */
const COVER_RARITIES = [
  'Iconic',
  'Enchanted',
  'Epic',
  PROMO_RARITY,
  'Legendary',
  'Super Rare',
  'Rare',
  'Uncommon',
  'Common',
];

/** A card's place in the cover's pick: a rarity outside the list after every one in it. */
function rarityRank(card: LorcanaCard): number {
  const rank = COVER_RARITIES.indexOf(card.rarity ?? '');
  return rank === -1 ? COVER_RARITIES.length : rank;
}

/** Two cards in the cover's order: the rarer first, then the newer set, then the lower collector number. */
function coverOrder(a: LorcanaCard, b: LorcanaCard): number {
  return (
    rarityRank(a) - rarityRank(b) ||
    latestSetFirst(binderSetOf(a.setCode ?? ''), binderSetOf(b.setCode ?? '')) ||
    (a.setNumber ?? Number.MAX_SAFE_INTEGER) - (b.setNumber ?? Number.MAX_SAFE_INTEGER)
  );
}

/**
 * The card on a binder's cover, from the cards it holds: the one its `coverId` names while the
 * binder still holds it, else the rarest card it holds that the collection holds a copy of
 * (`isHeld` under Complete), in `coverOrder`. Null when it holds none of yours.
 */
export function coverOf(
  cards: readonly LorcanaCard[],
  entries: CollectionEntries,
  coverId: string | null,
): LorcanaCard | null {
  const named = coverId === null ? undefined : cards.find((card) => card.id === coverId);
  if (named !== undefined) return named;
  let best: LorcanaCard | null = null;
  for (const card of cards) {
    if (!isHeld(card, entries, 'complete')) continue;
    if (best === null || coverOrder(card, best) < 0) best = card;
  }
  return best;
}

/** The cards Change cover offers: those the binder holds that the collection holds a copy of, in `coverOf`'s order. */
export function coverChoices(cards: readonly LorcanaCard[], entries: CollectionEntries): LorcanaCard[] {
  return cards.filter((card) => isHeld(card, entries, 'complete')).sort(coverOrder);
}
