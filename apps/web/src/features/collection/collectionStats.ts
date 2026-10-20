import type {Ink} from 'inkweave-synergy-engine';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {CollectionEntries} from './collectionParser';
import {binderCardsForSet} from './binderCards';
import {PROMO_RARITY} from '../cards/loader';

/**
 * Set-completion tallies for the stats panel (#553 stats spike).
 *
 * Separate from the panel because it is the part with rules in it, and rules
 * deserve tests: what counts, what "complete" and "master" mean, and how a dual-ink
 * card is attributed.
 *
 * EVERY CARD THE BINDER HOLDS COUNTS (owner, 2026-10-15), the chase printings
 * included, so the numbers always describe the cards on show: a search the binder
 * answers with 25 cards, 21 of them held, reads 21 of 25. Until then the headline and
 * the inks counted only the five rarities of Dreamborn's standard export (owner,
 * 2026-08-14), which never carries Enchanted, Epic or Iconic; those come in exports of
 * their own, by rarity, and an import of only the standard one shows them missing, as
 * the binder does. The promos count too (#805): in their promo sets, and in the whole
 * collection's numbers, which are one figure, promos and all (owner, 2026-10-17).
 */

/**
 * Whether a binder card is a printing of another card: one with a `baseId` (#796). The
 * chase printings (Epic, Enchanted, Iconic) each get a rarity row of their own under the
 * five (owner, 2026-10-12); a printing that keeps its base card's rarity (Violet Parr #247,
 * Super Rare) counts under that rarity (owner, 2026-10-16). The promos (#805) count under
 * Special, shown as Promo: a row of the whole collection's, which a promo set's numbers have
 * no need of, since all its cards are promos (see the panel).
 *
 * EVERY PRINTING THE BINDER HOLDS COMES IN ONE FINISH. Every Enchanted and Epic row of the
 * owner's own exports (2026-10-12) is a foil row, with no zero-count normal row beside it as
 * the promo export has, and LorcanaJSON lists one foil finish for every printing with a
 * `baseId` that isn't Special: all 360 chase printings and the 13 that keep their rarity (the
 * 10-10 export). So a held one is held in every finish it comes in, and counts toward master
 * too, or a finished set's master breakdown would read 0 forever. A promo is one printing in
 * one finish as well: a promo printed in both is two, twins with a pocket each (#805).
 */
const isPrinting = (card: LorcanaCard) => card.baseId !== undefined;

/** What a headline counts (owner, 2026-10-12): Complete a copy in either finish, Master one in each. */
export type Axis = 'complete' | 'master';

/** One breakdown bucket: an ink, or a rarity. Both are counted identically. */
interface Slot {
  complete: number;
  master: number;
  total: number;
}

/** What the owner holds of one card, reduced to the two questions a tally asks. */
interface Holding {
  /** At least one copy, in either finish. */
  any: boolean;
  /** At least one of BOTH finishes. */
  both: boolean;
}

interface Tally {
  /** The cards counted: every card the binder holds. */
  cards: number;
  /** Held in at least one finish. */
  complete: number;
  /** Held in BOTH finishes (a chase printing's one finish counts as both). */
  master: number;
  byInk: ({ink: Ink} & Slot)[];
  /** The rarities the cards have, Common first and the chase printings last (`RARITY_ORDER`). */
  byRarity: ({rarity: string} & Slot)[];
}

/** The running state of one `tallySet` pass. */
interface Accumulator {
  totals: Tally;
  ink: Map<Ink, Slot>;
  rarity: Map<string, Slot>;
}

/** All inks on a card — dual-ink counts toward both, matching `inkDistribution`. */
function inksOf(card: LorcanaCard): Ink[] {
  return [card.ink, card.ink2].filter((i): i is Ink => i !== undefined);
}

function holdingOf(entry: {normal: number; foil: number} | undefined): Holding {
  if (entry === undefined) return {any: false, both: false};
  return {any: entry.normal + entry.foil > 0, both: entry.normal > 0 && entry.foil > 0};
}

/** What the owner holds of one card, as every number counts it: a held printing's one finish counts as both. */
function heldOf(card: LorcanaCard, entries: CollectionEntries): Holding {
  const holding = holdingOf(entries[card.id]);
  return isPrinting(card) ? {any: holding.any, both: holding.any} : holding;
}

/**
 * Whether a card counts as held toward a headline, as its number counts it (`heldOf`): a copy
 * in either finish toward Complete, one in each toward Master. The binder's Owned and Missing
 * views ask it of the chosen headline (owner, 2026-10-20), so under Master, Missing lists a
 * card held in one finish only, as Master's number counts it, and Owned the cards it counts done.
 */
export function isHeld(card: LorcanaCard, entries: CollectionEntries, axis: Axis): boolean {
  const held = heldOf(card, entries);
  return axis === 'master' ? held.both : held.any;
}

/**
 * Fold one card into a keyed bucket. Extracted because the ink and rarity
 * breakdowns count in exactly the same way, and having that three-line increment
 * written twice inside the loop was most of what made the loop hard to read.
 */
function bump<K>(into: Map<K, Slot>, key: K, held: Holding): void {
  const slot = into.get(key) ?? {complete: 0, master: 0, total: 0};
  slot.total++;
  if (held.any) slot.complete++;
  if (held.both) slot.master++;
  into.set(key, slot);
}

/**
 * Common first, scarcest last, so the rarity rows read as a difficulty ramp: the
 * rulebook's order, and the filters' (`RARITY_ORDER` in the cards loader), the promos last.
 */
const RARITY_ORDER = [
  'Common',
  'Uncommon',
  'Rare',
  'Super Rare',
  'Legendary',
  'Epic',
  'Enchanted',
  'Iconic',
  PROMO_RARITY,
];

/**
 * Fold one card into the running tallies.
 *
 * Separate from `tallySet` so the per-card RULES (what a printing's one finish counts
 * as, how a dual-ink card is attributed) sit apart from the setup and the final sort. A
 * card of a rarity outside `RARITY_ORDER` counts everywhere but gets no row.
 */
function addCard(acc: Accumulator, card: LorcanaCard, entries: CollectionEntries): void {
  const held = heldOf(card, entries);
  const rarity = card.rarity ?? 'Unknown';

  acc.totals.cards++;
  if (held.any) acc.totals.complete++;
  if (held.both) acc.totals.master++;

  for (const i of inksOf(card)) bump(acc.ink, i, held);
  if (RARITY_ORDER.includes(rarity)) bump(acc.rarity, rarity, held);
}

export function tallySet(cards: LorcanaCard[], entries: CollectionEntries): Tally {
  const acc: Accumulator = {
    totals: {
      cards: 0,
      complete: 0,
      master: 0,
      byInk: [],
      byRarity: [],
    },
    ink: new Map(),
    rarity: new Map(),
  };

  for (const card of cards) addCard(acc, card, entries);

  acc.totals.byInk = [...acc.ink.entries()]
    .map(([ink, slot]) => ({ink, ...slot}))
    .sort((a, b) => b.total - a.total);
  acc.totals.byRarity = [...acc.rarity.entries()]
    .map(([rarity, slot]) => ({rarity, ...slot}))
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
  return acc.totals;
}

/** Done: every one of a nonzero total. A set with nothing to count is never finished. */
export const isFinished = (value: number, total: number) => total > 0 && value === total;

/**
 * Whole percent, rounded DOWN, so 100% only ever means finished (owner, 2026-10-12):
 * rounding showed Winterspell's 203 of 204 as 100%. Nothing to count reads 0%.
 */
// Times 100 before dividing: (29 / 100) * 100 is 28.999999999999996 in floating point, which
// floors to 28. Whole counts times 100 divide exactly whenever the share is a whole percent.
export const percentOf = (value: number, total: number) => (total === 0 ? 0 : Math.floor((value * 100) / total));

/**
 * The whole collection's numbers (owner, 2026-10-12): the sets' tallies summed. Its copies,
 * foils and playsets went with their row, and its sets done each way with the headlines'
 * longer counts (owner, 2026-10-15).
 */
interface CollectionTotals {
  cards: number;
  complete: number;
  master: number;
  /** Every set's breakdowns summed (owner, 2026-10-12): the Whole collection panel's. */
  byInk: Tally['byInk'];
  byRarity: Tally['byRarity'];
}

/** Add one set's breakdown into the collection's, bucket by bucket. */
function addSlots<K>(into: Map<K, Slot>, slots: readonly ({key: K} & Slot)[]): void {
  for (const {key, complete, master, total} of slots) {
    const sum = into.get(key) ?? {complete: 0, master: 0, total: 0};
    into.set(key, {complete: sum.complete + complete, master: sum.master + master, total: sum.total + total});
  }
}

/**
 * Every set's tally, in the order given (the panel's: newest first), and the whole
 * collection's totals, counted as `tallySet` counts a set. Given only the cards a
 * page's filters let through, every number describes those (owner, 2026-10-15).
 */
export function tallyCollection(cards: LorcanaCard[], entries: CollectionEntries, setCodes: readonly string[]) {
  const totals: CollectionTotals = {cards: 0, complete: 0, master: 0, byInk: [], byRarity: []};
  const ink = new Map<Ink, Slot>();
  const rarity = new Map<string, Slot>();
  const sets = setCodes.map((code) => {
    const tally = tallySet(binderCardsForSet(cards, code), entries);
    totals.cards += tally.cards;
    totals.complete += tally.complete;
    totals.master += tally.master;
    addSlots(ink, tally.byInk.map(({ink: key, ...slot}) => ({key, ...slot})));
    addSlots(rarity, tally.byRarity.map(({rarity: key, ...slot}) => ({key, ...slot})));
    return {code, tally};
  });
  totals.byInk = [...ink].map(([key, slot]) => ({ink: key, ...slot}));
  totals.byRarity = [...rarity]
    .map(([key, slot]) => ({rarity: key, ...slot}))
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
  return {totals, sets};
}

