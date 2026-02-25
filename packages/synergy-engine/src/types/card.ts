// Ink colors in Lorcana
export type Ink = 'Amber' | 'Amethyst' | 'Emerald' | 'Ruby' | 'Sapphire' | 'Steel';

// Game modes
export type GameMode = 'infinity' | 'core';

// Card types
export type CardType = 'Character' | 'Action' | 'Item' | 'Location';

// Core card interface (based on LorcanaJSON structure)
export interface LorcanaCard {
  id: string;
  name: string;
  version?: string;
  fullName: string; // "name - version" combined
  cost: number;
  ink: Ink;
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
  thumbnailUrl?: string;
  setCode?: string;
  setNumber?: number;
}
