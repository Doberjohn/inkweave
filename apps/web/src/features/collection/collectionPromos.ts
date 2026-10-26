import type {CardPrinting, LorcanaCard, RawCardVariant} from 'inkweave-synergy-engine';
import {printingCard, toPrinting} from '../cards/loader';
import {printedFullName} from 'inkweave-ui/lib/printings';

/*
 * Collection mode's promos (#805): every promo in the owner's catalog, as
 * `collection/promos.json` lists them (`collectionPromos` in scripts/lib/promo-printings.mjs).
 * Each is a pocket in its promo set's binder, built from the card it reprints: a Core card, or
 * a pre-Core one from the collection's chunks, which no longer carry LorcanaJSON's own promo
 * cards. So this file is the one source of a promo pocket.
 */

/** A promo as the file stores it: a variant entry, its art variant, and its card's name and id. */
export interface RawCollectionPromo extends RawCardVariant {
  /** "A" in Dreamborn's 24A/P2, for a promo printed in two arts under one number. */
  artVariant?: string;
  /** The character's name on a printing that isn't its card's: 26/P2's European "Vaiana". */
  printedName?: string;
  fullName: string;
  /** The card it reprints; absent while no dataset holds that card (Hades - Dark Usurper, of Set 15). */
  baseId?: number;
}

/** A promo as collection mode holds it: the printing as a card's `variants` hold it, and its card. */
export interface CollectionPromo extends CardPrinting {
  fullName: string;
  baseId?: string;
}

/** The file's promos, their art resolved as a card's printings' is (`toPrinting`). */
export function transformPromos(raw: readonly RawCollectionPromo[]): CollectionPromo[] {
  return raw.map((promo) => ({
    ...toPrinting(promo),
    artVariant: promo.artVariant,
    printedName: promo.printedName,
    fullName: promo.fullName,
    baseId: promo.baseId === undefined ? undefined : String(promo.baseId),
  }));
}

/** The card a promo reprints, if the pool holds it. */
const cardOf = (byId: ReadonlyMap<string, LorcanaCard>, promo: CollectionPromo) =>
  promo.baseId === undefined ? undefined : byId.get(promo.baseId);

/**
 * A promo's pocket card (`printingCard`): the card's text under the promo's id and art, in its
 * promo set ("P1" in 25/P1), and under the name printed on it where that isn't the card's
 * (owner, 2026-10-18: 26/P2's European printing reads "Vaiana - Adventurer of Land and Sea").
 */
function promoPocket(card: LorcanaCard, promo: CollectionPromo): LorcanaCard {
  const pocket = printingCard(card, promo);
  if (promo.printedName === undefined) return pocket;
  return {...pocket, name: promo.printedName, fullName: printedFullName(card, promo.printedName)};
}

/** The pool with a pocket card for each promo whose card it holds (`promoPocket`). */
export function withPromoPockets(
  pool: LorcanaCard[],
  promos: readonly CollectionPromo[],
): LorcanaCard[] {
  const byId = new Map(pool.map((card) => [card.id, card]));
  const pockets = promos.flatMap((promo) => {
    const card = cardOf(byId, promo);
    return card ? [promoPocket(card, promo)] : [];
  });
  return pockets.length > 0 ? [...pool, ...pockets] : pool;
}

/** The promos whose card the pool lacks: their pockets wait for it, named (see `promoSetPockets`). */
export function waitingPromos(
  pool: readonly LorcanaCard[],
  promos: readonly CollectionPromo[],
): CollectionPromo[] {
  const byId = new Map(pool.map((card) => [card.id, card]));
  return promos.filter((promo) => cardOf(byId, promo) === undefined);
}
