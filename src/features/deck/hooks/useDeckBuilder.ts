import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { LorcanaCard, Ink, CardType } from "../../cards/types";
import type { SynergyStrength } from "../../synergies/types";
import type { Deck, DeckCard, DeckStats } from "../types";
import { sharedEngine } from "../../synergies";
import { ALL_INKS } from "../../../shared/constants/theme";

const STORAGE_KEY_DECKS = "lorcana-synergy-finder-decks";
const STORAGE_KEY_CURRENT = "lorcana-synergy-finder-current-deck";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function createEmptyDeck(): Deck {
  const now = Date.now();
  return {
    id: generateId(),
    name: "New Deck",
    cards: [],
    createdAt: now,
    updatedAt: now,
  };
}

function calculateStats(deck: Deck): DeckStats {
  const inkDistribution: Record<Ink, number> = {
    Amber: 0,
    Amethyst: 0,
    Emerald: 0,
    Ruby: 0,
    Sapphire: 0,
    Steel: 0,
  };

  const costCurve: Record<number, number> = {};
  const typeDistribution: Record<CardType, number> = {
    Character: 0,
    Action: 0,
    Item: 0,
    Location: 0,
  };

  let totalCards = 0;
  const uniqueCards = deck.cards.length;

  for (const { card, quantity } of deck.cards) {
    totalCards += quantity;
    inkDistribution[card.ink] += quantity;

    const cost = Math.min(card.cost, 10); // Cap at 10+ for display
    costCurve[cost] = (costCurve[cost] || 0) + quantity;

    typeDistribution[card.type] += quantity;
  }

  const usedInks = ALL_INKS.filter((ink) => inkDistribution[ink] > 0);
  const inkCount = usedInks.length;

  const validationErrors: string[] = [];
  if (totalCards > 60) {
    validationErrors.push(`Deck has ${totalCards} cards (max 60)`);
  }
  if (inkCount > 2) {
    validationErrors.push(`Deck has ${inkCount} inks (max 2 recommended)`);
  }

  // Check for cards with >4 copies (shouldn't happen with UI limits, but validate anyway)
  for (const { card, quantity } of deck.cards) {
    if (quantity > 4) {
      validationErrors.push(`${card.name} has ${quantity} copies (max 4)`);
    }
  }

  const isValid = totalCards === 60 && inkCount <= 2 && validationErrors.length === 0;

  return {
    totalCards,
    uniqueCards,
    inkDistribution,
    costCurve,
    typeDistribution,
    inkCount,
    isValid,
    validationErrors,
  };
}

export interface DeckSuggestion {
  card: LorcanaCard;
  synergyCount: number;
  totalStrength: number;
  synergizingWith: string[]; // Names of deck cards it synergizes with
}

// Synergy analysis for a single card in the deck
export interface DeckCardSynergy {
  card: LorcanaCard;
  quantity: number;
  synergyCount: number; // Number of other unique cards it synergizes with
  totalStrength: number; // Weighted synergy score
  synergizingWith: Array<{
    card: LorcanaCard;
    strength: SynergyStrength;
    explanation: string;
  }>;
}

// Overall deck synergy analysis
export interface DeckSynergyAnalysis {
  cardSynergies: DeckCardSynergy[]; // All cards sorted by synergy score
  keyCards: DeckCardSynergy[]; // Top synergy cards (hubs)
  weakLinks: DeckCardSynergy[]; // Cards with few/no synergies
  overallScore: number; // Total deck synergy score
  averageScore: number; // Average synergy per card
  connectionCount: number; // Total synergy connections
}

/**
 * Return type for the useDeckBuilder hook.
 * Provides deck state, card management, persistence, and synergy analysis.
 */
export interface UseDeckBuilderReturn {
  /** Current deck being edited */
  deck: Deck;
  /** Computed statistics for the current deck (card counts, ink distribution, cost curve, validation) */
  deckStats: DeckStats;

  /** Add a card to the deck. Returns false if at max copies (4) or deck is full (60 cards). */
  addCard: (card: LorcanaCard) => boolean;
  /** Remove one copy of a card from the deck */
  removeCard: (cardId: string) => void;
  /** Remove all copies of a card from the deck */
  removeAllCopies: (cardId: string) => void;
  /** Set exact quantity for a card (1-4, or 0 to remove) */
  setQuantity: (cardId: string, quantity: number) => void;
  /** Get current quantity of a card in the deck (0 if not present) */
  getCardQuantity: (cardId: string) => number;
  /** Remove all cards from the current deck */
  clearDeck: () => void;

  /** Rename the current deck */
  renameDeck: (name: string) => void;
  /** Create a new empty deck (replaces current deck) */
  newDeck: () => void;
  /** Save current deck to localStorage */
  saveDeck: () => void;
  /** Load a saved deck by ID. Returns false if not found. */
  loadDeck: (id: string) => boolean;
  /** Delete a saved deck from localStorage */
  deleteSavedDeck: (id: string) => void;
  /** Get all saved decks from localStorage, sorted by most recently updated */
  getSavedDecks: () => Deck[];

  /** Export current deck as JSON string */
  exportDeck: () => string;
  /** Import deck from JSON string. Returns false if invalid. */
  importDeck: (json: string) => boolean;

  /** Get card suggestions that synergize with 2+ cards in the current deck */
  getDeckSuggestions: (allCards: LorcanaCard[], limit?: number) => DeckSuggestion[];

  /** Analyze synergy relationships between all cards in the deck */
  getDeckSynergyAnalysis: () => DeckSynergyAnalysis;
}

export function useDeckBuilder(): UseDeckBuilderReturn {
  const [deck, setDeck] = useState<Deck>(() => {
    // Try to load current deck from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CURRENT);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore parse errors
    }
    return createEmptyDeck();
  });

  // Keep a ref to always have access to the latest deck (avoids stale closures)
  const deckRef = useRef(deck);
  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  // Persist current deck to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(deck));
    } catch {
      // Ignore storage errors
    }
  }, [deck]);

  const deckStats = useMemo(() => calculateStats(deck), [deck]);

  const addCard = useCallback((card: LorcanaCard): boolean => {
    // Check constraints using ref to avoid stale closure issues
    const currentDeck = deckRef.current;
    const existing = currentDeck.cards.find((dc) => dc.card.id === card.id);

    if (existing && existing.quantity >= 4) {
      return false; // Already at max copies
    }

    const totalCards = currentDeck.cards.reduce((sum, dc) => sum + dc.quantity, 0);
    if (!existing && totalCards >= 60) {
      return false; // Deck is full
    }

    setDeck((prev) => {
      const existingInState = prev.cards.find((dc) => dc.card.id === card.id);
      if (existingInState) {
        return {
          ...prev,
          cards: prev.cards.map((dc) =>
            dc.card.id === card.id ? { ...dc, quantity: dc.quantity + 1 } : dc
          ),
          updatedAt: Date.now(),
        };
      } else {
        return {
          ...prev,
          cards: [...prev.cards, { card, quantity: 1 }],
          updatedAt: Date.now(),
        };
      }
    });
    return true;
  }, []);

  const removeCard = useCallback((cardId: string) => {
    setDeck((prev) => {
      const existing = prev.cards.find((dc) => dc.card.id === cardId);
      if (!existing) return prev;

      if (existing.quantity <= 1) {
        return {
          ...prev,
          cards: prev.cards.filter((dc) => dc.card.id !== cardId),
          updatedAt: Date.now(),
        };
      }

      return {
        ...prev,
        cards: prev.cards.map((dc) =>
          dc.card.id === cardId ? { ...dc, quantity: dc.quantity - 1 } : dc
        ),
        updatedAt: Date.now(),
      };
    });
  }, []);

  const removeAllCopies = useCallback((cardId: string) => {
    setDeck((prev) => ({
      ...prev,
      cards: prev.cards.filter((dc) => dc.card.id !== cardId),
      updatedAt: Date.now(),
    }));
  }, []);

  const setQuantity = useCallback((cardId: string, quantity: number) => {
    if (quantity < 0 || quantity > 4) return;

    setDeck((prev) => {
      if (quantity === 0) {
        return {
          ...prev,
          cards: prev.cards.filter((dc) => dc.card.id !== cardId),
          updatedAt: Date.now(),
        };
      }

      const existing = prev.cards.find((dc) => dc.card.id === cardId);
      if (!existing) return prev;

      return {
        ...prev,
        cards: prev.cards.map((dc) =>
          dc.card.id === cardId ? { ...dc, quantity } : dc
        ),
        updatedAt: Date.now(),
      };
    });
  }, []);

  // Memoized map for O(1) card quantity lookups
  const cardQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const { card, quantity } of deck.cards) {
      map.set(card.id, quantity);
    }
    return map;
  }, [deck.cards]);

  const getCardQuantity = useCallback(
    (cardId: string): number => {
      return cardQuantityMap.get(cardId) ?? 0;
    },
    [cardQuantityMap]
  );

  const clearDeck = useCallback(() => {
    setDeck((prev) => ({
      ...prev,
      cards: [],
      updatedAt: Date.now(),
    }));
  }, []);

  const renameDeck = useCallback((name: string) => {
    setDeck((prev) => ({
      ...prev,
      name: name.trim() || "Untitled Deck",
      updatedAt: Date.now(),
    }));
  }, []);

  const newDeck = useCallback(() => {
    setDeck(createEmptyDeck());
  }, []);

  const saveDeck = useCallback(() => {
    try {
      const currentDeck = deckRef.current;
      const saved = localStorage.getItem(STORAGE_KEY_DECKS);
      const decks: Deck[] = saved ? JSON.parse(saved) : [];

      // Update existing or add new
      const existingIndex = decks.findIndex((d) => d.id === currentDeck.id);
      if (existingIndex >= 0) {
        decks[existingIndex] = { ...currentDeck, updatedAt: Date.now() };
      } else {
        decks.push({ ...currentDeck, updatedAt: Date.now() });
      }

      localStorage.setItem(STORAGE_KEY_DECKS, JSON.stringify(decks));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const loadDeck = useCallback((id: string): boolean => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DECKS);
      if (!saved) return false;

      const decks: Deck[] = JSON.parse(saved);
      const found = decks.find((d) => d.id === id);
      if (found) {
        setDeck(found);
        return true;
      }
    } catch {
      // Ignore parse errors
    }
    return false;
  }, []);

  const deleteSavedDeck = useCallback((id: string) => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DECKS);
      if (!saved) return;

      const decks: Deck[] = JSON.parse(saved);
      const filtered = decks.filter((d) => d.id !== id);
      localStorage.setItem(STORAGE_KEY_DECKS, JSON.stringify(filtered));
    } catch {
      // Ignore errors
    }
  }, []);

  const getSavedDecks = useCallback((): Deck[] => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DECKS);
      if (!saved) return [];
      const decks: Deck[] = JSON.parse(saved);
      // Sort by updatedAt descending (newest first)
      return decks.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }, []);

  const exportDeck = useCallback((): string => {
    return JSON.stringify(deckRef.current, null, 2);
  }, []);

  const importDeck = useCallback((json: string): boolean => {
    try {
      const imported = JSON.parse(json) as Deck;

      // Basic structure validation
      if (!imported.id || !imported.name || !Array.isArray(imported.cards)) {
        return false;
      }

      // Validate each card entry
      const validCards: DeckCard[] = [];
      let totalCards = 0;

      for (const entry of imported.cards) {
        // Validate card object has required fields
        if (
          !entry.card ||
          typeof entry.card.id !== "string" ||
          typeof entry.card.name !== "string" ||
          typeof entry.card.cost !== "number" ||
          typeof entry.card.ink !== "string" ||
          typeof entry.card.type !== "string"
        ) {
          continue; // Skip invalid cards
        }

        // Validate quantity is 1-4
        const quantity = Math.min(4, Math.max(1, Math.floor(entry.quantity) || 1));

        // Check total doesn't exceed 60
        if (totalCards + quantity > 60) {
          const remaining = 60 - totalCards;
          if (remaining > 0) {
            validCards.push({ card: entry.card, quantity: remaining });
            totalCards = 60;
          }
          break;
        }

        validCards.push({ card: entry.card, quantity });
        totalCards += quantity;
      }

      // Assign new ID to avoid conflicts
      setDeck({
        ...imported,
        id: generateId(),
        cards: validCards,
        updatedAt: Date.now(),
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const getDeckSuggestions = useCallback(
    (allCards: LorcanaCard[], limit = 15): DeckSuggestion[] => {
      if (deck.cards.length === 0) return [];

      // Get IDs of cards already in deck
      const deckCardIds = new Set(deck.cards.map((dc) => dc.card.id));

      // Get the inks used in deck (for filtering suggestions)
      const deckInks = new Set(deck.cards.map((dc) => dc.card.ink));

      // Filter candidates: not in deck, matching deck's ink colors
      const candidates = allCards.filter(
        (card) => !deckCardIds.has(card.id) && deckInks.has(card.ink)
      );

      // Calculate synergy score for each candidate
      const suggestions: DeckSuggestion[] = [];

      for (const candidate of candidates) {
        let synergyCount = 0;
        let totalStrength = 0;
        const synergizingWith: string[] = [];

        // Check synergy with each deck card
        for (const { card: deckCard } of deck.cards) {
          const result = sharedEngine.checkSynergy(candidate, deckCard);
          if (result.hasSynergy) {
            synergyCount++;
            synergizingWith.push(deckCard.fullName);

            // Weight by strength
            for (const syn of result.synergies) {
              totalStrength += strengthWeight(syn.strength);
            }
          }

          // Also check reverse direction
          const reverseResult = sharedEngine.checkSynergy(deckCard, candidate);
          if (reverseResult.hasSynergy && !result.hasSynergy) {
            synergyCount++;
            if (!synergizingWith.includes(deckCard.fullName)) {
              synergizingWith.push(deckCard.fullName);
            }
            for (const syn of reverseResult.synergies) {
              totalStrength += strengthWeight(syn.strength);
            }
          }
        }

        // Only include cards that synergize with at least 2 deck cards
        if (synergyCount >= 2) {
          suggestions.push({
            card: candidate,
            synergyCount,
            totalStrength,
            synergizingWith,
          });
        }
      }

      // Sort by synergy count, then by total strength
      suggestions.sort((a, b) => {
        if (b.synergyCount !== a.synergyCount) {
          return b.synergyCount - a.synergyCount;
        }
        return b.totalStrength - a.totalStrength;
      });

      return suggestions.slice(0, limit);
    },
    [deck.cards]
  );

  const getDeckSynergyAnalysis = useCallback((): DeckSynergyAnalysis => {
    if (deck.cards.length === 0) {
      return {
        cardSynergies: [],
        keyCards: [],
        weakLinks: [],
        overallScore: 0,
        averageScore: 0,
        connectionCount: 0,
      };
    }

    const cardSynergies: DeckCardSynergy[] = [];
    const seenPairs = new Set<string>();
    let totalConnections = 0;

    // Analyze each card in the deck
    for (const { card, quantity } of deck.cards) {
      const synergizingWith: DeckCardSynergy["synergizingWith"] = [];
      let cardTotalStrength = 0;

      // Check synergy with every other card in deck
      for (const { card: otherCard } of deck.cards) {
        if (card.id === otherCard.id) continue;

        // Check both directions for synergies
        const result = sharedEngine.checkSynergy(card, otherCard);
        const reverseResult = sharedEngine.checkSynergy(otherCard, card);

        const hasSynergy = result.hasSynergy || reverseResult.hasSynergy;
        if (hasSynergy) {
          // Get the best explanation and strength from either direction
          const allSynergies = [...result.synergies, ...reverseResult.synergies];
          const bestSynergy = allSynergies.reduce((best, syn) => {
            const currentWeight = strengthWeight(syn.strength);
            const bestWeight = best ? strengthWeight(best.strength) : 0;
            return currentWeight > bestWeight ? syn : best;
          }, allSynergies[0]);

          synergizingWith.push({
            card: otherCard,
            strength: bestSynergy.strength,
            explanation: bestSynergy.explanation,
          });

          cardTotalStrength += strengthWeight(bestSynergy.strength);

          // Count unique pair connections (avoid double counting)
          const pairKey = [card.id, otherCard.id].sort().join("-");
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            totalConnections++;
          }
        }
      }

      cardSynergies.push({
        card,
        quantity,
        synergyCount: synergizingWith.length,
        totalStrength: cardTotalStrength,
        synergizingWith,
      });
    }

    // Sort by total strength (descending)
    cardSynergies.sort((a, b) => {
      if (b.totalStrength !== a.totalStrength) {
        return b.totalStrength - a.totalStrength;
      }
      return b.synergyCount - a.synergyCount;
    });

    // Calculate overall score (sum of all weighted connections)
    const overallScore = cardSynergies.reduce((sum, cs) => sum + cs.totalStrength, 0) / 2; // Divide by 2 because connections are bidirectional
    const averageScore = deck.cards.length > 0 ? overallScore / deck.cards.length : 0;

    // Key cards: top 20% or cards with above-average synergies
    const avgSynergyCount = cardSynergies.reduce((sum, cs) => sum + cs.synergyCount, 0) / cardSynergies.length;
    const keyCards = cardSynergies.filter((cs) => cs.synergyCount >= avgSynergyCount && cs.synergyCount > 0).slice(0, 5);

    // Weak links: cards with 0-1 synergies (potential cuts)
    const weakLinks = cardSynergies.filter((cs) => cs.synergyCount <= 1).slice(0, 5);

    return {
      cardSynergies,
      keyCards,
      weakLinks,
      overallScore: Math.round(overallScore),
      averageScore: Math.round(averageScore * 10) / 10,
      connectionCount: totalConnections,
    };
  }, [deck.cards]);

  return {
    deck,
    deckStats,
    addCard,
    removeCard,
    removeAllCopies,
    setQuantity,
    getCardQuantity,
    clearDeck,
    renameDeck,
    newDeck,
    saveDeck,
    loadDeck,
    deleteSavedDeck,
    getSavedDecks,
    exportDeck,
    importDeck,
    getDeckSuggestions,
    getDeckSynergyAnalysis,
  };
}

function strengthWeight(strength: SynergyStrength): number {
  switch (strength) {
    case "strong":
      return 3;
    case "moderate":
      return 2;
    case "weak":
      return 1;
  }
}
