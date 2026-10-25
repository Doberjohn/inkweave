import {useEffect} from 'react';
import {useCardDataContext} from '../../../shared/contexts/CardDataContext';
import {fetchCardSynergies} from './usePrecomputedSynergies';

export interface SiblingSynergiesPreload {
  /** The cards the window's arrows step through, in order (`siblingCardIds`). */
  ids: readonly string[];
  /** The open card's place in `ids`, or -1. */
  index: number;
  /** The open card's synergies have settled, so the preload never competes with them. */
  settled: boolean;
}

/** The cards one step away from `index`: the previous and the next, wrapping at the ends as the arrows do. */
export function stepNeighbours(ids: readonly string[], index: number): string[] {
  const n = ids.length;
  if (n < 2 || index < 0) return [];
  return [ids[(index + n - 1) % n], ids[(index + 1) % n]];
}

/**
 * Fetches the synergy files of the cards an arrow or a swipe reaches next, once the open card's
 * have settled, so the step draws its synergy tiles on its first render rather than the loading
 * tiles (`usePrecomputedSynergies` settles from the cache). Skips cards outside Core, which have
 * no file. A failed fetch is forgotten, and the card asks again when it opens.
 */
export function usePreloadSiblingSynergies({ids, index, settled}: SiblingSynergiesPreload): void {
  const {getCardById} = useCardDataContext();
  const [previous, next] = stepNeighbours(ids, index);

  useEffect(() => {
    if (!settled) return;
    for (const id of [previous, next]) {
      if (id && getCardById(id)) fetchCardSynergies(id).catch(() => undefined);
    }
  }, [settled, previous, next, getCardById]);
}
