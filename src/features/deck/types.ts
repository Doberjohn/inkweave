import type { Ink, CardType, LorcanaCard } from "../cards/types";

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
