import { useState, useEffect, useMemo, useCallback } from "react";
import type { LorcanaCard, Ink, GameMode, SetInfo } from "../../cards";
import type { GroupedSynergies } from "../types";
import { sharedEngine } from "../engine";
import {
  fetchCardsFromLocal,
  filterCards,
  searchCardsByName,
  getUniqueKeywords,
  getUniqueClassifications,
  getUniqueSets,
  type CardFilterOptions,
} from "../../cards";

export interface UseCardDataReturn {
  cards: LorcanaCard[];
  isLoading: boolean;
  error: Error | null;
  totalCards: number;
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  uniqueSets: string[];
  /** Set info with names and codes */
  sets: SetInfo[];
  retryLoad: () => void;
}

/**
 * Hook to load and manage card data from LorcanaJSON
 */
export function useCardData(): UseCardDataReturn {
  const [cards, setCards] = useState<LorcanaCard[]>([]);
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retryLoad = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCards() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchCardsFromLocal();
        if (!cancelled) {
          setCards(data.cards);
          setSets(data.sets);
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
  }, [retryCount]);

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
    sets,
    retryLoad,
  };
}

/**
 * Return type for the useSynergyFinder hook.
 * Provides card data, filtering, selection, and synergy calculation.
 */
export interface UseSynergyFinderReturn {
  /** All loaded cards (unfiltered) */
  cards: LorcanaCard[];
  /** Cards after applying search query and filters */
  filteredCards: LorcanaCard[];
  /** True while card data is loading */
  isLoading: boolean;
  /** Error if card loading failed, null otherwise */
  error: Error | null;
  /** Total number of cards loaded */
  totalCards: number;
  /** Retry loading cards after an error */
  retryLoad: () => void;

  /** Currently selected card for synergy analysis */
  selectedCard: LorcanaCard | null;
  /** Select a card to see its synergies */
  selectCard: (card: LorcanaCard | null) => void;
  /** Clear the current card selection */
  clearSelection: () => void;

  /** Synergies grouped by type for the selected card */
  synergies: GroupedSynergies[];
  /** Total count of synergistic cards found */
  totalSynergyCount: number;

  /** Current search query for card names */
  searchQuery: string;
  /** Update the search query */
  setSearchQuery: (query: string) => void;
  /** Current ink color filter ("all" or specific ink) */
  inkFilter: Ink | "all";
  /** Set the ink color filter */
  setInkFilter: (ink: Ink | "all") => void;
  /** Current game mode ("core" excludes sets 1-4, "infinity" includes all) */
  gameMode: GameMode;
  /** Set the game mode */
  setGameMode: (mode: GameMode) => void;
  /** Additional filter options (type, cost, keywords, etc.) */
  filters: CardFilterOptions;
  /** Update filter options */
  setFilters: (filters: CardFilterOptions) => void;

  /** All unique keywords found in the card pool */
  uniqueKeywords: string[];
  /** All unique classifications found in the card pool */
  uniqueClassifications: string[];
  /** All unique set codes found in the card pool */
  uniqueSets: string[];
  /** Set info with names, codes, and numbers */
  sets: SetInfo[];
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
    sets,
    retryLoad,
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
    return sharedEngine.findSynergies(selectedCard, gameModeFilteredCards);
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
    retryLoad,

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
    sets,
  };
}

/**
 * Hook to check synergy between two specific cards
 */
export function useCardPairSynergy() {
  const checkPair = useCallback((cardA: LorcanaCard, cardB: LorcanaCard) => {
    const result = sharedEngine.checkSynergy(cardA, cardB);
    return {
      hasSynergy: result.hasSynergy,
      synergies: result.synergies,
      explanations: result.synergies.map((s) => s.explanation),
    };
  }, []);

  return { checkPair };
}
