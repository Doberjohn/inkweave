import {useState} from 'react';
import {useSession} from '../../../shared/contexts/SessionContext';
import {upsertDeck, useDeck} from '../state';

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
  const {deck, markSaved} = useDeck();
  const {user} = useSession();
  const [state, setState] = useState<SaveState>('idle');

  /** No-ops when signed out; the caller offers sign-in instead. */
  const save = async () => {
    if (!user) return;
    setState('saving');
    // The draft is NEVER mutated here, only read. A failed write therefore leaves
    // the local deck byte-identical and still dirty, so nothing is lost by retrying.
    const {data, error} = await upsertDeck({...deck, ownerId: user.id}, user.id);
    if (error || !data) {
      // A null row with no error counts as failure too: there is nothing to bind
      // the draft to, so reporting success would be a lie.
      setState('error');
      return;
    }
    markSaved(data);
    setState('idle');
  };

  return {saveState: state, save, canSave: user != null};
}
