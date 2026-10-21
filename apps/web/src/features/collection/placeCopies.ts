import type {LorcanaCard} from 'inkweave-synergy-engine';
import {PROMO_RARITY} from '../cards/loader';
import type {CollectionEntries, CollectionEntry, Finish} from './collectionParser';
import type {CollectionPromo} from './collectionPromos';
import {finishesOf, type FinishFacts} from './printingFinishes';

/*
 * Where each copy shows (#880). A pocket and the card window offer a counter only for the
 * finishes a printing comes in (`finishesOf`), so a copy counted in another finish would sit
 * hidden behind a counter that doesn't show. Such copies come from accounts counted before the
 * alt foils and the one-finish promos showed one counter, from a Dreamborn import, and from a
 * promo the catalog later names one finish for.
 *
 * THEY SHOW WHERE THEY BELONG, AND STAY SAVED WHERE THEY WERE COUNTED (owner, 2026-10-21): the
 * app never changes a player's saved counts on its own, so when the owner undoes a mistaken
 * correction, a player who hasn't changed that card since gets back the counts they entered.
 * The binder, the card window and the stats read the copies as shown (`placeCopies`). Only when
 * the player changes a count those copies show in is the move saved: the count as the player
 * sees it, with the copies cleared from where they were counted, so none counts twice
 * (`editAsShown`).
 *
 * A PROMO'S COPIES SHOW ON ITS TWIN when it has exactly one (owner, 2026-10-21): another
 * printing in the same promo set, of the same card, whose only finish is the missing one.
 * So a foil copy counted on 1/C3, which comes in normal alone, shows as a foil copy of 13/C3.
 * Any other copy shows in its printing's own other finish, as for the alt foils (owner,
 * 2026-10-20). The total never changes.
 */

/** What placing a printing's copies needs: the finishes it comes in, and a promo's twin group. */
interface Printed {
  finishes: readonly Finish[];
  /** A promo's promo set and card, "C3 2035": its twins share it. Absent on other printings. */
  group?: string;
}

/** Every printing the card data knows, by id, and the ids in each promo twin group. */
export interface Placements {
  printings: ReadonlyMap<string, Printed>;
  groups: ReadonlyMap<string, readonly string[]>;
}

/** No printing known: every copy shows where it was counted. */
export const NO_PLACEMENTS: Placements = {printings: new Map(), groups: new Map()};

/** One printing as the card data describes it: a card, one of a card's `variants`, or a collection promo. */
interface PrintingFacts extends FinishFacts {
  id: string;
  /** For a promo: the promo set printed on it ("C3" in 1/C3) ... */
  promoSet?: string;
  /** ... and the card it reprints. */
  cardId?: string;
}

/** A promo's twin group, or none for a printing that is no promo of a known card. */
function groupOf({rarity, promoSet, cardId}: PrintingFacts): string | undefined {
  const placed = promoSet !== undefined && cardId !== undefined;
  return rarity === PROMO_RARITY && placed ? `${promoSet} ${cardId}` : undefined;
}

/** A card's facts, and its variants': a variant's promo set is printed on it, and its card is this one. */
function cardFacts(card: LorcanaCard): PrintingFacts[] {
  const {id, rarity, finishes, setCode, baseId} = card;
  return [
    {id, rarity, finishes, promoSet: setCode, cardId: baseId},
    ...(card.variants ?? []).map((variant) => ({
      id: variant.id,
      rarity: variant.rarity,
      finishes: variant.finishes,
      promoSet: variant.promoGrouping,
      cardId: id,
    })),
  ];
}

/** Every printing of `cards` (each card and its variants) and every collection promo, as facts. */
function printingFacts(
  cards: readonly LorcanaCard[],
  promos: readonly CollectionPromo[],
): PrintingFacts[] {
  return [
    ...cards.flatMap(cardFacts),
    ...promos.map(({id, rarity, finishes, promoGrouping, baseId}) => ({
      id,
      rarity,
      finishes,
      promoSet: promoGrouping,
      cardId: baseId,
    })),
  ];
}

/**
 * What placing copies needs to know of every printing `cards` and `promos` hold: a card, each of
 * its variants, a promo of `collection/promos.json`. A printing listed twice, as a Core card's
 * promo is (one of its variants, and a collection promo), is the same printing: the first is kept.
 */
export function placementsFor(
  cards: readonly LorcanaCard[],
  promos: readonly CollectionPromo[],
): Placements {
  const printings = new Map<string, Printed>();
  const groups = new Map<string, string[]>();
  for (const facts of printingFacts(cards, promos)) {
    if (printings.has(facts.id)) continue;
    const group = groupOf(facts);
    printings.set(facts.id, {finishes: finishesOf(facts), group});
    if (group !== undefined) groups.set(group, [...(groups.get(group) ?? []), facts.id]);
  }
  return {printings, groups};
}

/** A count in one finish of one printing. */
export interface Slot {
  id: string;
  finish: Finish;
}

/** Copies shown elsewhere: `count` of them, counted in a finish their printing doesn't come in. */
interface Move {
  from: Slot;
  to: Slot;
  count: number;
}

const FINISHES: readonly Finish[] = ['normal', 'foil'];

/** Whether `printed` comes in `finish` alone: a twin for copies counted in `finish`. */
const onlyIn = (printed: Printed | undefined, finish: Finish) =>
  printed?.finishes.length === 1 && printed.finishes[0] === finish;

/** The one twin of `from`'s printing that comes in `from.finish` alone, if it has exactly one. */
function twinFor(from: Slot, printed: Printed, placements: Placements): Slot | undefined {
  if (printed.group === undefined) return undefined;
  const twins = (placements.groups.get(printed.group) ?? []).filter(
    (id) => id !== from.id && onlyIn(placements.printings.get(id), from.finish),
  );
  return twins.length === 1 ? {id: twins[0], finish: from.finish} : undefined;
}

/** Where copies counted in `from` show: on its twin, or in its printing's own other finish. */
function destination(from: Slot, printed: Printed, placements: Placements): Slot {
  return twinFor(from, printed, placements) ?? {id: from.id, finish: printed.finishes[0]};
}

/** Where one printing's copies show elsewhere: from each finish it holds copies in but doesn't come in. */
function movesFor(id: string, entry: CollectionEntry, placements: Placements): Move[] {
  const printed = placements.printings.get(id);
  if (printed === undefined) return [];
  return FINISHES.filter((finish) => entry[finish] > 0 && !printed.finishes.includes(finish)).map(
    (finish) => ({
      from: {id, finish},
      to: destination({id, finish}, printed, placements),
      count: entry[finish],
    }),
  );
}

/** Every move `entries`' copies make to show where they belong. */
const movesIn = (entries: CollectionEntries, placements: Placements) =>
  Object.entries(entries).flatMap(([id, entry]) => movesFor(id, entry, placements));

const countIn = (entries: CollectionEntries, {id, finish}: Slot) => entries[id]?.[finish] ?? 0;

const sameSlot = (a: Slot, b: Slot) => a.id === b.id && a.finish === b.finish;

/**
 * Set one slot of `entries` (mutated) to `count`. A printing left at 0 normal and 0 foil leaves
 * them, as an import never stores one (`parseCollectionCsv`).
 */
function setSlot(entries: CollectionEntries, {id, finish}: Slot, count: number): void {
  const entry = {...(entries[id] ?? {normal: 0, foil: 0}), [finish]: count};
  if (entry.normal + entry.foil === 0) delete entries[id];
  else entries[id] = entry;
}

/**
 * `entries` as shown: every copy counted in a finish its printing doesn't come in, shown where
 * it belongs. `entries` itself when none is, so its identity holds while nothing moves. A
 * printing `placements` doesn't know shows its copies as counted. Placed again, the result is
 * unchanged: every copy shows in a finish its printing comes in.
 */
export function placeCopies(entries: CollectionEntries, placements: Placements): CollectionEntries {
  const moves = movesIn(entries, placements);
  if (moves.length === 0) return entries;
  const placed = {...entries};
  for (const {from, to, count} of moves) {
    setSlot(placed, from, 0);
    setSlot(placed, to, countIn(placed, to) + count);
  }
  return placed;
}

/**
 * `entries` once the player has set the count shown in `slot` to `count`, which is what their
 * edit saves: `slot` holds `count`, and every copy shown there from another count is cleared
 * from that count, so the saved copies become what the player sees, none counted twice. Every
 * other count stays as saved, copies shown elsewhere included.
 */
export function editAsShown(
  entries: CollectionEntries,
  placements: Placements,
  slot: Slot,
  count: number,
): CollectionEntries {
  const edited = {...entries};
  for (const {from, to} of movesIn(entries, placements)) {
    if (sameSlot(to, slot)) setSlot(edited, from, 0);
  }
  setSlot(edited, slot, count);
  return edited;
}
