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
  type: CardType[];
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

// Synergy types - what kind of connection exists between cards
export type SynergyType =
  | "keyword"        // Evasive + quest triggers, Singer + Songs
  | "classification" // Floodborn synergies, Princess tribal
  | "shift"          // Shift onto same-named characters
  | "named"          // Card explicitly references another by name
  | "mechanic"       // Exert synergies, draw engines, ramp
  | "ink"            // Same ink color benefits
  | "cost-curve";    // Good mana curve progression

// How strong is this synergy
export type SynergyStrength = "weak" | "moderate" | "strong";

// A detected synergy between two cards
export interface Synergy {
  cardA: string;              // card ID
  cardB: string;              // card ID
  type: SynergyType;
  strength: SynergyStrength;
  explanation: string;        // human-readable explanation
  bidirectional: boolean;     // does B also synergize with A the same way?
  tags?: string[];            // optional tags for filtering
}

// A synergy rule that can detect connections
export interface SynergyRule {
  id: string;
  name: string;
  type: SynergyType;
  description: string;
  
  // Does this rule apply to this card?
  matches: (card: LorcanaCard) => boolean;
  
  // Given a matching card, find cards that synergize with it
  findSynergies: (
    card: LorcanaCard, 
    allCards: LorcanaCard[]
  ) => SynergyMatch[];
}

// Result from a synergy rule evaluation
export interface SynergyMatch {
  card: LorcanaCard;
  strength: SynergyStrength;
  explanation: string;
  bidirectional?: boolean;
}

// Single synergy match for display
export interface SynergyMatchDisplay {
  card: LorcanaCard;
  strength: SynergyStrength;
  explanation: string;
  ruleId?: string;
  ruleName?: string;
}

// Grouped synergies for display
export interface GroupedSynergies {
  type: SynergyType;
  label: string;
  synergies: SynergyMatchDisplay[];
}

// Card entry in a deck (card + quantity)
export interface DeckCard {
  card: LorcanaCard;
  quantity: number; // 1-4
}

// A complete deck
export interface Deck {
  id: string;
  name: string;
  cards: DeckCard[];
  createdAt: number;
  updatedAt: number;
}

// Deck statistics
export interface DeckStats {
  totalCards: number;
  uniqueCards: number;
  inkDistribution: Record<Ink, number>;
  costCurve: Record<number, number>; // cost -> count
  typeDistribution: Record<CardType, number>;
  inkCount: number; // number of different inks used
  isValid: boolean; // 60 cards, max 2 inks
  validationErrors: string[];
}
