// Ink colors in Lorcana
export type Ink = 'Amber' | 'Amethyst' | 'Emerald' | 'Ruby' | 'Sapphire' | 'Steel';

// Game modes
export type GameMode = 'infinity' | 'core';

// Card types
export type CardType = 'Character' | 'Action' | 'Item' | 'Location';

// The chase rarities an alternate printing can have, each with a symbol of its own (#625).
// Not every printing has one (see CardPrinting.rarity). Special promos are not folded in.
export type VariantRarity = 'Enchanted' | 'Epic' | 'Iconic';

/**
 * An alternate printing of a card: rules-identical, only the art differs. Set by the web
 * loader from the raw card's `variants`; the engine never reads it.
 */
export interface CardPrinting {
  id: string;
  // Its printed rarity: a VariantRarity, or the base card's own for a printing that keeps it,
  // like Violet Parr #247 (Super Rare, #796).
  rarity: string;
  number: number; // collector number, e.g. 241
  imageUrl?: string;
  imageHashSm?: string;
  scanLanguage?: string; // language code ("it") when this printing's scan is not in English (#681)
  promoGrouping?: string; // a promo's set as printed on the card: "P1" in 25/P1 (#802)
  finish?: 'foil' | 'normal'; // only on promo twins that share a code (#802)
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
  franchise?: string; // Preview cards, and cards graduated since Set 14 (LorcanaJSON's `story`), e.g. "Coco"
  rarity?: string; // "Common" | "Uncommon" | "Rare" | "Super Rare" | "Legendary" | "Enchanted"
  // Language code ("ja", "de") of the card's only scan when that scan is not in English:
  // a preview card revealed abroad first, whose name and text are an unofficial translation.
  // Absent means the scan is English. Set by the web loader; engine never reads it.
  scanLanguage?: string;
  // The alternate printings of this card, in collector-number order; absent when it has none.
  // Set by the web loader; engine never reads it.
  variants?: CardPrinting[];
  // The id of the card this one is a printing of (LorcanaJSON's `baseId`); absent on a card
  // that is no printing. Only collection cards carry one, since a Core card holds its
  // printings in `variants` instead (#796). Set by the web loader; engine never reads it.
  baseId?: string;
}
