import type {LorcanaCard} from 'inkweave-synergy-engine';
import {applySortOrder, getUniqueRarities} from '../cards/loader';
import {BROWSE_SORT_OPTIONS, SET_NAMES, type BrowseSortOrder, type SetCode} from '../../shared/constants';
import {SET_PARAM} from '../../shared/hooks/useFilterParams';

/**
 * THE MODE LIVES IN THE URL (owner, 2026-10-07): `?binder=<set>` present means
 * collection mode, so it survives a trip to `/account` to re-import, a card page,
 * a reload and a shared link. `binder`, not `set`: the filter params already own
 * `set`, so reusing it would also apply a set FILTER and put a chip in the toolbar.
 * `?binder=all` is the whole collection in one binder (owner, 2026-10-12).
 */
export const BINDER_PARAM = 'binder';

/** What the binder shows (owner, 2026-10-12): `?owned=owned|missing`, absent for every card. */
export const OWNED_PARAM = 'owned';

/** The params collection mode never keeps: a set filter, since its panel picks the set. */
const INSIDE_STRAYS = [SET_PARAM];
/** The params the grid never keeps: the binder's view, since the grid has no collection to view. */
const OUTSIDE_STRAYS = [OWNED_PARAM];

/**
 * The params a URL holds that its mode never keeps (owner, 2026-10-12): in collection
 * mode a set filter, outside it the binder's view.
 */
export function strayParams(params: URLSearchParams): string[] {
  const strays = params.has(BINDER_PARAM) ? INSIDE_STRAYS : OUTSIDE_STRAYS;
  return strays.filter((param) => params.has(param));
}

/** The URL less the params its mode never keeps (`strayParams`). */
export function withoutStrays(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const param of strayParams(params)) next.delete(param);
  return next;
}

/** The name a set goes by in the binder's controls: its own, or its number while it has none. */
export const setName = (setCode: string) => SET_NAMES[setCode as SetCode] ?? `Set ${setCode}`;

/**
 * What the binder shows (owner, 2026-10-12): every card, the ones you hold a copy of,
 * or the ones you hold none of. A view of the binder chosen in the collection panel,
 * not one of the page's filters: the Filters count and Clear all leave it be.
 */
export type BinderShow = 'all' | 'owned' | 'missing';

/** The binder view a link asks for: anything but `owned` or `missing` is `all`. */
export function parseBinderShow(raw: string | null): BinderShow {
  return raw === 'owned' || raw === 'missing' ? raw : 'all';
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

/** Whether the binder holds a card: every card but the Special promos (see below). */
export function isBinderCard(card: LorcanaCard): boolean {
  return card.rarity !== 'Special';
}

/**
 * The pool with a card of its own for every printing it lacks, so each Enchanted, Epic
 * and Iconic has a pocket. The collection chunks carry the printings of the sets they
 * cover as cards with their own collector numbers; a set with no chunk (the reveal
 * season's preview set, 2026-10-12: Set 14's 38) has them only as its base cards'
 * `variants`, and its binder had no pocket for any of them, so a rarity filter for
 * them found nothing.
 *
 * Built from the base card, under the printing's own id, rarity, number and art. The
 * full-size image hash is the base card's art, so it is dropped rather than carried.
 */
export function withPrintingCards(pool: LorcanaCard[]): LorcanaCard[] {
  const held = new Set(pool.map((card) => card.id));
  const printings: LorcanaCard[] = [];
  for (const card of pool) {
    for (const printing of card.variants ?? []) {
      if (held.has(printing.id)) continue;
      held.add(printing.id);
      printings.push({
        ...card,
        id: printing.id,
        rarity: printing.rarity,
        setNumber: printing.number,
        imageUrl: printing.imageUrl,
        imageHash: undefined,
        imageHashSm: printing.imageHashSm,
        scanLanguage: printing.scanLanguage,
        variants: undefined,
      });
    }
  }
  return printings.length > 0 ? [...pool, ...printings] : pool;
}

/**
 * The Rarity filter's options in collection mode: the rarities of the cards the
 * binder holds. The Enchanted, Epic and Iconic printings are slots of their own,
 * so they are offered; Special never is, since a Special chip would veil every
 * slot.
 */
export function binderRarities(pool: readonly LorcanaCard[]): string[] {
  return getUniqueRarities(pool.filter(isBinderCard));
}

/**
 * One set's cards as the binder needs them: Special promos dropped, collector
 * order imposed.
 *
 * BOTH STEPS ARE LOAD-BEARING and neither is free from the chunk. The chunks
 * carry Special rarity (28 of Set 1's 244) and arrive unsorted, so rendering one
 * straight would put cards in arbitrary positions and stack five of them on slot
 * #1. Dropping Special leaves Set 1 at 216 = exactly 9 spreads of 24.
 *
 * This lives apart from the loader because the exclusion is the BINDER's
 * requirement: a Special card is genuinely ownable, and the Browse grid should
 * still show it. Only fixed positions need the promos gone.
 *
 * Its own module, not inside `CollectionBinder`, so Browse can order the card
 * modal's siblings by it without importing the binder's lazy chunk.
 */
export function binderCardsForSet(cards: readonly LorcanaCard[], setCode: string): LorcanaCard[] {
  return cards
    .filter((card) => card.setCode === setCode && isBinderCard(card))
    .sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0));
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
 * The binder's scope for every set at once (owner, 2026-10-12): `?binder=all`, pinned
 * first in the set picker. Every other scope is a set code.
 */
export const WHOLE_COLLECTION = 'all';

/** Whether the binder goes set by set, each set a stretch of its own: the whole collection in collector order. */
export const goesSetBySet = (scope: string, sortOrder: BrowseSortOrder) =>
  scope === WHOLE_COLLECTION && sortOrder === 'newest';

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
  if (goesSetBySet(scope, sortOrder)) return sets.flatMap((set) => binderCardsForSet(cards, set));
  if (scope === WHOLE_COLLECTION) return applySortOrder(cards.filter(isBinderCard), sortOrder);
  return binderOrder(cards, scope, sortOrder);
}

/**
 * The sort's options while the binder shows: Browse's own, but the default is named
 * for what it does in a single set's binder.
 */
export const BINDER_SORT_OPTIONS: typeof BROWSE_SORT_OPTIONS = BROWSE_SORT_OPTIONS.map((option) =>
  option.value === 'newest' ? {...option, label: 'Collector number', mobileLabel: 'Collector #'} : option,
);
