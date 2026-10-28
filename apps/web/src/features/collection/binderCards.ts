import type {LorcanaCard} from 'inkweave-synergy-engine';
import {
  PROMO_RARITY,
  applySortOrder,
  collectorOrder,
  editionThenCollectorOrder,
  getUniqueRarities,
  latestSetFirst,
  printingCard,
} from '../cards/loader';
import {
  BROWSE_SORT_OPTIONS,
  SET_NAMES,
  binderSetOf,
  printedCodesOf,
  promoEditionOf,
  promoSetOf,
  type BrowseSortOrder,
  type SetCode,
} from '../../shared/constants';
import {RARITY_PARAM, SET_PARAM} from '../../shared/hooks/useFilterParams';
import type {CollectionPromo} from './collectionPromos';

/**
 * THE MODE LIVES IN THE URL (owner, 2026-10-07): `?binder=<set>` present means
 * collection mode, so it survives a trip to `/account` to re-import, a card page,
 * a reload and a shared link. `binder`, not `set`: the filter params already own
 * `set`, so reusing it would also apply a set FILTER and put a chip in the toolbar.
 * `?binder=all` is the whole collection in one binder (owner, 2026-10-12), and
 * `?binder=promos` every promo set (owner, 2026-10-20).
 */
export const BINDER_PARAM = 'binder';

/** What the binder shows (owner, 2026-10-12): `?owned=owned|missing`, absent for every card. */
export const OWNED_PARAM = 'owned';

/**
 * Whose binder shows: `?friend=<handle>` names a friend who shares their collection,
 * read only. By handle, not id, so the address reads the same for both friends.
 */
export const FRIEND_PARAM = 'friend';

/** The params collection mode never keeps: a set filter, since its panel picks the set. */
const INSIDE_STRAYS = [SET_PARAM];
/** And a binder of promos alone: a rarity filter too, since every card in it is a promo. */
const PROMO_STRAYS = [SET_PARAM, RARITY_PARAM];
/** The params the grid never keeps: the binder's view and whose binder, since the grid has no collection to view. */
const OUTSIDE_STRAYS = [OWNED_PARAM, FRIEND_PARAM];

/** The strays of a binder scope, or of the grid's (`null`, no binder). */
function straysOf(binder: string | null): readonly string[] {
  if (binder === null) return OUTSIDE_STRAYS;
  return isPromoScope(binder) ? PROMO_STRAYS : INSIDE_STRAYS;
}

/**
 * The params a URL holds that its mode never keeps (owner, 2026-10-12): in collection
 * mode a set filter, outside it the binder's view. A binder of promos alone, one promo set
 * or every one, drops a rarity filter too (owner, 2026-10-20), and the filters panel its
 * Rarity section: the filter would pick from one rarity, and hidden it could only empty
 * the binder out of sight.
 */
export function strayParams(params: URLSearchParams): string[] {
  return straysOf(params.get(BINDER_PARAM)).filter((param) => params.has(param));
}

/** The URL less the params its mode never keeps (`strayParams`). */
export function withoutStrays(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const param of strayParams(params)) next.delete(param);
  return next;
}

/**
 * Whether the page's Rarity filter picks the promos, alone or beside other rarities (owner,
 * 2026-10-20): the set picker then opens the whole collection's menu on its Promo tab.
 */
export const rarityPicksPromos = (params: URLSearchParams) =>
  (params.get(RARITY_PARAM) ?? '').split(',').includes(PROMO_RARITY);

/** Whether a binder set is a promo set (#805), which goes by its code ("P1") rather than a number. */
export const isPromoSet = (setCode: string) => promoSetOf(setCode) !== undefined;

/** A promo set's name, and an edition's after its set's: "Curator's Collection: Heroines Edition". */
function promoSetName(setCode: string): string | undefined {
  const edition = promoEditionOf(setCode);
  const name = promoSetOf(setCode)?.name;
  return edition === undefined ? name : `${name}: ${edition.name}`;
}

/** The name a set goes by in the binder's controls: its own, a promo set's, or its number while it has none. */
export const setName = (setCode: string) =>
  SET_NAMES[setCode as SetCode] ?? promoSetName(setCode) ?? `Set ${setCode}`;

/** A set as it is spoken and named on hover: "Set 11, Winterspell", or "Promo set P1, Promo Set 1". */
export const setLabel = (setCode: string) =>
  `${isPromoSet(setCode) ? 'Promo set' : 'Set'} ${setCode}, ${setName(setCode)}`;

/**
 * What the binder shows (owner, 2026-10-12): every card, the ones you hold, or the ones
 * you don't, toward the headline chosen beside it (owner, 2026-10-20): under Master set, a
 * card held in one finish only is missing, unless that is the one finish it comes in
 * (`isHeld`, #880). A view of the binder chosen in the collection panel, not one of the page's
 * filters: the toolbar's Filters count and Clear all leave it be. On a phone it is chosen in the
 * Binder sheet with the filters: the binder row's Filters counts it in its badge, Owned or
 * Missing as one, and the sheet's Clear all puts back All.
 */
export type BinderShow = 'all' | 'owned' | 'missing' | 'you-need' | 'they-need';

/**
 * The views a friend's binder adds: the cards they hold in a finish you lack (You
 * need), and the ones you hold in a finish they lack (They need).
 */
export const COMPARE_SHOWS: readonly BinderShow[] = ['you-need', 'they-need'];

const OWN_SHOWS: readonly BinderShow[] = ['owned', 'missing'];

/**
 * The binder view a link asks for: `owned` or `missing`, and with a friend's binder open
 * `you-need` or `they-need`; anything else is `all`.
 */
export function parseBinderShow(raw: string | null, hasFriend = false): BinderShow {
  const known = OWN_SHOWS.find((show) => show === raw) ?? (hasFriend ? COMPARE_SHOWS.find((show) => show === raw) : undefined);
  return known ?? 'all';
}

/**
 * Writes what the binder shows into `params`, All by leaving the param out: the set panel's
 * press, and the Binder sheet's Apply (#969), which writes it with the filters in one write.
 */
export function writeShowParam(params: URLSearchParams, show: BinderShow): void {
  if (show === 'all') params.delete(OWNED_PARAM);
  else params.set(OWNED_PARAM, show);
}

/**
 * The set collection mode opens on from a Browse set filter (owner, 2026-10-12): the
 * newest set the filter names that the binder can show (any it names, until that list
 * is known), or undefined. `raw` is the filter's param, comma-separated set codes.
 */
export function setFromFilter(raw: string | null, sets: readonly string[] | null): string | undefined {
  const codes = raw ? raw.split(',').filter((code) => sets === null || sets.includes(code)) : [];
  return codes.sort((a, b) => Number(b) - Number(a))[0];
}

/**
 * The pool with a card of its own for every printing it lacks, so each Enchanted, Epic
 * and Iconic has a pocket. The collection chunks carry the printings of the sets they
 * cover as cards with their own collector numbers; a set with no chunk (the reveal
 * season's preview set, 2026-10-12: Set 14's 38) has them only as its base cards'
 * `variants`, and its binder had no pocket for any of them, so a rarity filter for
 * them found nothing.
 *
 * Built from the base card (`printingCard`), naming it as its `baseId`, as a chunk's
 * printing does (#796). Not for a promo: collection mode's promos come from its own list,
 * every promo in the owner's catalog, in its promo set (`withPromoPockets`, #805).
 */
export function withPrintingCards(pool: LorcanaCard[]): LorcanaCard[] {
  const held = new Set(pool.map((card) => card.id));
  const printings: LorcanaCard[] = [];
  for (const card of pool) {
    for (const printing of card.variants ?? []) {
      if (held.has(printing.id) || printing.rarity === PROMO_RARITY) continue;
      held.add(printing.id);
      printings.push(printingCard(card, printing));
    }
  }
  return printings.length > 0 ? [...pool, ...printings] : pool;
}

/**
 * The Rarity filter's options in collection mode: the rarities of the cards the
 * binder holds. The Enchanted, Epic and Iconic printings are pockets of their own,
 * and so are the promos (#805), so their rarities are offered.
 */
export function binderRarities(pool: readonly LorcanaCard[]): string[] {
  return getUniqueRarities(pool);
}

/**
 * One set's cards as the binder needs them, in collector order (`collectorOrder`): by
 * number, and a promo set's twins foil first. A promo set that gathers editions holds each
 * edition's cards in turn, oldest first (`editionThenCollectorOrder`).
 *
 * THE SORT IS LOAD-BEARING: the chunks arrive unsorted, so rendering one straight
 * would put cards in arbitrary positions. Set 1 holds 216 = exactly 9 spreads of 24.
 * The chunks hold no promo cards (#805), which reused base collector numbers and once
 * had to be dropped here: a promo's card is in its promo set.
 *
 * Its own module, not inside `CollectionBinder`, so Browse can order the card
 * modal's siblings by it without importing the binder's lazy chunk.
 */
export function binderCardsForSet(cards: readonly LorcanaCard[], setCode: string): LorcanaCard[] {
  const codes = printedCodesOf(setCode);
  return cards
    .filter((card) => card.setCode !== undefined && codes.includes(card.setCode))
    .sort(editionThenCollectorOrder);
}

/**
 * The sets the binder holds, newest first: the set picker's order. The promo sets follow the
 * numbered ones (owner, 2026-10-17), newest first by release too (`latestSetFirst`), and a
 * promo set's editions are one set (owner, 2026-10-18: Curator's Collection).
 */
export function binderSets(pool: readonly LorcanaCard[]): string[] {
  const codes = new Set<string>();
  for (const card of pool) if (card.setCode) codes.add(binderSetOf(card.setCode));
  return [...codes].sort(latestSetFirst);
}

/**
 * One set's binder in the page's sort order (owner, 2026-10-08). The pockets fill in
 * that order. Browse's default, Newest first, sorts by set and then collector number,
 * so within one set it IS collector order, and the binder opens laid out like a real
 * one. Ties keep collector order (the sort is stable).
 */
export function binderOrder(cards: readonly LorcanaCard[], setCode: string, sortOrder: BrowseSortOrder): LorcanaCard[] {
  return applySortOrder(binderCardsForSet(cards, setCode), sortOrder);
}

/**
 * The binder's scope for every set at once (owner, 2026-10-12): `?binder=all`, All sets
 * in the set picker's Standard sets tab. Every other scope is a set code, or `ALL_PROMO_SETS`.
 */
export const WHOLE_COLLECTION = 'all';

/**
 * The binder's scope for every promo set at once (owner, 2026-10-20): `?binder=promos`, All
 * sets in the set picker's Promo tab. It goes set by set, as the whole collection does.
 */
export const ALL_PROMO_SETS = 'promos';

/** Whether a scope spans sets, the whole collection or every promo set, rather than being one. */
export const spansSets = (scope: string) => scope === WHOLE_COLLECTION || scope === ALL_PROMO_SETS;

/** Whether a scope holds promos alone: one promo set, or every one. */
export const isPromoScope = (scope: string) => scope === ALL_PROMO_SETS || isPromoSet(scope);

/** The sets a scope spans, in the order given: every one, the promo sets, or the one set. */
export function scopeSets(scope: string, sets: readonly string[]): readonly string[] {
  if (scope === WHOLE_COLLECTION) return sets;
  return scope === ALL_PROMO_SETS ? sets.filter(isPromoSet) : [scope];
}

/** What the binder's controls call a scope: "Whole collection", "All promo sets", or the set's name. */
export function scopeName(scope: string): string {
  if (scope === WHOLE_COLLECTION) return 'Whole collection';
  return scope === ALL_PROMO_SETS ? 'All promo sets' : setName(scope);
}

/** Whether the binder goes set by set, each set a stretch of its own: a scope spanning sets, in collector order. */
export const goesSetBySet = (scope: string, sortOrder: BrowseSortOrder) => spansSets(scope) && sortOrder === 'newest';

/**
 * Whether the spread map names the stretches the binder holds, in collector order: the sets of
 * a scope spanning them, or a promo set's editions (owner, 2026-10-18: Curator's Collection).
 */
export const namesStretches = (scope: string, sortOrder: BrowseSortOrder) =>
  sortOrder === 'newest' && (spansSets(scope) || printedCodesOf(scope).length > 1);

/**
 * The binder's cards in order, before the page's filters (owner, 2026-10-12):
 *
 *   - One set: that set, in the page's sort (`binderOrder`).
 *   - The whole collection in collector order: each set in turn, newest first, so it
 *     reads like a shelf of one binder per set. `sets` is that order. Each set continues
 *     where the one before ends: a fresh spread for every set left nearly empty spreads
 *     at each set's end.
 *   - The whole collection in any other sort: ONE list across every set, so Name A-Z puts
 *     every Elsa together instead of starting over at A in each of fourteen sets.
 *   - All promo sets (owner, 2026-10-20): the whole collection's way, over the promo sets.
 *
 * The binder holds the cards among these that the page lets through, packed, and the card
 * modal's arrows step through the same ones, so the two never disagree.
 */
export function binderContents(
  cards: readonly LorcanaCard[],
  scope: string,
  sortOrder: BrowseSortOrder,
  sets: readonly string[],
): LorcanaCard[] {
  if (scope === WHOLE_COLLECTION && !goesSetBySet(scope, sortOrder)) return applySortOrder([...cards], sortOrder);
  if (!spansSets(scope)) return binderOrder(cards, scope, sortOrder);
  const inTurn = scopeSets(scope, sets).flatMap((set) => binderCardsForSet(cards, set));
  return goesSetBySet(scope, sortOrder) ? inTurn : applySortOrder(inTurn, sortOrder);
}

/**
 * A pocket with no card in it (#805): in a promo set, a number nobody has listed yet, or a
 * promo whose card no dataset holds yet, named (`fullName`), with the facts that place it.
 */
export interface OpenPocket {
  open: true;
  setCode: string;
  setNumber?: number;
  /** A waiting promo's id and card. */
  id?: string;
  fullName?: string;
  finish?: LorcanaCard['finish'];
  artVariant?: string;
  /** A waiting promo's art, resolved as a printing's is (`toPrinting`): its scan shows before its card is out. */
  imageUrl?: string;
  imageHashSm?: string;
  /** A number its promo set never released where the collection is kept (`PromoSet.unreleased`). */
  unreleased?: true;
  /** A number its promo set has still to release (`PromoSet.upcoming`). */
  upcoming?: true;
}

/** A pocket of the binder: a card, or an open pocket. */
export type BinderSlot = LorcanaCard | OpenPocket;

export const isOpenPocket = (slot: BinderSlot): slot is OpenPocket => 'open' in slot;

/** What tells a pocket from every other: its card's id, a waiting promo's, or its place. */
export const slotKey = (slot: BinderSlot) =>
  isOpenPocket(slot) ? (slot.id ?? `${slot.setCode}#${slot.setNumber}`) : slot.id;

/** A waiting promo's pocket: its place, its card's name and its art, with no card in it. */
const waitingPocket = (promo: CollectionPromo): OpenPocket => ({
  open: true,
  setCode: promo.promoGrouping ?? '',
  setNumber: promo.number,
  id: promo.id,
  fullName: promo.fullName,
  finish: promo.finish,
  artVariant: promo.artVariant,
  imageUrl: promo.imageUrl,
  imageHashSm: promo.imageHashSm,
});

/** The open pocket at a number with no promo known: never released there, still to come, or not listed yet. */
function gapPocket(setCode: string, setNumber: number): OpenPocket {
  const set = promoSetOf(setCode);
  if (set?.unreleased?.includes(setNumber)) return {open: true, setCode, setNumber, unreleased: true};
  if (set?.upcoming?.includes(setNumber)) return {open: true, setCode, setNumber, upcoming: true};
  return {open: true, setCode, setNumber};
}

/**
 * A promo set's pockets laid out like a real binder (owner, 2026-10-17, layout 1 of
 * `public/mockups/collection-promos.html`): a pocket per number up to the highest known, a
 * promo each, so twins take one each, foil first; a number nobody has listed yet left open,
 * as is one the set never released here, and a promo whose card is not out named in its open
 * pocket. The promos with no number come last. So a pocket never moves when the catalog learns
 * a number. A set that gathers editions lays out each edition's in turn, oldest first,
 * numbered as printed (owner, 2026-10-18: Curator's Collection's Heroines, then Beauty and
 * the Beast).
 *
 * `cards` are the set's cards, `waiting` the promos whose card no dataset holds yet.
 */
export function promoSetPockets(
  cards: readonly LorcanaCard[],
  waiting: readonly CollectionPromo[],
  setCode: string,
): BinderSlot[] {
  return printedCodesOf(setCode).flatMap((code) =>
    codePockets(
      cards.filter((card) => card.setCode === code),
      waiting.filter((promo) => promo.promoGrouping === code),
      code,
    ),
  );
}

/** The pockets of the promos printed with one code, as `promoSetPockets` lays them out. */
function codePockets(cards: readonly LorcanaCard[], waiting: readonly CollectionPromo[], code: string): BinderSlot[] {
  const pockets: BinderSlot[] = [...cards, ...waiting.map(waitingPocket)].sort(collectorOrder);
  const numbers = pockets.flatMap((pocket) => (pocket.setNumber === undefined ? [] : [pocket.setNumber]));
  const slots: BinderSlot[] = [];
  for (let n = Math.min(1, ...numbers); n <= Math.max(0, ...numbers); n++) {
    const at = pockets.filter((pocket) => pocket.setNumber === n);
    slots.push(...(at.length > 0 ? at : [gapPocket(code, n)]));
  }
  return [...slots, ...pockets.filter((pocket) => pocket.setNumber === undefined)];
}

/** What the binder holds besides its cards, and whether it holds only those. */
interface SlotContext {
  scope: string;
  sets: readonly string[];
  sortOrder: BrowseSortOrder;
  /** The page's filters or search are on, or the binder shows only owned or only missing cards. */
  narrowed: boolean;
  waiting: readonly CollectionPromo[];
}

/**
 * The binder's pockets: its cards (`binderContents`, less what the page's filters leave out),
 * and, laid out in collector order with nothing narrowing them, each promo set's open pockets
 * too (`promoSetPockets`), its own binder's or its stretch of a scope spanning sets. A narrowed
 * binder packs its cards, as the grid does: a numbered gap means nothing among the cards a
 * search found.
 */
export function binderSlots(
  shown: readonly LorcanaCard[],
  {scope, sets, sortOrder, narrowed, waiting}: SlotContext,
): BinderSlot[] {
  if (narrowed || sortOrder !== 'newest') return [...shown];
  return scopeSets(scope, sets).flatMap((set) => {
    const codes = printedCodesOf(set);
    const cards = shown.filter((card) => card.setCode !== undefined && codes.includes(card.setCode));
    return isPromoSet(set) ? promoSetPockets(cards, waiting, set) : cards;
  });
}

/**
 * The sort's options while the binder shows: Browse's own, but the default is named
 * for what it does in a single set's binder.
 */
export const BINDER_SORT_OPTIONS: typeof BROWSE_SORT_OPTIONS = BROWSE_SORT_OPTIONS.map((option) =>
  option.value === 'newest' ? {...option, label: 'Collector number', mobileLabel: 'Collector #'} : option,
);
