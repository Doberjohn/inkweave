import type {CardPrinting, LorcanaJSONCard, RawCardVariant} from 'inkweave-synergy-engine';
import {transformCard as baseTransformCard, isCoreSet} from 'inkweave-synergy-engine/card';
import type {LorcanaCard, Ink, CardType} from './types';
import {fetchPreviewCards} from './previewCards';
import {ALL_INKS, type BrowseSortOrder} from '../../shared/constants';

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

function resolveImageUrl(raw: ImageSource): string | undefined {
  // Production: content-addressed URL using the hash injected into the data
  // file by scripts/download-card-images.mjs. Returning undefined when no
  // hash is present is intentional — surfaces a build mismatch as a broken
  // image rather than a silently-stale one. See issue #323.
  if (USE_LOCAL_IMAGES) {
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
 * Derive the small-size image URL for a card.
 *
 * Production (USE_LOCAL_IMAGES): builds `/card-images/{id}.{hashSm}-sm.avif`
 * from the per-size hash injected into the card data. The small variant has
 * a different hash than the full variant because the bytes differ.
 *
 * Dev/CI: falls back to the legacy string-transform on `card.imageUrl`
 * (`.avif` → `-sm.avif`) so the existing proxy paths keep working.
 */
export function smallImageUrl(
  card: Pick<LorcanaCard, 'id' | 'imageUrl' | 'imageHashSm'>,
): string | undefined {
  if (USE_LOCAL_IMAGES && card.imageHashSm) {
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
  return card;
}

/** A variant printing's art resolves exactly like a card's, under the variant's own id. */
function toPrinting(variant: RawCardVariant): CardPrinting {
  return {
    id: String(variant.id),
    rarity: variant.rarity,
    number: variant.number,
    imageUrl: resolveImageUrl(variant),
    imageHashSm: variant.imageHashSm,
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
 * surrounding `metadata` envelope — the collection chunks are plain arrays. The
 * alternative was fabricating a metadata object to satisfy a parameter the
 * function never reads, which would make the fake look load-bearing.
 *
 * Use THIS (or `loadCardsFromJSON`) rather than the engine's `transformCard`:
 * the local wrapper is what attaches `imageUrl` and the content-addressed
 * hashes, and the engine's deliberately does not.
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
 * Fetch cards from a local file, merged with optional preview cards.
 * Preview cards are loaded from /data/previewCards.json if present (graceful 404).
 * Deduplication: allCards.json wins on id conflict.
 */
export async function fetchCardsFromLocal(
  path: string = '/data/allCards.json',
): Promise<CardDataResult> {
  // Both files at once (#641): the preview file used to wait until allCards.json had parsed.
  const [primaryResponse, preview] = await Promise.all([fetch(path), fetchPreviewCards()]);

  if (!primaryResponse.ok) {
    throw new Error(`Failed to fetch local cards: ${primaryResponse.status}`);
  }

  let primary: LorcanaJSONData;
  try {
    primary = await primaryResponse.json();
  } catch (parseError) {
    throw new Error(
      `Failed to parse card data: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`,
      {cause: parseError},
    );
  }

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
 * Typographic single quotes (U+2018, U+2019). iOS Smart Punctuation types ’ for ', and
 * Set 14 preview text prints it. Global flag: use with .replace only.
 */
const TYPOGRAPHIC_APOSTROPHE = /[‘’]/g;

/** A string as search compares it: lowercase, with typographic apostrophes spelled '. */
function searchKey(value: string): string {
  return value.toLowerCase().replace(TYPOGRAPHIC_APOSTROPHE, "'");
}

/**
 * Search cards by name (case-insensitive substring match). Apostrophe styles match each
 * other, so a query typed with ’ finds a name spelled with ', and the reverse.
 */
export function searchCardsByName(cards: LorcanaCard[], query: string): LorcanaCard[] {
  const q = searchKey(query);
  return cards.filter(
    (card) =>
      searchKey(card.name).includes(q) ||
      searchKey(card.fullName).includes(q) ||
      searchKey(card.version ?? '').includes(q),
  );
}

/**
 * Filter options for cards
 */
export interface CardFilterOptions {
  ink?: Ink | Ink[];
  type?: (CardType | 'Song') | (CardType | 'Song')[];
  costs?: number[];
  keywords?: string[];
  classifications?: string[];
  textSearch?: string;
  setCode?: string;
  inkwell?: 'inkable' | 'uninkable';
}

type CardFilterPredicate = (card: LorcanaCard, options: CardFilterOptions) => boolean;

function matchesInk(card: LorcanaCard, options: CardFilterOptions): boolean {
  if (!options.ink) return true;
  const selected = Array.isArray(options.ink) ? options.ink : [options.ink];
  return selected.includes(card.ink) || (!!card.ink2 && selected.includes(card.ink2));
}

// Song is a pseudo-type: card.type is 'Action' but card.isSong is true.
function cardMatchesType(card: LorcanaCard, type: CardType | 'Song'): boolean {
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

function matchesSet(card: LorcanaCard, options: CardFilterOptions): boolean {
  return !options.setCode || card.setCode === options.setCode;
}

function matchesKeywords(card: LorcanaCard, options: CardFilterOptions): boolean {
  if (!options.keywords || options.keywords.length === 0) return true;
  if (!card.keywords) return false;
  return options.keywords.some((k) => {
    const lk = k.toLowerCase();
    return card.keywords!.some((ck) => ck.toLowerCase().includes(lk));
  });
}

function matchesClassifications(card: LorcanaCard, options: CardFilterOptions): boolean {
  if (!options.classifications || options.classifications.length === 0) return true;
  if (!card.classifications) return false;
  return options.classifications.some((c) => {
    const lc = c.toLowerCase();
    return card.classifications!.some((cc) => cc.toLowerCase() === lc);
  });
}

function matchesInkwell(card: LorcanaCard, options: CardFilterOptions): boolean {
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
  matchesTextSearch,
];

/**
 * Filter cards by various criteria
 */
export function filterCards(cards: LorcanaCard[], options: CardFilterOptions): LorcanaCard[] {
  return cards.filter((card) => CARD_FILTER_PREDICATES.every((p) => p(card, options)));
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
 * Sort cards by set (latest first), then by card number within set.
 * Returns a new array. Does not mutate the input.
 */
export function sortBySetThenNumber(cards: LorcanaCard[]): LorcanaCard[] {
  return [...cards].sort((a, b) => {
    const setA = a.setCode ?? '';
    const setB = b.setCode ?? '';
    if (setA !== setB) {
      const numA = parseInt(setA, 10);
      const numB = parseInt(setB, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
      if (!isNaN(numA)) return -1;
      if (!isNaN(numB)) return 1;
      return setB.localeCompare(setA);
    }
    return (a.setNumber ?? 0) - (b.setNumber ?? 0);
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
