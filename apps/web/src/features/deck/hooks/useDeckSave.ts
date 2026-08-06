import {useState} from 'react';
import {useSession} from '../../../shared/contexts/SessionContext';
import {upsertDeck, useDeck} from '../state';
import type {Deck} from '../types';

/** Idle covers both "never saved" and "saved fine"; the button label carries the difference. */
export type SaveState = 'idle' | 'saving' | 'error';

/**
 * Saving a deck to the account, with no confirmation step (owner ruling
 * 2026-08-02). Pressing Save saves: the deck name is already editable inline in
 * the panel header, so a dialog asking for it again was asking twice.
 *
 * Removing the dialog took away the only place an error could be shown, which is
 * why the state lives here and the toolbar renders it. A save that fails silently
 * is worse than one that asks a redundant question.
 *
 * Lives in a hook rather than in the page because `DeckBuilderPage` already sits
 * at its CodeScene complexity and length ceilings.
 */
export function useDeckSave() {
  const {deck, markSaved, setVisibility} = useDeck();
  const {user} = useSession();
  const [state, setState] = useState<SaveState>('idle');

  /**
   * No-ops when signed out; the caller offers sign-in instead.
   *
   * `patch` exists for edits that save themselves, currently only visibility
   * (owner ruling 2026-08-05: changing who can see a deck is not a two-step act).
   * It is needed because React state is not readable in the tick it is set, so an
   * auto-saving control has to hand its new value straight to the write rather
   * than save the value it is replacing.
   */
  const save = async (patch?: Partial<Deck>) => {
    if (!user) return;
    setState('saving');
    // The draft is NEVER mutated here, only read. A failed write therefore leaves
    // the local deck byte-identical and still dirty, so nothing is lost by retrying.
    const {data, error} = await upsertDeck({...deck, ...patch, ownerId: user.id}, user.id);
    if (error || !data) {
      // A null row with no error counts as failure too: there is nothing to bind
      // the draft to, so reporting success would be a lie.
      setState('error');
      return;
    }
    markSaved(data);
    setState('idle');
  };

  /**
   * Change who can see the deck, and write it. One decision, not a decision plus
   * a Save (owner ruling 2026-08-05).
   *
   * The new value goes straight to `save` rather than being read back from state,
   * which is not readable in the tick it is set. `save` stays the ONLY writer of
   * `is_public`, which is what stops a later Save from putting the old value back:
   * that clobber was a real, reproduced bug.
   *
   * Two cases deliberately do NOT write. Signed out there is nowhere to write to,
   * and an empty deck should not conjure a row in `decks` because someone flipped
   * a switch while looking at it. Both keep the choice locally, and the next real
   * Save carries it.
   */
  const changeVisibility = (isPublic: boolean) => {
    setVisibility(isPublic);
    if (user && deck.cards.length > 0) void save({isPublic});
  };

  return {saveState: state, save, changeVisibility, canSave: user != null};
}
