import {useEffect, useState} from 'react';
import {getDeck} from '../state';
import type {Deck} from '../types';

/**
 * Loads the deck named by `/decks/:id/edit` into the working draft, and reports
 * whether that id could not be read.
 *
 * Lives here rather than inline in `DeckBuilderPage` because its branches (no id,
 * already-loaded, cancelled, found/not-found) pushed that component to its
 * cyclomatic-complexity ceiling. The page is a large shell already; fetch
 * lifecycles belong beside the other deck hooks.
 *
 * Returns not-found for BOTH "no such deck" and "private, not yours": RLS returns
 * no row in either case and that ambiguity is deliberate, since distinguishing
 * them would leak whether an id exists.
 */
export function useRoutedDeck(
  id: string | undefined,
  currentDeckId: string,
  loadDeck: (deck: Deck) => void,
): boolean {
  // WHICH id failed, not a boolean "it failed". Both builder routes render the same
  // component at the same tree position, so a bare boolean outlives navigation from
  // /decks/:id/edit to /decks/new and strands the new deck behind a stale notice.
  // Deriving from `id` clears itself during render, with no reset effect and no
  // frame of wrong content on the primary "+ New deck" path. The route is keyed by
  // id as well (see router.tsx), so this is belt and braces, and cheap.
  const [notFoundId, setNotFoundId] = useState<string | null>(null);

  useEffect(() => {
    if (!id || currentDeckId === id) return;
    let cancelled = false;
    void getDeck(id).then(({data}) => {
      // Without this, navigating away mid-fetch sets state after unmount.
      if (cancelled) return;
      if (data) loadDeck(data);
      else setNotFoundId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [id, currentDeckId, loadDeck]);

  return !!id && notFoundId === id;
}
