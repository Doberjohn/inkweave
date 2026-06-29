import {useEffect, useReducer} from 'react';
import type {LorcanaCard, PairSynergyConnection} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../../shared/contexts/CardDataContext';
import {fetchCardSynergies} from '../../synergies/hooks/usePrecomputedSynergies';
import type {VotingPair} from '../types';

type PairAction =
  | {type: 'FETCH_START'}
  | {type: 'FETCH_SUCCESS'; pair: VotingPair}
  | {type: 'FETCH_ERROR'; error: string};

interface PairState {
  pair: VotingPair | null;
  isLoading: boolean;
  fetchError: string | null;
}

const INITIAL_STATE: PairState = {pair: null, isLoading: true, fetchError: null};

function pairReducer(_state: PairState, action: PairAction): PairState {
  switch (action.type) {
    case 'FETCH_START':
      return {pair: null, isLoading: true, fetchError: null};
    case 'FETCH_SUCCESS':
      return {pair: action.pair, isLoading: false, fetchError: null};
    case 'FETCH_ERROR':
      return {pair: null, isLoading: false, fetchError: action.error};
  }
}

/**
 * Loads a specific card pair by IDs for the in-depth voting page.
 * Mirrors the resolvePair logic from usePairQueue but for a single known pair.
 */
export function useSpecificPair(
  cardAId: string | undefined,
  cardBId: string | undefined,
): {pair: VotingPair | null; isLoading: boolean; error: string | null} {
  const {getCardById} = useCardDataContext();

  // Derive card objects synchronously (no effect needed for lookups)
  const resolved = (() => {
    if (!cardAId || !cardBId) return {cardA: null, cardB: null, error: 'Missing card IDs'};
    const cardA = getCardById(cardAId);
    const cardB = getCardById(cardBId);
    if (!cardA || !cardB) return {cardA: null, cardB: null, error: 'One or both cards not found'};
    return {cardA, cardB, error: null};
  })();

  const [state, dispatch] = useReducer(pairReducer, INITIAL_STATE);

  useEffect(() => {
    // If card lookup failed, skip the async fetch entirely
    if (resolved.error || !resolved.cardA || !resolved.cardB) return;

    const {cardA, cardB} = resolved as {cardA: LorcanaCard; cardB: LorcanaCard};
    let cancelled = false;
    dispatch({type: 'FETCH_START'});

    (async () => {
      try {
        // Try cardA's synergy file first, fall back to cardB's
        let data = await fetchCardSynergies(cardA.id);
        let pairData = data.pairs[cardB.id];
        if (!pairData) {
          data = await fetchCardSynergies(cardB.id);
          pairData = data.pairs[cardA.id];
        }

        if (cancelled) return;

        const connections: PairSynergyConnection[] = pairData?.connections ?? [];
        const aggregateScore = pairData?.aggregateScore ?? 0;

        dispatch({type: 'FETCH_SUCCESS', pair: {cardA, cardB, aggregateScore, connections}});
      } catch (err) {
        if (cancelled) return;
        console.error('[useSpecificPair] Failed to load pair data:', err);
        dispatch({type: 'FETCH_ERROR', error: 'Failed to load synergy data'});
      }
    })();

    return () => {
      cancelled = true;
    };
    // Depend on the stable resolved fields, NOT the `resolved` object itself: the
    // IIFE returns a fresh object every render, so `[resolved]` re-fired this effect
    // (which dispatches FETCH_START) on every render → infinite loop. cardA/cardB are
    // stable refs from getCardById (a map lookup), and error is a string|null.
  }, [resolved.cardA, resolved.cardB, resolved.error]);

  // If sync validation failed, report that error without loading
  if (resolved.error) {
    return {pair: null, isLoading: false, error: resolved.error};
  }

  return {pair: state.pair, isLoading: state.isLoading, error: state.fetchError};
}
