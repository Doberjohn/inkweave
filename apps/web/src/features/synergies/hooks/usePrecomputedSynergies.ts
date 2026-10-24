import {useReducer, useEffect} from 'react';
import type {
  LorcanaCard,
  SynergyGroup,
  SynergyMatchDisplay,
  PairSynergyConnection,
  DetailedPairSynergy,
} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../../shared/contexts/CardDataContext';
import {fillChipNames} from '../utils';

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
  tagline: string;
  description: string;
  synergies: PrecomputedSynergyMatch[];
}

export interface PrecomputedPairData {
  connections: PairSynergyConnection[];
  aggregateScore: number;
}

interface PrecomputedCardData {
  groups: PrecomputedSynergyGroup[];
  pairs: Record<string, PrecomputedPairData>;
}

// ── Module-level fetch cache ──

const synergyFetchCache = new Map<string, PrecomputedCardData>();
/** Fetches in flight, so main.tsx's hold (#915) and the card page share one per card. */
const synergyRequests = new Map<string, Promise<PrecomputedCardData>>();

/** Caches and returns an empty result, for a card whose synergy file holds nothing to show. */
function cacheEmptyResult(cardId: string): PrecomputedCardData {
  const empty: PrecomputedCardData = {groups: [], pairs: {}};
  synergyFetchCache.set(cardId, empty);
  return empty;
}

/** A card's synergy file, fetched once for the page. A failure is forgotten, so a retry fetches again. */
export async function fetchCardSynergies(cardId: string): Promise<PrecomputedCardData> {
  const cached = synergyFetchCache.get(cardId);
  if (cached) return cached;

  let request = synergyRequests.get(cardId);
  if (!request) {
    request = loadCardSynergies(cardId).finally(() => synergyRequests.delete(cardId));
    synergyRequests.set(cardId, request);
  }
  return request;
}

async function loadCardSynergies(cardId: string): Promise<PrecomputedCardData> {
  const response = await fetch(`/data/synergies/${cardId}.json`);
  // Card has no synergies (not in manifest). Cache the empty result.
  if (!response.ok) return cacheEmptyResult(cardId);

  // Guard against SPA fallback: Vite dev server returns 200 + HTML for missing files
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return cacheEmptyResult(cardId);

  const data: PrecomputedCardData = await response.json();
  synergyFetchCache.set(cardId, data);
  return data;
}

// ── Pure helpers ──

/**
 * Group-scoped pair filter (Option A calibration).
 *
 * When `groupKey` is undefined, returns the pair unchanged. When provided, keeps only
 * connections that belong to that group — direct rules are their own group (`ruleId`),
 * playstyle rules merge by `playstyleId` — and recomputes `aggregateScore` from the
 * filtered set. Returns null if no connections match.
 */
export function filterPairByGroup(
  pairData: PrecomputedPairData,
  groupKey?: string,
): {connections: PairSynergyConnection[]; aggregateScore: number} | null {
  if (!groupKey) {
    return {connections: pairData.connections, aggregateScore: pairData.aggregateScore};
  }
  const filtered = pairData.connections.filter((c) =>
    c.category === 'playstyle' ? c.playstyleId === groupKey : c.ruleId === groupKey,
  );
  if (filtered.length === 0) return null;
  return {
    connections: filtered,
    aggregateScore: Math.max(...filtered.map((c) => c.score)),
  };
}

// ── Resolve pre-computed data into full types ──

/**
 * The groups with their partner cards. A tile shows its explanation only as plain text (the
 * strength badge's tooltip), so its {A}/{B} chip tokens become the two cards' names; the pair
 * view reads the tokens from `pairs`, which stay as they are.
 */
function resolveGroups(
  precomputed: PrecomputedSynergyGroup[],
  getCardById: (id: string) => LorcanaCard | undefined,
  source: LorcanaCard | undefined,
): SynergyGroup[] {
  return precomputed
    .map((group) => ({
      groupKey: group.groupKey,
      category: group.category,
      label: group.label,
      tagline: group.tagline,
      description: group.description,
      synergies: group.synergies
        .map((match): SynergyMatchDisplay | null => {
          const card = getCardById(match.cardId);
          if (!card) return null;
          return {
            card,
            score: match.score,
            explanation: source
              ? fillChipNames(match.explanation, source, card)
              : match.explanation,
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
  getPairSynergies: (clickedCard: LorcanaCard, groupKey?: string) => DetailedPairSynergy | null;
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

const NO_SYNERGIES: SynergyGroup[] = [];
const NO_PAIRS: Record<string, PrecomputedPairData> = {};

/** A card's groups and pairs from its fetched file. */
function settledState(
  cardId: string,
  data: PrecomputedCardData,
  getCardById: (id: string) => LorcanaCard | undefined,
): SynergyState {
  return {
    cardId,
    synergies: resolveGroups(data.groups, getCardById, getCardById(cardId)),
    pairs: data.pairs,
    isLoading: false,
    error: null,
  };
}

/**
 * The state as it applies to `cardId`. The fetch starts in an effect, so on the render where a
 * card arrives or changes, `state` still describes no card or the previous one. That render
 * reports loading with nothing loaded, never a settled empty result, and never the previous
 * card's groups. The card page keeps its footer out until this settles (#532). A file this page
 * has fetched already, such as the one main.tsx's hold waited for (#915), settles that render.
 */
function stateForCard(
  state: SynergyState,
  cardId: string | undefined,
  getCardById: (id: string) => LorcanaCard | undefined,
): SynergyState {
  if (state.cardId === cardId) return state;
  if (cardId === undefined) return INITIAL_STATE;
  const cached = synergyFetchCache.get(cardId);
  if (cached) return settledState(cardId, cached, getCardById);
  return {cardId, synergies: NO_SYNERGIES, pairs: NO_PAIRS, isLoading: true, error: null};
}

/**
 * The effect's work for a card: settles it at once from a file already fetched, or fetches the
 * file. Returns the effect's cleanup, which drops a response that lands after it.
 */
function loadSynergies(
  cardId: string,
  getCardById: (id: string) => LorcanaCard | undefined,
  dispatch: (action: SynergyAction) => void,
): () => void {
  let cancelled = false;
  const settle = (data: PrecomputedCardData) => {
    if (cancelled) return;
    const {synergies, pairs} = settledState(cardId, data, getCardById);
    dispatch({type: 'FETCH_SUCCESS', cardId, synergies, pairs});
  };
  const fail = (err: unknown) => {
    if (cancelled) return;
    console.error(`Failed to load synergies for card ${cardId}:`, err);
    dispatch({type: 'FETCH_ERROR', cardId, error: err instanceof Error ? err : new Error(String(err))});
  };

  dispatch({type: 'FETCH_START', cardId});
  // Batched with FETCH_START, so a file already fetched never renders a loading frame.
  const cached = synergyFetchCache.get(cardId);
  if (cached) settle(cached);
  else fetchCardSynergies(cardId).then(settle).catch(fail);
  return () => {
    cancelled = true;
  };
}

/**
 * Fetches pre-computed synergies for a card.
 * Replaces client-side engine calls with pre-computed JSON fetches.
 * `isLoading` is true from the first render with a card until its fetch settles.
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
    return loadSynergies(cardId, getCardById, dispatch);
  }, [cardId, getCardById]);

  const current = stateForCard(state, cardId, getCardById);
  const getPairSynergies = buildPairResolver(selectedCard, current.pairs);

  return {
    synergies: current.synergies,
    isLoading: current.isLoading,
    error: current.error,
    getPairSynergies,
  };
}

/**
 * Closes over the currently-selected card and its loaded pair data, returning a resolver that
 * looks up a clicked-card → pair synergy. Extracted to keep `usePrecomputedSynergies`'s
 * cyclomatic complexity under threshold (the hook orchestrates fetch + state, the resolver
 * handles its own null/filter branches).
 */
function buildPairResolver(
  selectedCard: LorcanaCard | null,
  pairs: Record<string, PrecomputedPairData>,
): (clickedCard: LorcanaCard, groupKey?: string) => DetailedPairSynergy | null {
  return (clickedCard, groupKey) => {
    if (!selectedCard) return null;
    const pairData = pairs[clickedCard.id];
    if (!pairData) return null;
    const filtered = filterPairByGroup(pairData, groupKey);
    if (!filtered) return null;
    return {cardA: selectedCard, cardB: clickedCard, ...filtered};
  };
}

