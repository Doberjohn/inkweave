import type {CardPrinting, LorcanaJSONCard, RawCardVariant} from 'inkweave-synergy-engine';
import {transformCard as baseTransformCard, isCoreSet} from 'inkweave-synergy-engine/card';
import type {LorcanaCard, Ink, CardType} from './types';
import {fetchPreviewCards} from './previewCards';
import {PROMO_RARITY, isChaseRarity} from 'inkweave-ui/lib/printings';
import type {FilterPicks} from 'inkweave-ui/lib/filterModel';
import {ALL_INKS, binderSetOf, editionRank, promoSetRank, type BrowseSortOrder} from '../../shared/constants';

interface LorcanaJSONSet {
  name: string;
  number: number;
  type: string;
  releaseDate?: string;
  /** Preview sets only: the reveal season's prerelease date. */
  prereleaseDate?: string;
}

export interface LorcanaJSONData {
  metadata: {
    formatVersion: string;
    generatedOn: string;
    language: string;
  };
  sets?: Record<string, LorcanaJSONSet>;
  cards: LorcanaJSONCard[];
}

// Set info type exported for components
export interface SetInfo {
  code: string;
  name: string;
  number: number;
}

/**
 * When VITE_LOCAL_IMAGES is set (production Vercel build), use self-hosted AVIF files.
 * Otherwise, fall back to same-origin proxy (dev/CI).
 */
const USE_LOCAL_IMAGES = import.meta.env.VITE_LOCAL_IMAGES === 'true';
const IMAGE_CDN_ORIGIN = 'https://api.lorcana.ravensburger.com/images/';
const PREVIEW_IMAGE_CDN_ORIGIN = 'https://lorcanaplayer.com/wp-content/uploads/';

/** A card, or one of its variant printings (#625): anything with its own id and art. */
type ImageSource = Pick<LorcanaJSONCard, 'id' | 'images' | 'imageHash'>;

/**
 * Whether the card's only art is its hashed file, whatever the build: it has the hash a deploy
 * injects and no links, as every card in a production deployment's data has (#932). Admin reads
 * inkweave.ink's card data in a build without VITE_LOCAL_IMAGES, so this is how it shows the art
 * the site serves. The repo's data keeps its links, and an owner's scan has no hash until a
 * build hashes it.
 */
function hasHashedArtOnly(raw: ImageSource): boolean {
  return raw.imageHash !== undefined && raw.images === undefined;
}

function resolveImageUrl(raw: ImageSource): string | undefined {
  // Production: content-addressed URL using the hash injected into the data
  // file by scripts/download-card-images.mjs. Returning undefined when no
  // hash is present is intentional — surfaces a build mismatch as a broken
  // image rather than a silently-stale one. See issue #323.
  if (USE_LOCAL_IMAGES || hasHashedArtOnly(raw)) {
    return raw.imageHash ? `/card-images/${raw.id}.${raw.imageHash}.avif` : undefined;
  }
  const rawUrl = raw.images?.thumbnail;
  // Hand-built reveal cards (admin's reveal publisher, or a season's first batch) carry no
  // remote thumbnail, only a raw scan + its pre-converted AVIF. Every canonical
  // card has a thumbnail, so a missing one identifies a reveal card without
  // naming the season's set. Fall back to the local preview path so they show in
  // dev. (Production uses the injected imageHash branch above.)
  if (!rawUrl) return `/card-images-preview/${raw.id}.avif`;
  // Ravensburger: proxy through same-origin rewrite (dev Vite proxy + Vercel rewrite).
  if (rawUrl.startsWith(IMAGE_CDN_ORIGIN)) return rawUrl.replace(IMAGE_CDN_ORIGIN, '/card-images/');
  // Set 12 previews: lorcanaplayer.com is behind Cloudflare bot protection so we can't
  // proxy directly. Pre-converted AVIFs live at /card-images-preview/{id}.avif (see
  // scripts/convert-preview-images.mjs and the tracked card-images-preview/ directory).
  if (rawUrl.startsWith(PREVIEW_IMAGE_CDN_ORIGIN)) return `/card-images-preview/${raw.id}.avif`;
  return rawUrl;
}

/**
 * Whether the card draws its hashed files: every card in a local-images build, and in any build a
 * card whose art URL is its hashed file's (resolveImageUrl), not a link's or a scan's (#932).
 */
function drawsHashedArt(card: Pick<LorcanaCard, 'id' | 'imageUrl'>): boolean {
  return USE_LOCAL_IMAGES || card.imageUrl?.startsWith(`/card-images/${card.id}.`) === true;
}

/**
 * Derive the small-size image URL for a card.
 *
 * Production (USE_LOCAL_IMAGES), and any card whose art is its hashed file
 * (#932): builds `/card-images/{id}.{hashSm}-sm.avif` from the per-size hash
 * injected into the card data. The small variant has a different hash than
 * the full variant because the bytes differ.
 *
 * Dev/CI: falls back to the legacy string-transform on `card.imageUrl`
 * (`.avif` → `-sm.avif`) so the existing proxy paths keep working.
 */
export function smallImageUrl(
  card: Pick<LorcanaCard, 'id' | 'imageUrl' | 'imageHashSm'>,
): string | undefined {
  if (card.imageHashSm && drawsHashedArt(card)) {
    return `/card-images/${card.id}.${card.imageHashSm}-sm.avif`;
  }
  const url = card.imageUrl;
  if (!url || !url.endsWith('.avif')) return url;
  return `${url.slice(0, -5)}-sm.avif`;
}

/**
 * Transform a LorcanaJSON card to our LorcanaCard format.
 * Uses the shared transformer from the engine package, then adds imageUrl (web-specific).
 */
function transformCard(raw: LorcanaJSONCard): LorcanaCard | null {
  const card = baseTransformCard(raw);
  if (!card) return null;
  card.imageUrl = resolveImageUrl(raw);
  // Hashes injected by scripts/download-card-images.mjs at build time. The
  // engine deliberately does not set these (image fields are a web concern).
  card.imageHash = raw.imageHash;
  card.imageHashSm = raw.imageHashSm;
  // Only preview cards shown with a foreign-language scan carry this (the "See translation" toggle).
  card.scanLanguage = raw.scanLanguage;
  card.variants = raw.variants?.map(toPrinting);
  // A collection card that is a printing names the card it reprints (#796). Special promos
  // carry one too, as printings that never fold; the binder drops them for the catalog's (#805).
  card.baseId = raw.baseId === undefined ? undefined : String(raw.baseId);
  // The versions a card comes in, where its data names them (#880): see finishesOf.
  card.finishes = raw.finishes;
  return card;
}

/** A variant printing's art resolves exactly like a card's, under the variant's own id. */
export function toPrinting(variant: RawCardVariant): CardPrinting {
  return {
    id: String(variant.id),
    rarity: variant.rarity,
    number: variant.number ?? undefined,
    imageUrl: resolveImageUrl(variant),
    imageHashSm: variant.imageHashSm,
    scanLanguage: variant.scanLanguage,
    promoGrouping: variant.promoGrouping,
    finish: variant.finish,
    finishes: variant.finishes,
  };
}

/**
 * A card of its own for one of `card`'s printings: the card under the printing's id, rarity,
 * number, art and versions (#880), naming `card` as its `baseId` (#796). The full-size image
 * hash is the base card's art, so it is dropped rather than carried. A promo's card is in its
 * promo set ("P1" in 25/P1), with its finish and art variant (#805): Browse's promo tiles and
 * collection mode's pockets are such cards.
 */
export function printingCard(card: LorcanaCard, printing: CardPrinting): LorcanaCard {
  return {
    ...card,
    id: printing.id,
    baseId: card.id,
    rarity: printing.rarity,
    setCode: printing.promoGrouping ?? card.setCode,
    setNumber: printing.number,
    imageUrl: printing.imageUrl,
    imageHash: undefined,
    imageHashSm: printing.imageHashSm,
    scanLanguage: printing.scanLanguage,
    variants: undefined,
    finish: printing.finish,
    finishes: printing.finishes,
    artVariant: printing.artVariant,
  };
}

/**
 * Parse set code to a numeric value for comparison
 * Regular sets (1-11) get their number, Q sets get a lower priority
 */
export function parseSetOrder(setCode: string | undefined): number {
  if (!setCode) return -1;
  const num = parseInt(setCode, 10);
  if (!isNaN(num)) return num;
  // Q1, Q2 etc. get negative priority (older than regular sets)
  if (setCode.startsWith('Q')) return -parseInt(setCode.slice(1), 10);
  return -1;
}

/**
 * Extract set information from LorcanaJSON data
 */
export function loadSetsFromJSON(data: LorcanaJSONData): SetInfo[] {
  if (!data.sets) return [];

  return Object.entries(data.sets)
    .map(([code, set]) => ({
      code,
      name: set.name,
      number: set.number,
    }))
    .sort((a, b) => {
      // Sort by number, with Q sets (negative or special) at the end
      const numA = typeof a.number === 'number' ? a.number : 999;
      const numB = typeof b.number === 'number' ? b.number : 999;
      return numA - numB;
    });
}

/**
 * Load cards from a LorcanaJSON data object.
 * Expects pre-deduplicated data (see cleanup script).
 */
export function loadCardsFromJSON(data: LorcanaJSONData): LorcanaCard[] {
  return transformRawCards(data.cards);
}

/**
 * Transform a bare array of raw cards, dropping any that fail.
 *
 * Split out of {@link loadCardsFromJSON} for callers holding cards without the
 * surrounding `metadata` envelope: the collection chunks (#553) are plain arrays.
 * The alternative was fabricating a metadata object to satisfy a parameter the
 * function never reads, which would make the fake look load-bearing.
 *
 * Use THIS (or `loadCardsFromJSON`) rather than the engine's `transformCard`.
 * The `transformCard` called here is the LOCAL wrapper above, which attaches
 * `imageUrl` and the content-addressed hashes; the engine's deliberately does
 * not, so calling it directly costs every collection card its artwork.
 */
export function transformRawCards(cards: readonly LorcanaJSONCard[]): LorcanaCard[] {
  const out: LorcanaCard[] = [];
  for (const raw of cards) {
    const card = transformCard(raw);
    if (card) out.push(card);
  }
  return out;
}

export interface CardDataResult {
  cards: LorcanaCard[];
  sets: SetInfo[];
}

/**
 * The card data never arrived: the device is offline, the request didn't complete, or the server
 * answered with an error status. Each is worth another try. Any other failure means the data
 * arrived and this page couldn't use it (cardListFailure.ts).
 */
export class CardDataUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CardDataUnavailableError';
  }
}

const UNREACHABLE = "Couldn't reach Inkweave. Check your connection, then try again.";

/** The response to `path`, failing with a CardDataUnavailableError when no good one comes. */
async function fetchCardData(path: string): Promise<Response> {
  const response = await fetch(path).catch((error: unknown) => {
    throw new CardDataUnavailableError(UNREACHABLE, {cause: error});
  });
  if (!response.ok) {
    throw new CardDataUnavailableError(
      `Inkweave couldn't send the card data (error ${response.status}). Try again in a moment.`,
    );
  }
  return response;
}

/**
 * The card data's JSON. A body cut off on the way rejects with a TypeError, and is the network's
 * failure like a request that never completes; bad JSON rejects with a SyntaxError.
 */
async function readCardJson(response: Response): Promise<LorcanaJSONData> {
  try {
    return await response.json();
  } catch (parseError) {
    if (parseError instanceof TypeError) {
      throw new CardDataUnavailableError(UNREACHABLE, {cause: parseError});
    }
    throw new Error(
      `Failed to parse card data: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`,
      {cause: parseError},
    );
  }
}

/**
 * Fetch cards from a local file, merged with optional preview cards.
 * Preview cards are loaded from /data/previewCards.json if present (graceful 404).
 * Deduplication: allCards.json wins on id conflict.
 */
export async function fetchCardsFromLocal(
  path: string = '/data/allCards.json',
): Promise<CardDataResult> {
  // Both files at once (#641): the preview file used to wait until allCards.json had parsed.
  const [primaryResponse, preview] = await Promise.all([fetchCardData(path), fetchPreviewCards()]);
  const primary = await readCardJson(primaryResponse);

  const primaryIds = new Set(primary.cards.map((c) => c.id));
  const previewCards = preview?.cards.filter((c) => !primaryIds.has(c.id)) ?? [];
  // Enforce the Core rotation floor: drop cards/sets below MIN_CORE_SET so browse,
  // search, and synergies only ever see Core-legal cards (see engine constants.ts).
  const mergedCards = [...primary.cards, ...previewCards].filter((c) => isCoreSet(c.setCode));

  // A reveal season declares its set (dates and all) before its first card lands.
  // The set list feeds the Set filter for every user regardless of the reveal
  // flag, so a preview set only joins it once a card actually belongs to it.
  const setCodesWithCards = new Set(mergedCards.map((c) => c.setCode));
  const previewSets = Object.entries(preview?.sets ?? {}).filter(([code]) => setCodesWithCards.has(code));

  const mergedSets: Record<string, LorcanaJSONSet> = Object.fromEntries(
    Object.entries({...(primary.sets ?? {}), ...Object.fromEntries(previewSets)}).filter(([code]) =>
      isCoreSet(code),
    ),
  );

  const merged: LorcanaJSONData = {
    metadata: primary.metadata,
    sets: mergedSets,
    cards: mergedCards,
  };

  return {
    cards: loadCardsFromJSON(merged),
    sets: loadSetsFromJSON(merged),
  };
}

/**
 * Apostrophes, straight and typographic (U+2018, U+2019: iOS Smart Punctuation types ’
 * for ', and Set 14 preview text prints it). DROPPED, not spaced, so "brunos" finds
 * "Bruno's" as well as either spelling finding the other. Global: .replace only.
 */
const APOSTROPHES = /['‘’]/g;

/**
 * Every other run of non-letters, non-digits: the " - " between name and version,
 * periods, commas, "!", "&", repeated spaces. Global: .replace only.
 */
const SEPARATORS = /[^\p{L}\p{N}]+/gu;

/**
 * A string as search compares it: lowercase words separated by single spaces.
 * Punctuation is never part of what someone means by a name, so "fru fru vip guest"
 * must find "Fru Fru - VIP Guest" (it used to need the dash typed exactly).
 */
function searchKey(value: string): string {
  return value.toLowerCase().replace(APOSTROPHES, '').replace(SEPARATORS, ' ').trim();
}

/**
 * Search cards by name: EVERY query word must begin a word of the card's name, in
 * any order (owner, 2026-10-08). So "judy officer" finds "Judy Hopps - Helpful
 * Officer", a half-typed word still matches ("judy offi"), and "the" finds "The
 * Queen" but not "Father". Compared over `searchKey`, so punctuation, apostrophe
 * style and spacing never decide a match.
 *
 * Name and version are matched as ONE string: a query mixes their words freely,
 * which separate checks against each field could never satisfy.
 */
export function searchCardsByName(cards: LorcanaCard[], query: string): LorcanaCard[] {
  // A leading space on both sides turns "begins a word" into one substring test:
  // `searchKey` leaves single spaces between words, so " offi" can only match at
  // the start of one.
  const words = searchKey(query).split(' ').filter(Boolean).map((word) => ` ${word}`);
  return cards.filter((card) => {
    const key = ` ${searchKey(`${card.fullName} ${card.name} ${card.version ?? ''}`)}`;
    return words.every((word) => key.includes(word));
  });
}

/**
 * The search box's suggestions: what `searchCardsByName` finds, newest set first by
 * `parseSetOrder`, so quest sets come last. inkweave-ui's `useAutocomplete` takes it as its
 * `search`.
 */
export function suggestCardsByName(cards: LorcanaCard[], term: string): LorcanaCard[] {
  return searchCardsByName(cards, term).sort((a, b) => parseSetOrder(b.setCode) - parseSetOrder(a.setCode));
}

/**
 * Filter options for cards: the filter panel's picks (`FilterPicks`, which FilterContent sets)
 * plus the fields only this module's filtering reads. A picked rarity matches the card's own
 * rarity, and with `rarityMatch` its printings too; `inkMatch` applies only to selections
 * `offersDualOnly` offers it for (`matchesInk`).
 */
export interface CardFilterOptions extends FilterPicks {
  ink?: Ink | Ink[];
  type?: (CardType | 'Song') | (CardType | 'Song')[];
  costs?: number[];
  textSearch?: string;
  /**
   * `printings`: a picked rarity also matches a card's Epic, Enchanted or Iconic
   * printing (owner, 2026-10-08). Browse sets it, since it folds those printings
   * into their base card (#625); collection mode does not, since its binder holds
   * them as cards of their own. Set by the page, never read from the URL.
   */
  rarityMatch?: 'printings';
}

/** The two kinds of printing the art presets pick: standard cards, and the alternate-art printings. */
export type ArtKind = 'standard' | 'alt';

/** Both live in inkweave-ui (#980); the loader forwards them for its importers. */
export {PROMO_RARITY, isChaseRarity};

/**
 * The rarities of each kind (owner, 2026-10-15): the five a standard card comes in, and
 * the alternate-art printings: the chase rarities, of which a base card carries at most
 * one, and Special, the promos (owner, 2026-10-17, #805), of which it can carry several.
 */
export const RARITIES_BY_ART: Readonly<Record<ArtKind, readonly string[]>> = {
  standard: ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary'],
  alt: ['Epic', 'Enchanted', 'Iconic', PROMO_RARITY],
};

type CardFilterPredicate = (card: LorcanaCard, options: CardFilterOptions) => boolean;

/**
 * Whether a selection of this many inks offers the Dual-ink cards switch: one ink (its dual
 * cards) or a pair (that pair's). The ONE definition, read by the filter, the URL
 * cleanup, the panel's switch and the toolbar's chip, so they cannot disagree.
 */
export function offersDualOnly(inkCount: number): boolean {
  return inkCount === 1 || inkCount === 2;
}

/** Every ink the card has. */
const cardInks = (card: LorcanaCard): Ink[] => (card.ink2 ? [card.ink, card.ink2] : [card.ink]);

/**
 * The ink rule (owner, 2026-10-08).
 *
 *   - ONE INK selected: every card carrying it, dual-ink ones included. Amber
 *     shows Sulley & Boo (Amber-Ruby).
 *   - TWO OR MORE: the selection is a DECK'S colors, so a card shows only if every
 *     ink it has is selected, because that is what such a deck can play. Amber +
 *     Steel keeps mono Amber, mono Steel and Amber-Steel, and drops Amber-Ruby.
 *
 * The Dual-ink cards switch then keeps just the dual-ink cards of that result. Off a count
 * that offers it, it is ignored rather than trusted: a link carrying it beside
 * three inks must not change the grid.
 *
 * Exported for the synergy results (`filterSynergyCards`), which must answer an
 * ink selection exactly as Browse does. An EMPTY selection filters nothing: the
 * synergy state keeps `[]` where Browse leaves the key out, and under the
 * every-ink rule an empty set would otherwise reject every card.
 */
export function matchesInk(card: LorcanaCard, options: CardFilterOptions): boolean {
  if (!options.ink) return true;
  const selected = new Set(Array.isArray(options.ink) ? options.ink : [options.ink]);
  if (selected.size === 0) return true;
  const inks = cardInks(card);
  const shows = selected.size === 1 ? inks.some((ink) => selected.has(ink)) : inks.every((ink) => selected.has(ink));
  const dualOnly = options.inkMatch === 'dual' && offersDualOnly(selected.size);
  return shows && (!dualOnly || inks.length === 2);
}

/**
 * Song is a pseudo-type: card.type is 'Action' but card.isSong is true, so Action
 * means the other actions. Exported so a card page's synergy filter reads a type
 * pick exactly as Browse does.
 */
export function cardMatchesType(card: LorcanaCard, type: CardType | 'Song'): boolean {
  if (type === 'Song') return !!card.isSong;
  if (type === 'Action') return card.type === 'Action' && !card.isSong;
  return card.type === type;
}

function matchesType(card: LorcanaCard, options: CardFilterOptions): boolean {
  if (!options.type) return true;
  const types = Array.isArray(options.type) ? options.type : [options.type];
  if (types.some((t) => cardMatchesType(card, t))) return true;
  // Action + Song both selected → any Action card passes
  return types.includes('Song') && types.includes('Action') && card.type === 'Action';
}

// Discrete cost selection; 9 means 9+.
function matchesCost(card: LorcanaCard, options: CardFilterOptions): boolean {
  if (!options.costs || options.costs.length === 0) return true;
  return card.cost >= 9 ? options.costs.includes(9) : options.costs.includes(card.cost);
}

/** Any picked set. Exported for the synergy results, which share Browse's rules. */
export function matchesSet(card: LorcanaCard, options: CardFilterOptions): boolean {
  return !options.setCodes?.length || (card.setCode !== undefined && options.setCodes.includes(card.setCode));
}

/**
 * Any picked rarity: the card's own, or, with `rarityMatch: 'printings'`, one of
 * its printings' (`pickedPrinting`). Exported for the synergy results, which never
 * set the mode: a synergy list is about how cards play, not how they are printed.
 */
export function matchesRarity(card: LorcanaCard, options: CardFilterOptions): boolean {
  const picked = options.rarities;
  if (!picked?.length) return true;
  if (card.rarity !== undefined && picked.includes(card.rarity)) return true;
  return options.rarityMatch === 'printings' && pickedPrinting(card, picked) !== undefined;
}

/**
 * The card's printing of a picked rarity, if it has one: the art Browse shows on
 * the card's tile, and the printing the card modal opens on. The first such
 * printing, should a card ever carry two.
 *
 * Never a printing of the card's own rarity (#796): Mr. Incredible #243 is a
 * Legendary like his Standard art, and picking Legendary is asking for the card,
 * not for that printing's art.
 */
export function pickedPrinting(card: LorcanaCard, rarities: readonly string[] | undefined): CardPrinting | undefined {
  if (!rarities?.length) return undefined;
  return card.variants?.find((printing) => printing.rarity !== card.rarity && rarities.includes(printing.rarity));
}

/**
 * How many filters the options hold: every picked keyword, classification, set
 * and rarity, plus inkwell. The ONE count behind the Filters badge, the dialog's
 * "Filters (N)" title and the synergy toolbar; callers add their inks, types and
 * costs. It used to be written out three times, and when keywords became
 * multi-pick one copy kept counting them as one. `inkMatch` is a mode of the ink
 * selection, never a filter of its own.
 */
export function countFilterOptions(options: CardFilterOptions): number {
  const lists = [options.keywords, options.classifications, options.setCodes, options.rarities];
  return lists.reduce((sum, list) => sum + (list?.length ?? 0), 0) + (options.inkwell ? 1 : 0);
}

/**
 * Whether the card carries EVERY selected value (owner, 2026-10-08): several
 * keywords or classifications NARROW the result, "Evasive and Ward", "Hero and
 * Princess". Types work the other way round, any of them, since a card has one.
 * `matches` compares one lowercased card value with one lowercased wanted value.
 */
function carriesEvery(
  selected: string[] | undefined,
  cardValues: string[] | undefined,
  matches: (cardValue: string, wanted: string) => boolean,
): boolean {
  if (!selected || selected.length === 0) return true;
  if (!cardValues) return false;
  return selected.every((wanted) => {
    const w = wanted.toLowerCase();
    return cardValues.some((value) => matches(value.toLowerCase(), w));
  });
}

/**
 * Every selected keyword, matched by CONTAINMENT, because stored keywords carry
 * values: "Singer" finds "Singer 5", "Shift" finds "Floodborn Shift 7". Exported
 * for the synergy results, which share Browse's rule.
 */
export function matchesKeywords(card: LorcanaCard, options: CardFilterOptions): boolean {
  return carriesEvery(options.keywords, card.keywords, (value, wanted) => value.includes(wanted));
}

/** Every selected classification, matched exactly. Exported for the synergy results. */
export function matchesClassifications(card: LorcanaCard, options: CardFilterOptions): boolean {
  return carriesEvery(options.classifications, card.classifications, (value, wanted) => value === wanted);
}

/** Exported for the synergy results, which share Browse's inkwell rule. */
export function matchesInkwell(card: LorcanaCard, options: CardFilterOptions): boolean {
  if (!options.inkwell) return true;
  return options.inkwell === 'inkable' ? card.inkwell : !card.inkwell;
}

function matchesTextSearch(card: LorcanaCard, options: CardFilterOptions): boolean {
  if (!options.textSearch) return true;
  const q = searchKey(options.textSearch);
  return searchKey(card.text ?? '').includes(q) || searchKey(card.fullName).includes(q);
}

const CARD_FILTER_PREDICATES: CardFilterPredicate[] = [
  matchesInk,
  matchesType,
  matchesCost,
  matchesSet,
  matchesKeywords,
  matchesClassifications,
  matchesInkwell,
  matchesRarity,
  matchesTextSearch,
];

/**
 * Filter cards by various criteria
 */
export function filterCards(cards: LorcanaCard[], options: CardFilterOptions): LorcanaCard[] {
  return cards.filter((card) => CARD_FILTER_PREDICATES.every((p) => p(card, options)));
}

/** Whether any card passes the filters: filterCards' rules, stopping at the first match. */
export function anyCardMatches(cards: LorcanaCard[], options: CardFilterOptions): boolean {
  return cards.some((card) => CARD_FILTER_PREDICATES.every((p) => p(card, options)));
}

/**
 * Canonical single-word Lorcana keyword labels. Matching against this set,
 * rather than trusting the first word, drops non-keyword noise that leaks in
 * from mis-tagged source abilities ("THIS", "gain", "if"). Shift and
 * Sing Together are handled by pattern before this fallback, so they are
 * intentionally omitted here.
 */
const KNOWN_KEYWORD_BASES = new Set<string>([
  'Adventurous',
  'Alert',
  'Bodyguard',
  'Boost',
  'Challenger',
  'Evasive',
  'Reckless',
  'Resist',
  'Rush',
  'Singer',
  'Support',
  'Vanish',
  'Ward',
]);

/**
 * Reduce a stored keyword string to its canonical Keyword-filter label, or
 * return null to drop it from the filter entirely.
 *
 * Stored keyword strings are messy: valued keywords ("Singer 5", "Resist +1"),
 * the two-word "Sing Together 8", classification/team Shift variants
 * ("Floodborn Shift 7", "Puppy Shift 3", "Combo Shift 4", "Duo Shift 0",
 * "Temporary Shift 3", "Universal Shift 4", "Madrigal Shift 3"), plain "Shift 5",
 * and occasional non-keyword noise from mis-tagged source abilities ("THIS",
 * "gain", "if"). The old `k.split(' ')[0]` turned every Shift variant into a
 * bogus filter option ("Floodborn", "Puppy", "Combo", ...) that matched almost
 * nothing — which is why filtering by keyword "Floodborn" returned only The Vine.
 */
function normalizeKeywordBase(keyword: string): string | null {
  // All Shift variants ("Floodborn Shift 7", "Puppy Shift 3", "Combo Shift 4",
  // "Temporary Shift 3", plain "Shift 5") are the one Shift keyword; the prefix
  // is a classification, filterable via the Classification facet instead.
  if (/\bShift\b/i.test(keyword)) return 'Shift';
  // Two-word keyword: check before the single-word fallback below.
  if (/^Sing Together\b/i.test(keyword)) return 'Sing Together';
  // Valued/simple keywords ("Singer 5", "Resist +1", "Bodyguard") key off the
  // first word; anything not in the whitelist is noise and is dropped.
  const base = keyword.split(' ')[0];
  return KNOWN_KEYWORD_BASES.has(base) ? base : null;
}

/**
 * Get unique keyword filter options from a card collection, canonicalized so
 * multi-word and Shift-variant keywords collapse to their real keyword name
 * (and non-keyword noise is dropped) via {@link normalizeKeywordBase}.
 */
export function getUniqueKeywords(cards: LorcanaCard[]): string[] {
  const keywords = new Set<string>();
  for (const card of cards) {
    card.keywords?.forEach((k) => {
      const base = normalizeKeywordBase(k);
      if (base) keywords.add(base);
    });
  }
  return Array.from(keywords).sort();
}

/**
 * Get unique classifications from card collection
 */
export function getUniqueClassifications(cards: LorcanaCard[]): string[] {
  const classifications = new Set<string>();
  for (const card of cards) {
    card.classifications?.forEach((c) => classifications.add(c));
  }
  return Array.from(classifications).sort();
}

/**
 * Rarity rank, low to high: the five main-set rarities, then the special
 * printings. Sorts the Rarity filter's options; a rarity missing here (should a
 * new one appear) sorts after these, alphabetically.
 */
const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary', 'Epic', 'Enchanted', 'Iconic', 'Special'];

/** Unique rarities among cards or printings, in rarity order (see RARITY_ORDER). */
export function getUniqueRarities(items: readonly {rarity?: string}[]): string[] {
  const found = new Set<string>();
  for (const item of items) if (item.rarity) found.add(item.rarity);
  const rank = (rarity: string) => {
    const i = RARITY_ORDER.indexOf(rarity);
    return i === -1 ? RARITY_ORDER.length : i;
  };
  return [...found].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * Browse's Rarity options: its cards' own rarities plus their printings', since
 * Browse folds each Epic, Enchanted and Iconic printing into its base card. A chip
 * for one matches the cards that have it (`rarityMatch: 'printings'`).
 */
export function getRaritiesWithPrintings(cards: readonly LorcanaCard[]): string[] {
  return getUniqueRarities([...cards, ...cards.flatMap((card) => card.variants ?? [])]);
}

/**
 * Get unique set codes from card collection (sorted numerically)
 */
export function getUniqueSets(cards: LorcanaCard[]): string[] {
  const sets = new Set<string>();
  for (const card of cards) {
    if (card.setCode) sets.add(card.setCode);
  }
  return Array.from(sets).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    // Both numeric - sort numerically
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    // Numeric before non-numeric (Q1, Q2)
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    // Both non-numeric - sort alphabetically
    return a.localeCompare(b);
  });
}

/**
 * Two sets, latest first: the numbered sets by number, then the rest. Of those, the promo
 * sets go by release (#805, a promo tile's set is its promo set), then any other code.
 */
export function latestSetFirst(setA: string, setB: string): number {
  const numA = parseInt(setA, 10);
  const numB = parseInt(setB, 10);
  if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
  if (!isNaN(numA)) return -1;
  if (!isNaN(numB)) return 1;
  return promoSetRank(setB) - promoSetRank(setA) || setB.localeCompare(setA);
}

/** Where a card whose number is unknown sorts in its set: last, as a promo's does (#805). */
const UNNUMBERED = Number.MAX_SAFE_INTEGER;

/** Of two promo twins under one code, the foil first (#805, owner); a card with no finish has no twin. */
const FINISH_ORDER = {foil: 0, normal: 1} as const;

/** What places a card among its set's: its number, and a promo's finish and art variant. */
type CollectorPlace = Pick<LorcanaCard, 'setNumber' | 'finish' | 'artVariant'>;

/**
 * Two cards of one set in collector order: by number, an unknown one last, then, for two
 * promos under one code, the foil twin first and the arts in order (24A/P2, then 24B/P2).
 * Anything placed like a card sorts with them: the binder's open pockets do.
 */
export function collectorOrder(a: CollectorPlace, b: CollectorPlace): number {
  const byNumber = (a.setNumber ?? UNNUMBERED) - (b.setNumber ?? UNNUMBERED);
  const byFinish = FINISH_ORDER[a.finish ?? 'foil'] - FINISH_ORDER[b.finish ?? 'foil'];
  return byNumber || byFinish || (a.artVariant ?? '').localeCompare(b.artVariant ?? '');
}

/**
 * Two cards of one set in its binder's order: a promo set's editions in turn, oldest first
 * (owner, 2026-10-18: Curator's Collection's Heroines, then Beauty and the Beast), and each
 * in collector order.
 */
export const editionThenCollectorOrder = (a: LorcanaCard, b: LorcanaCard): number =>
  editionRank(a.setCode ?? '') - editionRank(b.setCode ?? '') || collectorOrder(a, b);

/**
 * Sort cards by set (latest first), then in collector order within set, a promo set's
 * editions together (`editionThenCollectorOrder`). Returns a new array. Does not mutate the input.
 */
export function sortBySetThenNumber(cards: LorcanaCard[]): LorcanaCard[] {
  return [...cards].sort((a, b) => {
    const setA = binderSetOf(a.setCode ?? '');
    const setB = binderSetOf(b.setCode ?? '');
    if (setA !== setB) return latestSetFirst(setA, setB);
    return editionThenCollectorOrder(a, b);
  });
}

/**
 * Sort cards alphabetically by fullName.
 * Returns a new array. Does not mutate the input.
 */
export function sortCardsByName(cards: LorcanaCard[], direction: 'asc' | 'desc'): LorcanaCard[] {
  const dir = direction === 'asc' ? 1 : -1;
  return [...cards].sort((a, b) => dir * a.fullName.localeCompare(b.fullName));
}

/**
 * Sort cards by ink cost, with fullName as tiebreaker.
 * Returns a new array. Does not mutate the input.
 */
export function sortCardsByCost(cards: LorcanaCard[], direction: 'asc' | 'desc'): LorcanaCard[] {
  const dir = direction === 'asc' ? 1 : -1;
  return [...cards].sort((a, b) => {
    const costDiff = (a.cost ?? 0) - (b.cost ?? 0);
    if (costDiff !== 0) return dir * costDiff;
    return a.fullName.localeCompare(b.fullName);
  });
}

/**
 * Apply a named sort order to a card array.
 * Returns a new array. Does not mutate the input.
 */
export function applySortOrder(cards: LorcanaCard[], order: BrowseSortOrder): LorcanaCard[] {
  switch (order) {
    case 'ink-cost':
      return [...cards].sort((a, b) => {
        const inkA = ALL_INKS.indexOf(a.ink);
        const inkB = ALL_INKS.indexOf(b.ink);
        return inkA !== inkB ? inkA - inkB : a.cost - b.cost;
      });
    case 'newest':
      return sortBySetThenNumber(cards);
    case 'name-asc':
      return sortCardsByName(cards, 'asc');
    case 'name-desc':
      return sortCardsByName(cards, 'desc');
    case 'cost-asc':
      return sortCardsByCost(cards, 'asc');
    case 'cost-desc':
      return sortCardsByCost(cards, 'desc');
    default:
      return cards;
  }
}
