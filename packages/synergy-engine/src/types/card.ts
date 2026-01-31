// Ink colors in Lorcana
export type Ink =
  | "Amber"
  | "Amethyst"
  | "Emerald"
  | "Ruby"
  | "Sapphire"
  | "Steel";

// Game modes
export type GameMode = "infinity" | "core";

// Card types
export type CardType = "Character" | "Action" | "Item" | "Location";

// Core card interface (based on LorcanaJSON structure)
export interface LorcanaCard {
  id: string;
  name: string;
  version?: string;
  fullName: string;           // "name - version" combined
  cost: number;
  ink: Ink;
  inkwell: boolean;
  type: CardType;             // Character, Action, Item, or Location
  classifications?: string[]; // Floodborn, Hero, Villain, Princess, etc.
  text?: string;              // abilities/rules text
  strength?: number;
  willpower?: number;
  lore?: number;
  keywords?: string[];        // Shift, Evasive, Singer, Challenger, etc.
  imageUrl?: string;
  setCode?: string;
  setNumber?: number;
}
