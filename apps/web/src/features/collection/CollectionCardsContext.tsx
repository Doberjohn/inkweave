// The non-Core card pool, for viewing only (#553 Phase C).
//
// THE CORE BOUNDARY LIVES HERE, and it is structural rather than a rule. These
// 2,009 cards never enter `CardDataContext`, so the deck builder, the playstyle
// pages and every build script keep seeing exactly the 1,228 Core cards — not
// because anyone remembered to filter, but because they never ask this provider.
// Browse merges the two arrays locally, in the one place that should see both.
// The promos load here too (#805), each a pocket built from the card it reprints, and
// a pre-Core card gets its printings, its set's and its promos, in `variants` (#891).
//
// Loading is LAZY: nothing is fetched until collection mode is switched on, or Browse's
// search asks for sets 1-8 (#911). A visitor who does neither pays nothing. The files load
// through `collectionChunks.ts`, once per visit, so a search and collection mode share them.
//
// DESIGN-PHASE SIMPLIFICATION, deliberate and temporary: this loads every set's
// DETAIL chunk (~225 kB gzip served, since #929 slimmed them) rather than the 66 kB
// index. The index carries no keywords and no card text, and both are real filters:
// measured on Set 1, "Evasive" hits 11 cards across 6 spreads and the text "banish"
// hits 27 across all 9. Deciding the production tiering before the UI exists would be sizing a
// payload against a guess, which is the mistake that made this dataset 4x bigger
// than its first estimate. Revisit once the binder's needs are settled.

import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {withPrintingCards} from './binderCards';
import {loadCoreSetChunks, loadPreCoreSets} from './collectionChunks';
import {waitingPromos, withPromoPockets, type CollectionPromo} from './collectionPromos';
import {withPreCoreVariants} from './preCoreVariants';
import type {LorcanaCard} from 'inkweave-synergy-engine';

interface CollectionCardsContextValue {
  /**
   * Non-Core cards, transformed, each pre-Core card with its printings in `variants` (#891).
   * Empty until collection mode asks for them.
   */
  cards: LorcanaCard[];
  /** Every promo in the owner's catalog (#805), loaded with the cards. Empty until then. */
  promos: CollectionPromo[];
  /** True while chunks are in flight. */
  isLoading: boolean;
  /**
   * True once every chunk has landed. NOT the same as "not loading": before the
   * first request starts, `isLoading` is also false, so a guard written as
   * `!isLoading` would pass over an empty pool for that first render.
   */
  loaded: boolean;
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

export function CollectionCardsProvider({children}: {children: ReactNode}) {
  const [cards, setCards] = useState<LorcanaCard[]>([]);
  const [promos, setPromos] = useState<CollectionPromo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Guards the one-shot fetch. A REF and not state, because it must flip
   * synchronously within a single call — two `ensureLoaded()` calls in the same
   * tick (both modes asking at once) would both see a stale `false` from state
   * and fire every chunk request twice.
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
    // Sets 1-8 may be in already, loaded by a search in Browse (#911).
    Promise.all([loadPreCoreSets(), loadCoreSetChunks()])
      .then(([preCore, coreSets]) => {
        setCards(withPreCoreVariants([...preCore.cards, ...coreSets], preCore.promos));
        setPromos(preCore.promos);
        setLoaded(true);
      })
      .catch((err: Error) => {
        // All or nothing, on purpose — see `error` above.
        setCards([]);
        setPromos([]);
        setError(`Could not load the collection (${err.message}).`);
        // `started` STAYS true. Resetting it here is what turned a failed load
        // into an infinite one: the catch sets state, the provider re-renders,
        // `ensureLoaded` gets a fresh identity, the effect below sees its dep
        // change and calls it again, and the guard it would have hit is gone.
        // A request per chunk on every iteration, forever, against a 404. Retrying is
        // now explicit; see `retry`.
      })
      .finally(() => setIsLoading(false));
  }

  /** Clear the one-shot guard and load again. Only ever called by a user action. */
  function retry() {
    started.current = false;
    ensureLoaded();
  }

  const value: CollectionCardsContextValue = {cards, promos, isLoading, loaded, error, ensureLoaded, retry};
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
 * Core plus the collection: with a card for each printing the chunks do not carry, so every
 * printing has a pocket, and a pocket for every promo whose card it holds (#805), the promos
 * whose card no dataset holds yet waiting apart.
 */
function collectionPool(coreCards: LorcanaCard[], cards: LorcanaCard[], promos: readonly CollectionPromo[]) {
  const printings = withPrintingCards([...coreCards, ...cards]);
  return {pool: withPromoPockets(printings, promos), waiting: waitingPromos(printings, promos)};
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
  const {cards, promos, isLoading, loaded, error, ensureLoaded} = useCollectionCards();

  useEffect(() => {
    if (active) ensureLoaded();
  }, [active, ensureLoaded]);

  const {pool, waiting} = active ? collectionPool(coreCards, cards, promos) : {pool: coreCards, waiting: []};
  return {
    pool,
    /** The promos whose card no dataset holds yet: the binder names their pockets. */
    waiting,
    isLoading: active && isLoading,
    error: active ? error : null,
    /**
     * The pool is COMPLETE: every non-Core chunk landed AND the Core cards are in.
     * The import must wait for this, not merely for "not loading", or it parses
     * against a partial pool and silently drops the cards it cannot see. Core
     * matters too: on a direct load of /account the Core data can still be empty
     * when the chunks arrive.
     */
    isReady: active && loaded && error === null && coreCards.length > 0,
  };
}
