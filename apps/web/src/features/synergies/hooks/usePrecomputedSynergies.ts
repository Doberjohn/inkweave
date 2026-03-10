import {useReducer, useState, useEffect, useCallback, useMemo} from 'react';
import type {
  LorcanaCard,
  SynergyGroup,
  SynergyMatchDisplay,
  PairSynergyConnection,
  DetailedPairSynergy,
} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../../shared/contexts/CardDataContext';

// ── Pre-computed JSON shapes (must match scripts/precompute-synergies.mjs output) ──

interface PrecomputedSynergyMatch {
  cardId: string;
  score: number;
  explanation: string;
  ruleId?: string;
  ruleName?: string;
}

interface PrecomputedSynergyGroup {
  groupKey: string;
  category: 'direct' | 'playstyle';
  label: string;
  description: string;
  synergies: PrecomputedSynergyMatch[];
}

interface PrecomputedPairData {
  connections: PairSynergyConnection[];
  aggregateScore: number;
}

interface PrecomputedCardData {
  groups: PrecomputedSynergyGroup[];
  pairs: Record<string, PrecomputedPairData>;
}

// ── Module-level fetch cache ──

const synergyFetchCache = new Map<string, PrecomputedCardData>();
let playstyleFetchCache: Record<string, string[]> | null = null;

async function fetchCardSynergies(cardId: string): Promise<PrecomputedCardData> {
  const cached = synergyFetchCache.get(cardId);
  if (cached) return cached;

  const response = await fetch(`/data/synergies/${cardId}.json`);
  if (!response.ok) {
    // Card has no synergies (not in manifest) — cache the empty result
    const empty: PrecomputedCardData = {groups: [], pairs: {}};
    synergyFetchCache.set(cardId, empty);
    return empty;
  }

  // Guard against SPA fallback: Vite dev server returns 200 + HTML for missing files
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const empty: PrecomputedCardData = {groups: [], pairs: {}};
    synergyFetchCache.set(cardId, empty);
    return empty;
  }

  const data: PrecomputedCardData = await response.json();
  synergyFetchCache.set(cardId, data);
  return data;
}

async function fetchPlaystyleCardIds(): Promise<Record<string, string[]>> {
  if (playstyleFetchCache) return playstyleFetchCache;

  const response = await fetch('/data/synergies/_playstyles.json');
  if (!response.ok) throw new Error(`Failed to fetch playstyle data: ${response.status}`);

  // Guard against SPA fallback returning HTML instead of JSON
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Playstyle data unavailable (received HTML instead of JSON)');
  }

  const data: Record<string, string[]> = await response.json();
  playstyleFetchCache = data;
  return data;
}

// ── Resolve pre-computed data into full types ──

function resolveGroups(
  precomputed: PrecomputedSynergyGroup[],
  getCardById: (id: string) => LorcanaCard | undefined,
): SynergyGroup[] {
  return precomputed
    .map((group) => ({
      groupKey: group.groupKey,
      category: group.category,
      label: group.label,
      description: group.description,
      synergies: group.synergies
        .map((match): SynergyMatchDisplay | null => {
          const card = getCardById(match.cardId);
          if (!card) return null;
          return {
            card,
            score: match.score,
            explanation: match.explanation,
            ruleId: match.ruleId,
            ruleName: match.ruleName,
          };
        })
        .filter((s): s is SynergyMatchDisplay => s !== null),
    }))
    .filter((g) => g.synergies.length > 0);
}

export interface UsePrecomputedSynergiesReturn {
  synergies: SynergyGroup[];
  isLoading: boolean;
  error: Error | null;
  getPairSynergies: (clickedCard: LorcanaCard) => DetailedPairSynergy | null;
}

type SynergyAction =
  | {type: 'FETCH_START'; cardId: string}
  | {
      type: 'FETCH_SUCCESS';
      cardId: string;
      synergies: SynergyGroup[];
      pairs: Record<string, PrecomputedPairData>;
    }
  | {type: 'FETCH_ERROR'; cardId: string; error: Error}
  | {type: 'RESET'};

interface SynergyState {
  cardId: string | undefined;
  synergies: SynergyGroup[];
  pairs: Record<string, PrecomputedPairData>;
  isLoading: boolean;
  error: Error | null;
}

function synergyReducer(state: SynergyState, action: SynergyAction): SynergyState {
  switch (action.type) {
    case 'FETCH_START':
      return {cardId: action.cardId, synergies: [], pairs: {}, isLoading: true, error: null};
    case 'FETCH_SUCCESS':
      // Ignore stale responses
      if (state.cardId !== action.cardId) return state;
      return {
        cardId: action.cardId,
        synergies: action.synergies,
        pairs: action.pairs,
        isLoading: false,
        error: null,
      };
    case 'FETCH_ERROR':
      if (state.cardId !== action.cardId) return state;
      return {
        cardId: action.cardId,
        synergies: [],
        pairs: {},
        isLoading: false,
        error: action.error,
      };
    case 'RESET':
      return INITIAL_STATE;
  }
}

const INITIAL_STATE: SynergyState = {
  cardId: undefined,
  synergies: [],
  pairs: {},
  isLoading: false,
  error: null,
};

/**
 * Fetches pre-computed synergies for a card.
 * Replaces client-side engine calls with pre-computed JSON fetches.
 */
export function usePrecomputedSynergies(
  selectedCard: LorcanaCard | null,
): UsePrecomputedSynergiesReturn {
  const {getCardById} = useCardDataContext();
  const [state, dispatch] = useReducer(synergyReducer, INITIAL_STATE);

  const cardId = selectedCard?.id;

  useEffect(() => {
    if (!cardId) {
      dispatch({type: 'RESET'});
      return;
    }

    let cancelled = false;
    dispatch({type: 'FETCH_START', cardId});

    fetchCardSynergies(cardId)
      .then((data) => {
        if (cancelled) return;
        dispatch({
          type: 'FETCH_SUCCESS',
          cardId,
          synergies: resolveGroups(data.groups, getCardById),
          pairs: data.pairs,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(`Failed to load synergies for card ${cardId}:`, err);
        dispatch({
          type: 'FETCH_ERROR',
          cardId,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [cardId, getCardById]);

  const getPairSynergies = useCallback(
    (clickedCard: LorcanaCard): DetailedPairSynergy | null => {
      if (!selectedCard) return null;
      const pairData = state.pairs[clickedCard.id];
      if (!pairData) return null;
      return {
        cardA: selectedCard,
        cardB: clickedCard,
        connections: pairData.connections,
        aggregateScore: pairData.aggregateScore,
      };
    },
    [selectedCard, state.pairs],
  );

  return {
    synergies: state.synergies,
    isLoading: state.isLoading,
    error: state.error,
    getPairSynergies,
  };
}

// ── Playstyle hooks (single fetch, two views) ──

/**
 * Fetches pre-computed playstyle card lists.
 * Used by PlaystyleDetailPage for a single playstyle's cards.
 */
export function usePrecomputedPlaystyleCards(playstyleId: string | undefined): {
  cards: LorcanaCard[];
  isLoading: boolean;
  error: Error | null;
} {
  const {data, isLoading: allLoading, error} = useAllPlaystyleCards();

  const cards = useMemo(() => {
    if (!playstyleId) return [];
    const psData = data.get(playstyleId);
    return psData?.allCards ?? [];
  }, [playstyleId, data]);

  return {cards, isLoading: allLoading, error};
}

/**
 * Fetches all playstyle card data (shared fetch for gallery + detail pages).
 * Returns resolved card objects for each playstyle.
 */
export function useAllPlaystyleCards(): {
  data: Map<string, {count: number; previewCards: LorcanaCard[]; allCards: LorcanaCard[]}>;
  isLoading: boolean;
  error: Error | null;
} {
  const {getCardById} = useCardDataContext();
  const [rawData, setRawData] = useState<Record<string, string[]> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchPlaystyleCardIds()
      .then((data) => {
        if (!cancelled) {
          setRawData(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error(String(err));
          console.error('Failed to load playstyle data:', err);
          setError(error);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const data = useMemo(() => {
    const result = new Map<
      string,
      {count: number; previewCards: LorcanaCard[]; allCards: LorcanaCard[]}
    >();
    if (!rawData) return result;
    for (const [psId, ids] of Object.entries(rawData)) {
      const resolved = ids
        .map((id) => getCardById(id))
        .filter((c): c is LorcanaCard => c != null)
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
      result.set(psId, {
        count: resolved.length,
        previewCards: resolved.slice(0, 4),
        allCards: resolved,
      });
    }
    return result;
  }, [rawData, getCardById]);

  return {data, isLoading, error};
}
