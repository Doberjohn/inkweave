import {useEffect, useSyncExternalStore} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';

/*
 * Browse's search over sets 1-8 (#911): the cards Core doesn't have, loaded the first time a
 * visitor searches, and kept for the visit, so leaving Browse and coming back costs nothing.
 *
 * The import is DYNAMIC on purpose: a static path from Browse into features/collection would
 * ship collection mode's data layer to every Browse visitor (BrowsePage.tsx says why). The
 * state is module state, read through useSyncExternalStore as cardOverviewModalLoader.ts's
 * is: a plain read of it could be memoized by the React Compiler as if it never changed.
 */

interface PreCoreSearch {
  status: 'idle' | 'loading' | 'loaded' | 'failed';
  cards: LorcanaCard[];
  byId: ReadonlyMap<string, LorcanaCard>;
}

const NO_CARDS: Pick<PreCoreSearch, 'cards' | 'byId'> = {cards: [], byId: new Map()};
let search: PreCoreSearch = {status: 'idle', ...NO_CARDS};
const listeners = new Set<() => void>();

function setSearch(next: PreCoreSearch) {
  search = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSearch = () => search;

/** Starts the load unless it is running or done. After a failure, the next search starts it again. */
function requestPreCoreCards() {
  if (search.status === 'loading' || search.status === 'loaded') return;
  setSearch({...search, status: 'loading'});
  import('../features/collection/collectionChunks')
    .then((chunks) => chunks.loadPreCoreSearchCards())
    .then(
      (cards) => setSearch({status: 'loaded', cards, byId: new Map(cards.map((card) => [card.id, card]))}),
      // The search keeps Core's matches, as it had before #911. A failed import (a stale
      // chunk after a deploy) lands here too.
      () => setSearch({status: 'failed', ...NO_CARDS}),
    );
}

/**
 * The sets 1-8 cards Browse's search lists beside Core's (#911), loaded the first time
 * `wanted` is true in a visit: the first letter typed, or a page opened with a search.
 *
 * The effect depends on `wanted` alone, so a failed load is tried again only when a new
 * search starts or Browse mounts again, never in a loop. It is loading from the first render
 * a search is wanted, before the effect starts the load: that render paints first.
 */
export function usePreCoreSearchCards(wanted: boolean) {
  const current = useSyncExternalStore(subscribe, getSearch, getSearch);
  useEffect(() => {
    if (wanted) requestPreCoreCards();
  }, [wanted]);
  const pending = current.status === 'idle' || current.status === 'loading';
  return {cards: current.cards, byId: current.byId, isLoading: wanted && pending};
}
