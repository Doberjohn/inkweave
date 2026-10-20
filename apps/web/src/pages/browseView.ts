import type {CardPrinting, LorcanaCard} from 'inkweave-synergy-engine';
import type {Ink} from '../features/cards';
import {
  searchCardsByName,
  filterCards,
  applySortOrder,
  getRaritiesWithPrintings,
  getUniqueClassifications,
  getUniqueKeywords,
  pickedPrinting,
  printingCard,
  countFilterOptions,
  PROMO_RARITY,
  type CardFilterOptions,
} from '../features/cards/loader';
import type {BrowseCollectionSlots} from '../features/collection/useBrowseCollection';
import type {CardTypeFilter} from '../shared/constants';
import type {useFilterParams} from '../shared/hooks';

/** The URL's filter state that decides what Browse lists. */
type ListParams = Pick<
  ReturnType<typeof useFilterParams>,
  'filters' | 'inkFilters' | 'typeFilters' | 'costFilters' | 'searchQuery' | 'sortOrder'
>;

/** What Browse's listing asks of collection mode. */
type ViewCollection = Pick<
  BrowseCollectionSlots,
  'active' | 'pool' | 'show' | 'owns' | 'kept' | 'rarityOptions'
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

function applyFilters(cards: LorcanaCard[], searchQuery: string, combinedFilters: CardFilterOptions): LorcanaCard[] {
  let result = cards;
  if (searchQuery.trim()) result = searchCardsByName(result, searchQuery);
  if (Object.keys(combinedFilters).length > 0) result = filterCards(result, combinedFilters);
  return result;
}

/** The picked rarities a card's own tile shows a printing of: all but Special, whose promos get tiles. */
const tileRarities = (rarities: string[] | undefined) => rarities?.filter((rarity) => rarity !== PROMO_RARITY);

/**
 * The grid's tiles while promos are picked (owner, 2026-10-17): every promo of a matching
 * card a tile of its own, since a card's tile shows one printing and a card can carry four
 * (Mickey Mouse - True Friend). The card keeps its own tile only when another picked rarity
 * matches it, its own or a chase printing's. Otherwise each card is its tile. A promo's tile
 * (`printingCard`) has its promo set as its set, so the sort places it.
 */
function withPromoTiles(cards: LorcanaCard[], rarities: string[] | undefined): LorcanaCard[] {
  if (!rarities?.includes(PROMO_RARITY)) return cards;
  const rest = tileRarities(rarities) ?? [];
  return cards.flatMap((card) => {
    const promos = (card.variants ?? []).filter((printing) => printing.rarity === PROMO_RARITY);
    const ownTile = rest.includes(card.rarity ?? '') || pickedPrinting(card, rest) !== undefined;
    return [...(ownTile ? [card] : []), ...promos.map((promo) => printingCard(card, promo))];
  });
}

/**
 * What the binder shows (owner, 2026-10-12): every card, or only those you hold, or only
 * those you don't, toward the panel's chosen headline (owner, 2026-10-20): a copy in either
 * finish for Complete set, one in each for Master set (`owns`). Applied here, after the
 * loader's filters, because it asks the collection, which the loader cannot see.
 *
 * A card changed by hand in this view stays in it (`kept`, #826, owner 2026-10-20): a first
 * copy would otherwise take a card out of Missing, and the binder back to its first spread.
 * The other filters still apply to it, having run first.
 */
function byOwnership(
  cards: LorcanaCard[],
  {show, owns, kept}: Pick<ViewCollection, 'show' | 'owns' | 'kept'>,
) {
  if (show === 'all') return cards;
  const wantOwned = show === 'owned';
  return cards.filter((card) => kept.has(card.id) || owns(card) === wantOwned);
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
  const matched = applyFilters(pool, params.searchQuery, combined);
  // The binder holds each printing as a card of its own already.
  const sorted = applySortOrder(binderShows ? matched : withPromoTiles(matched, filters.rarities), params.sortOrder);
  return {
    rarities: rarityOptions(collection, pool),
    binderOptions: binderOptions(binderShows, pool),
    sortedCards: collection?.active ? byOwnership(sorted, collection) : sorted,
    matchedCards: sorted,
    filtered: narrowsList(params, filters),
  };
}

/** The printing the modal opens each card on, by id: the one its grid tile shows, if any. */
export function printingIdsFor(getCardById: (id: string) => LorcanaCard | undefined, rarities: string[] | undefined) {
  return (cardId: string) => {
    const card = getCardById(cardId);
    return card && pickedPrinting(card, tileRarities(rarities))?.id;
  };
}

/**
 * The printing each grid tile shows (`BrowseCardGrid`'s `printingFor`): a promo tile its
 * promo, and a card's tile its printing of a picked rarity, never a promo, whose tile is its own.
 */
export function tilePrintingFor(getCardById: (id: string) => LorcanaCard | undefined, rarities: string[] | undefined) {
  return (card: LorcanaCard): CardPrinting | undefined => {
    if (card.baseId === undefined) return pickedPrinting(card, tileRarities(rarities));
    return getCardById(card.baseId)?.variants?.find((printing) => printing.id === card.id);
  };
}

/**
 * How the card modal opens a grid tile, and the order its arrows step through (#805). A
 * promo tile opens its base card on that promo, as a binder's printing pocket does
 * (`collectionModalTarget`), so one card can hold several places: Mickey Mouse - True
 * Friend's four promos name him four times, and each place keeps its own printing. A card's
 * own tile opens on the printing it shows (`printingIdFor`).
 */
export function gridModalTarget(
  cardId: string,
  tiles: readonly LorcanaCard[],
  printingIdFor: (cardId: string) => string | undefined,
) {
  const siblingIndex = tiles.findIndex((tile) => tile.id === cardId);
  const siblingIds = tiles.map((tile) => tile.baseId ?? tile.id);
  const printingFor = (id: string, at: number) => (tiles[at]?.baseId === undefined ? printingIdFor(id) : tiles[at].id);
  return {cardId: siblingIds[siblingIndex] ?? cardId, siblingIds, options: {siblingIndex, printingFor}};
}
