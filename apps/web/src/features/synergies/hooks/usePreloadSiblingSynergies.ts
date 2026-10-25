import {useEffect} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../../shared/contexts/CardDataContext';
import {whenIdle} from '../../../shared/lib/whenLoadedAndIdle';
import {siblingStep} from '../../../shared/utils/siblingStep';
import {fetchCardSynergies} from './usePrecomputedSynergies';

export interface SiblingSynergiesPreload {
  /** The cards the window's arrows step through, in order (`siblingCardIds`). */
  ids: readonly string[];
  /** The open card's place in `ids`, or -1. */
  index: number;
  /** The open card's synergies have settled, so the preload never holds that file up. */
  settled: boolean;
}

/** The cards one step away from `index`: the previous and the next, as the arrows reach them. */
export function stepNeighbours(ids: readonly string[], index: number): string[] {
  const previous = siblingStep(ids, index, -1);
  if (previous === -1) return [];
  return [ids[previous], ids[siblingStep(ids, index, 1)]];
}

/** Fetches the synergy files of the cards in `ids` that are in Core, keeping any failure quiet. */
function preloadSynergies(ids: readonly (string | undefined)[], getCardById: (id: string) => LorcanaCard | undefined) {
  for (const id of ids) {
    if (id && getCardById(id)) fetchCardSynergies(id).catch(() => undefined);
  }
}

/**
 * Fetches the synergy files of the cards the window's arrows reach next, once the open card's own
 * has settled and the page is idle (its tiles have asked for their art by then), so a step draws
 * its synergy tiles on its first render rather than the loading tiles (`usePrecomputedSynergies`
 * settles from the cache). A step or a close before then fetches nothing. Skips cards outside
 * Core, which never have a file; a Core card with none answers 404, kept as none, so a step to it
 * shows its empty state at once. A failed fetch is forgotten (`fetchCardSynergies`), and the card
 * asks again when it opens.
 */
export function usePreloadSiblingSynergies({ids, index, settled}: SiblingSynergiesPreload): void {
  const {getCardById} = useCardDataContext();
  const [previous, next] = stepNeighbours(ids, index);

  useEffect(() => {
    if (!settled) return;
    return whenIdle(() => preloadSynergies([previous, next], getCardById));
  }, [settled, previous, next, getCardById]);
}
