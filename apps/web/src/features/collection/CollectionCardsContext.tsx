// The non-Core card pool, for viewing only (#553 Phase C).
//
// THE CORE BOUNDARY LIVES HERE, and it is structural rather than a rule. These
// 2,218 cards never enter `CardDataContext`, so the deck builder, the playstyle
// pages and every build script keep seeing exactly the 1,024 Core cards — not
// because anyone remembered to filter, but because they never ask this provider.
// Browse merges the two arrays locally, in the one place that should see both.
//
// Loading is LAZY: nothing is fetched until collection mode is switched on. A
// visitor who never opens it pays nothing.
//
// DESIGN-PHASE SIMPLIFICATION, deliberate and temporary: this loads every set's
// DETAIL chunk (~382 KB gzip) rather than the 71 KB index. The index carries no
// keywords and no card text, and both are real filters — measured on Set 1,
// "Evasive" hits 11 cards across 6 spreads and the text "banish" hits 27 across
// all 9. Deciding the production tiering before the UI exists would be sizing a
// payload against a guess, which is the mistake that made this dataset 4x bigger
// than its first estimate. Revisit once the binder's needs are settled.

import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import type {LorcanaJSONCard} from 'inkweave-synergy-engine';
import {transformRawCards} from '../cards/loader';
import type {LorcanaCard} from 'inkweave-synergy-engine';

/**
 * Every set with a collection chunk. Ordered as a binder would be.
 *
 * MUST MATCH what `generate-collection-data.mjs` actually emits. Q1/Q2 were here
 * until the Quest sets were excluded from the dataset (owner ruling, 2026-10-06):
 * Illumineer's Quest is a separate co-op product, not trading-card boosters. The
 * stale entries were not harmless, because a missing chunk 404s, `Promise.all`
 * rejects, and collection mode gets an empty pool rather than a partial one.
 */
export const COLLECTION_SETS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'];

interface CollectionCardsContextValue {
  /** Non-Core cards, transformed. Empty until collection mode asks for them. */
  cards: LorcanaCard[];
  /** True while chunks are in flight. */
  isLoading: boolean;
  /**
   * Set when loading failed. The caller must NOT fall back to a partial pool:
   * a half-loaded collection silently omits cards from search, which reads as
   * "I don't own that" rather than "set 4 failed to load".
   */
  error: string | null;
  /** Ask for the pool. Idempotent; safe to call on every render. */
  ensureLoaded: () => void;
  /**
   * Try again after a failure. Separate from {@link ensureLoaded} on purpose:
   * retrying is a user decision, and an automatic one loops (see the provider).
   */
  retry: () => void;
}

const CollectionCardsContext = createContext<CollectionCardsContextValue | null>(null);

async function fetchChunk(setCode: string): Promise<LorcanaCard[]> {
  const res = await fetch(`/data/collection/${setCode}.json`);
  if (!res.ok) throw new Error(`set ${setCode}: HTTP ${res.status}`);
  const cards = (await res.json()) as LorcanaJSONCard[];
  // The LOADER's transformer, not the engine's. The engine's deliberately leaves
  // `imageUrl` unset ("a web-app concern"), and the loader wraps it to attach the
  // resolved URL plus the content-addressed hashes. Calling the engine directly
  // costs every collection card its artwork: `CardTile` falls back to the plain
  // cost badge when `imgSrc` is falsy, which looks like 2,218 cards with no image
  // rather than a missing transform step.
  return transformRawCards(cards);
}

export function CollectionCardsProvider({children}: {children: ReactNode}) {
  const [cards, setCards] = useState<LorcanaCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Guards the one-shot fetch. A REF and not state, because it must flip
   * synchronously within a single call — two `ensureLoaded()` calls in the same
   * tick (both modes asking at once) would both see a stale `false` from state
   * and fire the fifteen requests twice.
   */
  const started = useRef(false);

  /**
   * Kick off the load. Imperative rather than an effect on a `wanted` flag: the
   * flag version has to `setState` in an effect body to record "loading", which
   * cascades a render purely to describe work the effect just started. Starting
   * the request here makes the state changes CONSEQUENCES of the fetch instead.
   */
  function ensureLoaded() {
    if (started.current) return;
    started.current = true;
    setIsLoading(true);
    setError(null);
    Promise.all(COLLECTION_SETS.map(fetchChunk))
      .then((chunks) => setCards(chunks.flat()))
      .catch((err: Error) => {
        // All or nothing, on purpose — see `error` above.
        setCards([]);
        setError(`Could not load the collection (${err.message}).`);
        // `started` STAYS true. Resetting it here is what turned a failed load
        // into an infinite one: the catch sets state, the provider re-renders,
        // `ensureLoaded` gets a fresh identity, the effect below sees its dep
        // change and calls it again, and the guard it would have hit is gone.
        // Fifteen requests per iteration, forever, against a 404. Retrying is
        // now explicit; see `retry`.
      })
      .finally(() => setIsLoading(false));
  }

  /** Clear the one-shot guard and load again. Only ever called by a user action. */
  function retry() {
    started.current = false;
    ensureLoaded();
  }

  const value: CollectionCardsContextValue = {cards, isLoading, error, ensureLoaded, retry};
  return <CollectionCardsContext.Provider value={value}>{children}</CollectionCardsContext.Provider>;
}

/**
 * The non-Core pool. Throws outside its provider rather than returning an empty
 * array, because an empty pool and an unmounted provider look identical at the
 * call site and the silent version renders a collection with nothing in it.
 */
export function useCollectionCards(): CollectionCardsContextValue {
  const ctx = useContext(CollectionCardsContext);
  if (ctx === null) throw new Error('useCollectionCards must be used within a CollectionCardsProvider');
  return ctx;
}

/**
 * The pool a page should filter over: Core alone, or Core plus the collection.
 *
 * Turning `active` on both requests the data and widens the pool, so a caller
 * cannot get one without the other — forgetting the fetch would silently render
 * collection mode over the Core pool, which looks like a working page missing
 * two thirds of its cards.
 *
 * `ensureLoaded` in the dep array is safe despite its unstable identity: the ref
 * guard makes every call after the first a no-op that sets no state, INCLUDING
 * after a failure. That last clause is load-bearing and was once false: the catch
 * used to reset the guard, so a failed load re-rendered, changed this dep, and
 * fired again without limit. Recovery is `retry`, which a user triggers.
 */
export function useCollectionPool(coreCards: LorcanaCard[], active: boolean) {
  const {cards, isLoading, error, ensureLoaded} = useCollectionCards();

  useEffect(() => {
    if (active) ensureLoaded();
  }, [active, ensureLoaded]);

  return {
    pool: active ? [...coreCards, ...cards] : coreCards,
    isLoading: active && isLoading,
    error: active ? error : null,
  };
}
