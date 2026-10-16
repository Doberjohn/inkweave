import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {Ink} from '../features/cards';
import {
  searchCardsByName,
  filterCards,
  applySortOrder,
  getRaritiesWithPrintings,
  getUniqueClassifications,
  getUniqueKeywords,
  pickedPrinting,
  countFilterOptions,
  type CardFilterOptions,
} from '../features/cards/loader';
import type {BinderShow} from '../features/collection/binderCards';
import type {BrowseCollectionSlots} from '../features/collection/useBrowseCollection';
import type {BrowseSortOrder, CardTypeFilter} from '../shared/constants';
import type {useFilterParams} from '../shared/hooks';

/** The URL's filter state that decides what Browse lists. */
type ListParams = Pick<
  ReturnType<typeof useFilterParams>,
  'filters' | 'inkFilters' | 'typeFilters' | 'costFilters' | 'searchQuery' | 'sortOrder'
>;

/** What Browse's listing asks of collection mode. */
type ViewCollection = Pick<
  BrowseCollectionSlots,
  'active' | 'pool' | 'show' | 'owns' | 'rarityOptions'
>;

function buildCombinedFilters(
  base: CardFilterOptions,
  inkFilters: Ink[],
  typeFilters: CardTypeFilter[],
  costFilters: number[],
): CardFilterOptions {
  const combined: CardFilterOptions = {...base};
  if (inkFilters.length > 0) combined.ink = inkFilters;
  if (typeFilters.length > 0) combined.type = typeFilters;
  if (costFilters.length > 0) combined.costs = costFilters;
  return combined;
}

/**
 * The Rarity filter's options: the rarities of the cards the page can show. The
 * binder holds Enchanted, Epic and Iconic printings as slots of their own (its
 * `rarityOptions`, handed over by collection mode); the grid's cards carry them as
 * printings (owner, 2026-10-08).
 */
function rarityOptions(collection: ViewCollection | null, pool: LorcanaCard[]): string[] {
  return collection?.active ? collection.rarityOptions(pool) : getRaritiesWithPrintings(pool);
}

/**
 * The binder's Keyword and Classification options, from its wide pool: sets 1-8 bring
 * some Core never prints (Vanish; Broom, Titan). Null for the grid, whose Core options
 * CardDataContext already holds.
 */
function binderOptions(binderShows: boolean, pool: LorcanaCard[]) {
  return binderShows ? {keywords: getUniqueKeywords(pool), classifications: getUniqueClassifications(pool)} : null;
}

/**
 * The grid matches a picked rarity against each card's printings too, an Enchanted
 * pick finding the cards that have an Enchanted printing; the binder's printings
 * are cards of their own, matched by their own rarity.
 */
function withPrintingRarities(filters: CardFilterOptions, binderShows: boolean): CardFilterOptions {
  return filters.rarities?.length && !binderShows ? {...filters, rarityMatch: 'printings'} : filters;
}

function applyFiltersAndSort(
  cards: LorcanaCard[],
  searchQuery: string,
  combinedFilters: CardFilterOptions,
  sortOrder: BrowseSortOrder,
): LorcanaCard[] {
  let result = cards;
  if (searchQuery.trim()) result = searchCardsByName(result, searchQuery);
  if (Object.keys(combinedFilters).length > 0) result = filterCards(result, combinedFilters);
  return applySortOrder(result, sortOrder);
}

/**
 * What the binder shows (owner, 2026-10-12): every card, or only those you hold a copy
 * of, or only those you hold none of. Applied here, after the loader's filters, because
 * it asks the collection, which the loader cannot see.
 */
function byOwnership(cards: LorcanaCard[], show: BinderShow, owns: (cardId: string) => boolean) {
  if (show === 'all') return cards;
  const wantOwned = show === 'owned';
  return cards.filter((card) => owns(card.id) === wantOwned);
}

/**
 * The filters the binder applies: Browse's, less the set filter. Collection mode's set is
 * chosen in the collection panel (owner, 2026-10-12), and a set filter could only empty
 * the binder of every other set. The mode drops the param too; this covers the render
 * before it is gone.
 */
function binderFilters(filters: CardFilterOptions): CardFilterOptions {
  const rest = {...filters};
  delete rest.setCodes;
  return rest;
}

/**
 * Whether anything the reader picked narrows the list: a search, or a filter it applies.
 * Asked of the filters as applied, not the URL's count, so collection mode's dropped set
 * filter never counts, even for the render before its param is gone.
 */
function narrowsList(params: ListParams, filters: CardFilterOptions): boolean {
  const picked = params.inkFilters.length + params.typeFilters.length + params.costFilters.length;
  return picked + countFilterOptions(filters) > 0 || params.searchQuery.trim() !== '';
}

/**
 * What Browse lists, and the Rarity options those cards offer (the binder's Keyword and
 * Classification ones too). The grid lists Core; the binder lists the collection's wide
 * pool, but only while it shows, not while the import dialog has that pool loaded to
 * parse against.
 *
 * `matchedCards` is the same list before the binder's Owned / Missing view: what the
 * collection panel counts (owner, 2026-10-15). Counted after the view, Owned would
 * always read 100%. `filtered` says whether a search or filter narrowed it.
 */
export function browseView(
  collection: ViewCollection | null,
  coreCards: LorcanaCard[],
  params: ListParams,
) {
  const binderShows = collection?.active ?? false;
  const pool = collection?.active ? collection.pool : coreCards;
  const filters = withPrintingRarities(binderShows ? binderFilters(params.filters) : params.filters, binderShows);
  const combined = buildCombinedFilters(filters, params.inkFilters, params.typeFilters, params.costFilters);
  const sorted = applyFiltersAndSort(pool, params.searchQuery, combined, params.sortOrder);
  return {
    rarities: rarityOptions(collection, pool),
    binderOptions: binderOptions(binderShows, pool),
    sortedCards: collection?.active ? byOwnership(sorted, collection.show, collection.owns) : sorted,
    matchedCards: sorted,
    filtered: narrowsList(params, filters),
  };
}

/** The printing the modal opens each card on, by id: the one its grid tile shows, if any. */
export function printingIdsFor(getCardById: (id: string) => LorcanaCard | undefined, rarities: string[] | undefined) {
  return (cardId: string) => {
    const card = getCardById(cardId);
    return card && pickedPrinting(card, rarities)?.id;
  };
}
