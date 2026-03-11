import {transformCard as baseTransformCard, type LorcanaJSONCard} from 'inkweave-synergy-engine';
import type {LorcanaCard, Ink, CardType} from './types';
import {ALL_INKS, type BrowseSortOrder} from '../../shared/constants';

interface LorcanaJSONSet {
  name: string;
  number: number;
  type: string;
  releaseDate?: string;
}

interface LorcanaJSONData {
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

function resolveImageUrl(rawUrl: string | undefined, cardId: number): string | undefined {
  if (!rawUrl) return undefined;
  if (USE_LOCAL_IMAGES) return `/card-images/${cardId}.avif`;
  // Fallback: proxy through same-origin Vercel rewrite
  return rawUrl.replace(IMAGE_CDN_ORIGIN, '/card-images/');
}

/**
 * Derive the small-size image URL from a full-size imageUrl.
 * `/card-images/123.avif` → `/card-images/123-sm.avif`
 * Only transforms `.avif` URLs (self-hosted production images).
 * Non-AVIF URLs (dev proxy) are returned unchanged since `-sm` variants don't exist for those.
 */
export function smallImageUrl(imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return undefined;
  if (!imageUrl.endsWith('.avif')) return imageUrl;
  return `${imageUrl.slice(0, -5)}-sm.avif`;
}

/**
 * Transform a LorcanaJSON card to our LorcanaCard format.
 * Uses the shared transformer from the engine package, then adds imageUrl (web-specific).
 */
function transformCard(raw: LorcanaJSONCard): LorcanaCard | null {
  const card = baseTransformCard(raw);
  if (!card) return null;
  card.imageUrl = resolveImageUrl(raw.images?.thumbnail, raw.id);
  return card;
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
  const cards: LorcanaCard[] = [];
  for (const raw of data.cards) {
    const card = transformCard(raw);
    if (card) cards.push(card);
  }
  return cards;
}

export interface CardDataResult {
  cards: LorcanaCard[];
  sets: SetInfo[];
}

/**
 * Fetch cards from a local file (for offline use)
 * Place allCards.json in your public folder
 */
export async function fetchCardsFromLocal(
  path: string = '/data/allCards.json',
): Promise<CardDataResult> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to fetch local cards: ${response.status}`);
  }

  let data: LorcanaJSONData;
  try {
    data = await response.json();
  } catch (parseError) {
    throw new Error(
      `Failed to parse card data: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`,
    );
  }

  return {
    cards: loadCardsFromJSON(data),
    sets: loadSetsFromJSON(data),
  };
}

/**
 * Search cards by name (case-insensitive substring match)
 */
export function searchCardsByName(cards: LorcanaCard[], query: string): LorcanaCard[] {
  const lowerQuery = query.toLowerCase();
  return cards.filter(
    (card) =>
      card.name.toLowerCase().includes(lowerQuery) ||
      card.fullName.toLowerCase().includes(lowerQuery) ||
      card.version?.toLowerCase().includes(lowerQuery),
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
}

/**
 * Filter cards by various criteria
 */
export function filterCards(cards: LorcanaCard[], options: CardFilterOptions): LorcanaCard[] {
  return cards.filter((card) => {
    // Ink filter — dual-ink cards match if either ink is selected
    if (options.ink) {
      const selectedInks = Array.isArray(options.ink) ? options.ink : [options.ink];
      if (!selectedInks.includes(card.ink) && (!card.ink2 || !selectedInks.includes(card.ink2)))
        return false;
    }

    // Type filter (Song is a pseudo-type: card.type is 'Action' but card.isSong is true)
    if (options.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      const hasSong = types.includes('Song');
      const hasAction = types.includes('Action');
      const match = types.some((t) => {
        if (t === 'Song') return card.isSong;
        if (t === 'Action') return card.type === 'Action' && !card.isSong;
        return card.type === t;
      });
      // Both Action + Song selected → accept any Action card
      if (!match && hasSong && hasAction && card.type === 'Action') return true;
      if (!match) return false;
    }

    // Cost filter (discrete selection; 9 means 9+)
    if (options.costs && options.costs.length > 0) {
      if (card.cost >= 9 ? !options.costs.includes(9) : !options.costs.includes(card.cost))
        return false;
    }

    // Set filter
    if (options.setCode && card.setCode !== options.setCode) return false;

    // Keywords filter (any match)
    if (options.keywords && options.keywords.length > 0) {
      if (!card.keywords) return false;
      const hasKeyword = options.keywords.some((k) =>
        card.keywords!.some((ck) => ck.toLowerCase().includes(k.toLowerCase())),
      );
      if (!hasKeyword) return false;
    }

    // Classifications filter (any match)
    if (options.classifications && options.classifications.length > 0) {
      if (!card.classifications) return false;
      const hasClass = options.classifications.some((c) =>
        card.classifications!.some((cc) => cc.toLowerCase() === c.toLowerCase()),
      );
      if (!hasClass) return false;
    }

    // Text search
    if (options.textSearch) {
      const searchLower = options.textSearch.toLowerCase();
      const matchesText = card.text?.toLowerCase().includes(searchLower);
      const matchesName = card.fullName.toLowerCase().includes(searchLower);
      if (!matchesText && !matchesName) return false;
    }

    return true;
  });
}

/**
 * Get unique keywords from card collection
 */
export function getUniqueKeywords(cards: LorcanaCard[]): string[] {
  const keywords = new Set<string>();
  for (const card of cards) {
    card.keywords?.forEach((k) => {
      // Extract base keyword (e.g., "Singer 5" -> "Singer")
      const base = k.split(' ')[0];
      keywords.add(base);
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
 * Returns a new array — does not mutate the input.
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
 * Returns a new array — does not mutate the input.
 */
export function sortCardsByName(cards: LorcanaCard[], direction: 'asc' | 'desc'): LorcanaCard[] {
  const dir = direction === 'asc' ? 1 : -1;
  return [...cards].sort((a, b) => dir * a.fullName.localeCompare(b.fullName));
}

/**
 * Sort cards by ink cost, with fullName as tiebreaker.
 * Returns a new array — does not mutate the input.
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
 * Returns a new array — does not mutate the input.
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
