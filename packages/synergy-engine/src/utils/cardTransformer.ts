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
  // Content-addressed hash suffixes injected by scripts/download-card-images.mjs
  // at build time. Web loader reads these to build immutable image URLs (issue #323).
  imageHash?: string;
  imageHashSm?: string;
  setCode?: string;
  number?: number;
  rarity?: string;
  franchise?: string; // Set only on preview cards (e.g., "Toy Story", "The Incredibles", "Brave")
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
 * Conditional keywords a card gains on ITSELF in ability text ("gains Shift 0", "this
 * character gets +1 ◊ and gains Singer 3"), synthesized into `keywords` so the Shift Targets
 * and Singer + Songs rules see them. The Singer read is anchored on "this character" with a
 * bounded gap that may not name another character, so "this character quests, chosen
 * character gains Singer 5" and "your characters gain Singer 4" never count. A native keyword
 * of the same name always wins.
 */
const CONDITIONAL_KEYWORD_PATTERNS: ReadonlyArray<[keyword: string, pattern: RegExp]> = [
  ['Shift', /gains?\s+Shift\s+(\d+)/i],
  ['Singer', /this\s+character\b(?:(?!\bcharacters?\b)[^.]){0,60}?\bgains\s+Singer\s+(\d+)/i],
];

/** Keyword abilities as the data states them ("Singer 5", "Evasive"). */
function nativeKeywords(raw: LorcanaJSONCard): string[] {
  return (raw.abilities ?? []).flatMap((a) => {
    if (a.type !== 'keyword' || !a.keyword) return [];
    return [a.keywordValue ? `${a.keyword} ${a.keywordValue}` : a.keyword];
  });
}

/**
 * Every text a conditional keyword may sit in: each ability's effect or fullText, then the
 * card text itself. The card text matters because reveal-form preview cards carry only
 * keyword-type abilities, so their named-ability text lives solely in `fullText`.
 */
function conditionalTexts(raw: LorcanaJSONCard): string[] {
  const abilityTexts = (raw.abilities ?? []).map((a) => a.effect ?? a.fullText);
  return [...abilityTexts, raw.fullText ?? ''];
}

/** The first "gains <keyword> N" read across `texts` as a keyword string, or null. */
function conditionalKeyword(texts: string[], keyword: string, pattern: RegExp): string | null {
  for (const text of texts) {
    const match = text.match(pattern);
    if (match) return `${keyword} ${match[1]}`;
  }
  return null;
}

/** Native keywords first; a conditional one joins only when no native keyword of that name exists. */
function collectKeywords(raw: LorcanaJSONCard): string[] {
  const keywords = nativeKeywords(raw);
  const texts = conditionalTexts(raw);
  for (const [keyword, pattern] of CONDITIONAL_KEYWORD_PATTERNS) {
    if (keywords.some((k) => k.startsWith(keyword))) continue;
    const found = conditionalKeyword(texts, keyword, pattern);
    if (found) keywords.push(found);
  }
  return keywords;
}

/**
 * Split the raw subtypes: `Song` is a flag on Action cards, not a classification,
 * so it is lifted out and the remainder becomes `classifications`. Both fields are
 * omitted rather than emitted empty, which is what the card shape expects.
 */
function parseSubtypes(subtypes?: string[]): {
  isSong: true | undefined;
  classifications: string[] | undefined;
} {
  const classifications = subtypes?.filter((s) => s !== 'Song') ?? [];
  return {
    isSong: subtypes?.includes('Song') ? true : undefined,
    classifications: classifications.length > 0 ? classifications : undefined,
  };
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

  const keywords = collectKeywords(raw);
  const {isSong, classifications} = parseSubtypes(raw.subtypes);

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
    isSong,
    classifications,
    text: raw.fullText,
    textSections: nonEmptySections(raw.fullTextSections),
    moveCost: raw.moveCost,
    // Characters with missing strength (data-entry gaps in preview sets) default to 0.
    // Non-character types keep undefined because strength doesn't apply to them.
    strength: type === 'Character' ? (raw.strength ?? 0) : raw.strength,
    willpower: raw.willpower,
    lore: raw.lore,
    keywords: keywords.length > 0 ? keywords : undefined,
    setCode: raw.setCode,
    setNumber: raw.number,
    franchise: raw.franchise,
    rarity: raw.rarity,
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
