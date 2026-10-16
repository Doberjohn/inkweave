import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {BrowseSortOrder} from '../../shared/constants';
import {binderContents} from './binderCards';

/** Where the card modal opens for a card clicked in the binder, and how it resolves the rest. */
export interface ModalTarget {
  cardId: string;
  /** The modal's arrow order, with printings mapped to their base card like the opened one. */
  siblingIds: string[];
  options: {
    printingId?: string;
    resolveCard: (cardId: string) => LorcanaCard | undefined;
    /** The clicked pocket's place in `siblingIds`, which can hold a card's id more than once. */
    siblingIndex: number;
    /** Each place's own printing: a printing pocket opens on its art, a card's on Standard. */
    printingFor: (cardId: string, index: number) => string | undefined;
  };
}

/**
 * How a binder card opens in the card modal (#553 Phase C), in three tiers.
 *
 *   1. A Core card opens as it does anywhere else.
 *   2. An alternate printing of a Core card (an Enchanted, Epic or Iconic from sets
 *      9 and later) opens its BASE card on that printing, so it shows the real
 *      synergies. The chunks carry these as cards of their own; the base card
 *      lists them in `variants`, which is the link used here.
 *   3. Anything else is outside Core (sets 1-8) and opens from the collection pool,
 *      where the modal shows an "outside Core" note in place of synergies.
 *
 * `resolveCard` covers the cards `CardDataContext` cannot, for the opened card and
 * every sibling the modal's arrows reach, with the same tier-2 rule: a printing
 * resolves to its base card.
 *
 * Siblings get the same mapping, so every place opens a card the modal can show. A
 * binder holds a card and its printings as pockets of their own, so the mapped list
 * names that card once per pocket: the modal keeps its place by POSITION
 * (`siblingIndex`), and each place keeps its pocket's printing (`printingFor`), or the
 * arrows would loop back to the card's first pocket and open every printing on
 * Standard art.
 *
 * Built per click rather than per render: the two maps cost a pass over ~3,200
 * cards, which nobody should pay for a binder they are only looking at.
 */
export function collectionModalTarget(
  cardId: string,
  coreCards: readonly LorcanaCard[],
  pool: readonly LorcanaCard[],
  siblingIds: readonly string[],
): ModalTarget {
  const baseOfPrinting = new Map<string, LorcanaCard>();
  for (const card of coreCards) for (const printing of card.variants ?? []) baseOfPrinting.set(printing.id, card);
  const poolById = new Map(pool.map((card) => [card.id, card]));
  const resolveCard = (id: string) => baseOfPrinting.get(id) ?? poolById.get(id);

  const siblings = siblingIds.map((id) => baseOfPrinting.get(id)?.id ?? id);
  const printingAt = siblingIds.map((id) => (baseOfPrinting.has(id) ? id : undefined));
  const options = {
    resolveCard,
    siblingIndex: siblingIds.indexOf(cardId),
    printingFor: (_cardId: string, index: number) => printingAt[index],
  };

  const base = baseOfPrinting.get(cardId);
  if (base) return {cardId: base.id, siblingIds: siblings, options: {...options, printingId: cardId}};
  return {cardId, siblingIds: siblings, options};
}

/**
 * The card modal's target for a binder card. Its arrows follow the BINDER: its set, or
 * the whole collection (`binderContents`), in the binder's order, lit cards only.
 * The page's own list is the whole pool in its sort, which stepped from Set 1's first
 * card straight into other sets.
 */
export function binderModalTarget(
  cardId: string,
  listing: {cards: readonly LorcanaCard[]; sortOrder: BrowseSortOrder},
  binder: {coreCards: readonly LorcanaCard[]; pool: readonly LorcanaCard[]; setCode: string; sets: readonly string[]},
): ModalTarget {
  const lit = new Set(listing.cards.map((card) => card.id));
  const siblingIds = binderContents(binder.pool, binder.setCode, listing.sortOrder, binder.sets)
    .filter((card) => lit.has(card.id))
    .map((card) => card.id);
  return collectionModalTarget(cardId, binder.coreCards, binder.pool, siblingIds);
}
