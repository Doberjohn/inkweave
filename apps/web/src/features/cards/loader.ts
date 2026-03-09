import type {LorcanaCard, Ink, CardType} from './types';
import type {BrowseSortOrder} from '../../shared/constants';

// LorcanaJSON data structure (partial - only fields we need)
interface LorcanaJSONCard {
  id: number;
  name: string;
  version?: string;
  fullName: string;
  simpleName: string;
  cost: number;
  color: string;
  inkwell: boolean;
  type: string;
  subtypes?: string[];
  abilities?: Array<{
    fullText: string;
    type: string;
    keyword?: string;
    keywordValue?: string;
    name?: string;
    effect?: string;
  }>;
  fullText?: string;
  fullTextSections?: string[];
  moveCost?: number;
  strength?: number;
  willpower?: number;
  lore?: number;
  keywordAbilities?: string[];
  images?: {
    thumbnail?: string;
  };
  setCode?: string;
  number?: number;
  rarity?: string;
}

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

// Valid ink colors
const VALID_INKS: Ink[] = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];

// Valid card types
const VALID_TYPES: CardType[] = ['Character', 'Action', 'Item', 'Location'];

/**
 * Parse ink colors from raw color string (handles dual-ink cards like "Amethyst-Sapphire")
 * Returns primary ink and optional second ink for dual-ink cards.
 */
function parseInks(colorStr: string): {ink: Ink; ink2?: Ink} | null {
  const parts = colorStr.split('-');
  const primary = parts[0] as Ink;
  if (!VALID_INKS.includes(primary)) return null;

  if (parts.length > 1) {
    const secondary = parts[1] as Ink;
    if (VALID_INKS.includes(secondary)) {
      return {ink: primary, ink2: secondary};
    }
  }
  return {ink: primary};
}

/** Filter to non-empty text sections, returning undefined if none remain. */
function nonEmptySections(sections?: string[]): string[] | undefined {
  const filtered = sections?.filter((s) => s.trim() !== '');
  return filtered?.length ? filtered : undefined;
}

/**
 * Transform a LorcanaJSON card to our LorcanaCard format
 */
function transformCard(raw: LorcanaJSONCard): LorcanaCard | null {
  // Parse ink color(s) — dual-ink cards get both inks preserved
  const inks = parseInks(raw.color);
  if (!inks) {
    return null;
  }

  // Map card type
  const type = raw.type as CardType;
  if (!VALID_TYPES.includes(type)) {
    return null;
  }

  // Extract keywords from abilities
  // LorcanaJSON gives us keywords like "Shift 6" from the abilities array
  const keywords: string[] = [];

  if (raw.abilities) {
    for (const ability of raw.abilities) {
      if (ability.type === 'keyword' && ability.keyword) {
        if (ability.keywordValue) {
          keywords.push(`${ability.keyword} ${ability.keywordValue}`);
        } else {
          keywords.push(ability.keyword);
        }
      }

      // Detect conditional keywords granted in ability text (e.g. "gains Shift 0")
      // If a native Shift keyword already exists, skip the conditional one (native takes priority)
      const text = ability.effect || ability.fullText || '';
      const shiftMatch = text.match(/gains?\s+Shift\s+(\d+)/i);
      if (shiftMatch) {
        const hasNativeShift = keywords.some((k) => k.startsWith('Shift'));
        if (!hasNativeShift) {
          keywords.push(`Shift ${shiftMatch[1]}`);
        }
      }
    }
  }

  // Extract classifications from subtypes
  // Subtypes include things like "Floodborn", "Hero", "Princess", "Song"
  // "Song" is tracked via isSong flag for filtering
  const isSong = raw.subtypes?.includes('Song') ?? false;
  const classifications = raw.subtypes?.filter((s) => s !== 'Song') ?? [];

  return {
    id: String(raw.id),
    name: raw.name,
    version: raw.version,
    fullName: raw.fullName,
    cost: raw.cost,
    ink: inks.ink,
    ink2: inks.ink2,
    inkwell: raw.inkwell,
    type,
    isSong: isSong || undefined,
    classifications: classifications.length > 0 ? classifications : undefined,
    text: raw.fullText,
    textSections: nonEmptySections(raw.fullTextSections),
    moveCost: raw.moveCost,
    strength: raw.strength,
    willpower: raw.willpower,
    lore: raw.lore,
    keywords: keywords.length > 0 ? keywords : undefined,
    imageUrl: resolveImageUrl(raw.images?.thumbnail, raw.id),
    setCode: raw.setCode,
    setNumber: raw.number,
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
