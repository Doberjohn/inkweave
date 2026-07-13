import {useEffect, useReducer, useRef} from 'react';
import type {Deck, LorcanaCard} from '../types';
import {analyzeDeck, type DeckAnalysis} from '../analysis/analyzeDeck';
import type {HoserEntry} from '../analysis/vulnerabilities';
import {fetchCardSynergies, type PrecomputedPairData} from '../../synergies/hooks/usePrecomputedSynergies';

/** hosers.json fetched once and module-cached (mirrors the per-card synergy fetch cache). */
let hosersCache: HoserEntry[] | null = null;
async function fetchHosers(): Promise<HoserEntry[]> {
  if (hosersCache) return hosersCache;
  try {
    const res = await fetch('/data/hosers.json');
    const contentType = res.headers.get('content-type') ?? '';
    // Guard against the SPA fallback returning 200 + HTML for a missing file.
    if (!res.ok || !contentType.includes('application/json')) {
      hosersCache = [];
      return hosersCache;
    }
    hosersCache = (await res.json()) as HoserEntry[];
    return hosersCache;
  } catch {
    hosersCache = [];
    return hosersCache;
  }
}

/** Synchronous, symmetric pair-score lookup over the fetched per-card pair maps. */
function buildGetPairScore(
  pairMaps: Map<string, Record<string, PrecomputedPairData>>,
): (a: string, b: string) => number {
  return (a, b) => pairMaps.get(a)?.[b]?.aggregateScore ?? pairMaps.get(b)?.[a]?.aggregateScore ?? 0;
}

interface AnalysisState {
  /** The advisor result, or null for an empty deck / before the first run lands. */
  analysis: DeckAnalysis | null;
  isLoading: boolean;
  error: Error | null;
}
type AnalysisAction =
  | {type: 'START'}
  | {type: 'RESULT'; analysis: DeckAnalysis | null}
  | {type: 'ERROR'; error: Error};

function reducer(state: AnalysisState, action: AnalysisAction): AnalysisState {
  switch (action.type) {
    case 'START':
      return {...state, isLoading: true, error: null};
    case 'RESULT':
      return {analysis: action.analysis, isLoading: false, error: null};
    case 'ERROR':
      return {...state, isLoading: false, error: action.error};
  }
}

/** Wait this long after the last deck edit before recomputing (avoids per-click thrash). */
const DEBOUNCE_MS = 300;

/**
 * Runs the full advisor pipeline (`analyzeDeck`) over the current deck off the
 * precomputed synergy JSON + `hosers.json`. Async: fetches each deck card's pair
 * data (module-cached) and the hoser catalog, builds a synchronous
 * `getPairScore`, then calls the pure `analyzeDeck`. Debounced + cancellable so
 * rapid edits don't thrash; the previous result stays visible during the wait.
 * `analysis` is null for an empty deck. Latest deck / getCardById are read via
 * refs so the effect keys on a stable content signature, not object identity.
 *
 * `ready` MUST be the card-DB readiness (e.g. `!isLoading` from CardDataContext):
 * a deck restored from localStorage has cards before `getCardById` can resolve
 * them, and the signature won't change when the DB finally loads — so we gate on
 * `ready` and let it flipping true re-run the analysis with a working resolver.
 * Without this, a cold load analyzes an empty resolver and never self-corrects.
 */
export function useDeckAnalysis(
  deck: Deck,
  getCardById: (id: string) => LorcanaCard | undefined,
  ready: boolean,
): AnalysisState {
  const [state, dispatch] = useReducer(reducer, {analysis: null, isLoading: false, error: null});

  // Keep the latest deck / resolver in refs so the analysis effect can key on a
  // stable content signature (below) rather than object identity. Written in an
  // effect, not during render (refs must not be mutated while rendering).
  const deckRef = useRef(deck);
  const getCardByIdRef = useRef(getCardById);
  useEffect(() => {
    deckRef.current = deck;
    getCardByIdRef.current = getCardById;
  });

  // Recompute only when the deck's cards/quantities or declared gameplan change.
  const signature = JSON.stringify({cards: deck.cards, gameplan: deck.gameplan});

  useEffect(() => {
    const currentDeck = deckRef.current;
    const ids = [...new Set(currentDeck.cards.map((c) => c.cardId))];
    // Hold until the card DB is ready (else analyzeDeck runs on an empty
    // resolver); `ready` flipping true re-runs this effect with a live resolver.
    if (!ready || ids.length === 0) {
      dispatch({type: 'RESULT', analysis: null});
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      dispatch({type: 'START'});
      Promise.all([
        Promise.all(ids.map((id) => fetchCardSynergies(id).then((data) => [id, data.pairs] as const))),
        fetchHosers(),
      ])
        .then(([entries, hosers]) => {
          if (cancelled) return;
          const analysis = analyzeDeck(currentDeck, getCardByIdRef.current, {
            getPairScore: buildGetPairScore(new Map(entries)),
            hosers,
            gameplan: currentDeck.gameplan,
          });
          dispatch({type: 'RESULT', analysis});
        })
        .catch((err) => {
          if (cancelled) return;
          dispatch({type: 'ERROR', error: err instanceof Error ? err : new Error(String(err))});
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [signature, ready]);

  return state;
}
