import { useState, useEffect, useMemo, useCallback } from "react";
import type { LorcanaCard, GroupedSynergies, Ink, GameMode } from "../types";
import { SynergyEngine } from "../engine";
import {
  fetchCardsFromLocal,
  filterCards,
  searchCardsByName,
  getUniqueKeywords,
  getUniqueClassifications,
  getUniqueSets,
  type CardFilterOptions,
} from "../data/loader";

// Singleton engine instance
const engine = new SynergyEngine();

export interface UseCardDataReturn {
  cards: LorcanaCard[];
  isLoading: boolean;
  error: Error | null;
  totalCards: number;
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  uniqueSets: string[];
}

/**
 * Hook to load and manage card data from LorcanaJSON
 */
export function useCardData(): UseCardDataReturn {
  const [cards, setCards] = useState<LorcanaCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCards() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchCardsFromLocal();
        if (!cancelled) {
          setCards(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to load cards"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadCards();
    return () => {
      cancelled = true;
    };
  }, []);

  const uniqueKeywords = useMemo(() => getUniqueKeywords(cards), [cards]);
  const uniqueClassifications = useMemo(() => getUniqueClassifications(cards), [cards]);
  const uniqueSets = useMemo(() => getUniqueSets(cards), [cards]);

  return {
    cards,
    isLoading,
    error,
    totalCards: cards.length,
    uniqueKeywords,
    uniqueClassifications,
    uniqueSets,
  };
}

export interface UseSynergyFinderReturn {
  // Card data
  cards: LorcanaCard[];
  filteredCards: LorcanaCard[];
  isLoading: boolean;
  error: Error | null;
  totalCards: number;

  // Selection
  selectedCard: LorcanaCard | null;
  selectCard: (card: LorcanaCard | null) => void;
  clearSelection: () => void;

  // Synergies
  synergies: GroupedSynergies[];
  totalSynergyCount: number;

  // Search and filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  inkFilter: Ink | "all";
  setInkFilter: (ink: Ink | "all") => void;
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  filters: CardFilterOptions;
  setFilters: (filters: CardFilterOptions) => void;

  // Metadata
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  uniqueSets: string[];
}

/**
 * Main hook for the synergy finder application
 */
export function useSynergyFinder(): UseSynergyFinderReturn {
  const {
    cards,
    isLoading,
    error,
    totalCards,
    uniqueKeywords,
    uniqueClassifications,
    uniqueSets,
  } = useCardData();

  const [selectedCard, setSelectedCard] = useState<LorcanaCard | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [inkFilter, setInkFilter] = useState<Ink | "all">("all");
  const [gameMode, setGameMode] = useState<GameMode>("core");
  const [filters, setFilters] = useState<CardFilterOptions>({});

  // Combine ink filter and game mode with other filters
  const combinedFilters = useMemo(() => {
    const combined: CardFilterOptions = { ...filters, gameMode };
    if (inkFilter !== "all") {
      combined.ink = inkFilter;
    }
    return combined;
  }, [filters, inkFilter, gameMode]);

  // Filter and sort cards
  const filteredCards = useMemo(() => {
    let result = cards;

    // Apply search
    if (searchQuery.trim()) {
      result = searchCardsByName(result, searchQuery);
    }

    // Apply filters (including ink)
    if (Object.keys(combinedFilters).length > 0) {
      result = filterCards(result, combinedFilters);
    }

    // Sort by set (latest first), then by card number in set
    return result.sort((a, b) => {
      const setA = a.setCode ?? "";
      const setB = b.setCode ?? "";
      if (setA !== setB) {
        // Latest numeric sets first (11, 10, 9...), then alphabetic (Q2, Q1)
        const numA = parseInt(setA, 10);
        const numB = parseInt(setB, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
        if (!isNaN(numA)) return -1;
        if (!isNaN(numB)) return 1;
        return setB.localeCompare(setA);
      }
      // Within same set, sort by card number
      const cardNumA = a.setNumber ?? 0;
      const cardNumB = b.setNumber ?? 0;
      return cardNumA - cardNumB;
    });
  }, [cards, searchQuery, combinedFilters]);

  // Cards filtered by game mode (for synergy calculation)
  const gameModeFilteredCards = useMemo(() => {
    return filterCards(cards, { gameMode });
  }, [cards, gameMode]);

  // Calculate synergies for selected card (respects game mode)
  const synergies = useMemo(() => {
    if (!selectedCard || gameModeFilteredCards.length === 0) return [];
    return engine.findSynergies(selectedCard, gameModeFilteredCards);
  }, [selectedCard, gameModeFilteredCards]);

  // Total synergy count
  const totalSynergyCount = useMemo(() => {
    return synergies.reduce((sum, group) => sum + group.synergies.length, 0);
  }, [synergies]);

  // Actions
  const selectCard = useCallback((card: LorcanaCard | null) => {
    setSelectedCard(card);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedCard(null);
  }, []);

  return {
    // Card data
    cards,
    filteredCards,
    isLoading,
    error,
    totalCards,

    // Selection
    selectedCard,
    selectCard,
    clearSelection,

    // Synergies
    synergies,
    totalSynergyCount,

    // Search and filters
    searchQuery,
    setSearchQuery,
    inkFilter,
    setInkFilter,
    gameMode,
    setGameMode,
    filters,
    setFilters,

    // Metadata
    uniqueKeywords,
    uniqueClassifications,
    uniqueSets,
  };
}

/**
 * Hook to check synergy between two specific cards
 */
export function useCardPairSynergy() {
  const checkPair = useCallback((cardA: LorcanaCard, cardB: LorcanaCard) => {
    const result = engine.checkSynergy(cardA, cardB);
    return {
      hasSynergy: result.hasSynergy,
      synergies: result.synergies,
      explanations: result.synergies.map((s) => s.explanation),
    };
  }, []);

  return { checkPair };
}
