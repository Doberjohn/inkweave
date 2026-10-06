// Ink colors in Lorcana
export type Ink = 'Amber' | 'Amethyst' | 'Emerald' | 'Ruby' | 'Sapphire' | 'Steel';

// Game modes
export type GameMode = 'infinity' | 'core';

// Card types
export type CardType = 'Character' | 'Action' | 'Item' | 'Location';

// Alternate-art printings a base card can have (#625). Special promos are not folded in.
export type VariantRarity = 'Enchanted' | 'Epic' | 'Iconic';

/**
 * An alternate printing of a card: rules-identical, only the art differs. Set by the web
 * loader from the raw card's `variants`; the engine never reads it.
 */
export interface CardPrinting {
  id: string;
  rarity: VariantRarity;
  number: number; // collector number, e.g. 241
  imageUrl?: string;
  imageHashSm?: string;
  scanLanguage?: string; // language code ("it") when this printing's scan is not in English (#681)
}

// Core card interface (based on LorcanaJSON structure)
export interface LorcanaCard {
  id: string;
  name: string;
  version?: string;
  fullName: string; // "name - version" combined
  cost: number;
  ink: Ink;
  ink2?: Ink; // Second ink for dual-ink cards (e.g., "Amethyst-Sapphire" → ink2: "Sapphire")
  inkwell: boolean;
  type: CardType; // Character, Action, Item, or Location
  classifications?: string[]; // Floodborn, Hero, Villain, Princess, etc.
  text?: string; // full card text as a single string, used by synergy engine
  textSections?: string[]; // same text split into ability blocks; prefer over text for display
  strength?: number;
  willpower?: number;
  lore?: number;
  keywords?: string[]; // Shift, Evasive, Singer, Challenger, etc.
  isSong?: boolean; // True for Action cards with Song subtype
  moveCost?: number; // Location move cost
  imageUrl?: string;
  // Content-addressed AVIF hash suffixes used to construct production image URLs
  // (`/card-images/{id}.{imageHash}.avif`, `-sm` variant uses imageHashSm).
  // Set by the web loader after transform; engine never reads these. See issue #323.
  imageHash?: string;
  imageHashSm?: string;
  setCode?: string;
  setNumber?: number;
  franchise?: string; // Set only on preview cards (e.g., "Toy Story", "The Incredibles", "Brave")
  rarity?: string; // "Common" | "Uncommon" | "Rare" | "Super Rare" | "Legendary" | "Enchanted"
  // Language code ("ja", "de") of the card's only scan when that scan is not in English:
  // a preview card revealed abroad first, whose name and text are an unofficial translation.
  // Absent means the scan is English. Set by the web loader; engine never reads it.
  scanLanguage?: string;
  // Epic/Enchanted/Iconic printings of this card, in collector-number order; absent when it
  // has none. Set by the web loader; engine never reads it.
  variants?: CardPrinting[];
}
