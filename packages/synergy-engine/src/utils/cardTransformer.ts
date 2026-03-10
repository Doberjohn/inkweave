import type {Ink, CardType, LorcanaCard} from '../types/card.js';

/**
 * Raw LorcanaJSON card structure (partial — fields used by the transformer).
 * Matches the shape in allCards.json from the LorcanaJSON project.
 */
export interface LorcanaJSONCard {
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
    full?: string;
    thumbnail?: string;
  };
  setCode?: string;
  number?: number;
  rarity?: string;
}

const VALID_INKS: Ink[] = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];
const VALID_TYPES: CardType[] = ['Character', 'Action', 'Item', 'Location'];

/**
 * Parse ink colors from raw color string.
 * Handles dual-ink cards like "Amethyst-Sapphire".
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
 * Transform a raw LorcanaJSON card into a LorcanaCard.
 * Returns null if the card has an invalid ink or type.
 *
 * Does NOT set imageUrl — that's a web-app concern (local AVIF vs CDN proxy).
 * The web loader sets it after transformation; the build script leaves it unset.
 */
export function transformCard(raw: LorcanaJSONCard): LorcanaCard | null {
  const inks = parseInks(raw.color);
  if (!inks) return null;

  const type = raw.type as CardType;
  if (!VALID_TYPES.includes(type)) return null;

  // Extract keywords from abilities
  const keywords: string[] = [];
  if (raw.abilities) {
    for (const ability of raw.abilities) {
      if (ability.type === 'keyword' && ability.keyword) {
        keywords.push(
          ability.keywordValue ? `${ability.keyword} ${ability.keywordValue}` : ability.keyword,
        );
      }

      // Detect conditional keywords granted in ability text (e.g. "gains Shift 0")
      const text = ability.effect || ability.fullText || '';
      const shiftMatch = text.match(/gains?\s+Shift\s+(\d+)/i);
      if (shiftMatch) {
        const hasNativeShift = keywords.some((k) => k.startsWith('Shift'));
        if (!hasNativeShift) keywords.push(`Shift ${shiftMatch[1]}`);
      }
    }
  }

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
    setCode: raw.setCode,
    setNumber: raw.number,
  };
}

/**
 * Transform an array of raw LorcanaJSON cards, filtering out invalid entries.
 */
export function transformCards(rawCards: LorcanaJSONCard[]): LorcanaCard[] {
  const cards: LorcanaCard[] = [];
  for (const raw of rawCards) {
    const card = transformCard(raw);
    if (card) cards.push(card);
  }
  return cards;
}
