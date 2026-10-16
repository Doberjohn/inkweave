import {useState} from 'react';
import {collectionAction} from './collectionAction';

/** Where the Collection button's click stands: who is asking, and what is known yet. */
export interface ClickState {
  signedIn: boolean;
  hasCollection: boolean;
  /** The account's copy has not answered yet (`useCollection().syncing`). */
  syncing: boolean;
  /** Collection mode is on: the binder shows. */
  active: boolean;
}

/** What a click can do. */
export interface ClickActs {
  openSignIn: () => void;
  openImport: () => void;
  enter: () => void;
  leave: () => void;
}

/**
 * The Collection button's click (#553 Phase C): sign in, import, or toggle, by
 * `collectionAction`. Its `'wait'` (signed in, nothing in this browser, the account
 * not answered yet) toggles too: the binder opens at once and loads meanwhile, and
 * the click is decided when the account answers. A collection that arrives keeps the
 * binder; none offers the import the click would have offered, never one over a
 * collection that lives only on the server.
 *
 * Decided in render (the "previous render" pattern), so the answer and the import
 * land in the same pass, and by `collectionAction` again, so a visitor who signed
 * out meanwhile is offered nothing. Closing the binder first withdraws the click.
 */
export function useCollectionClick(state: ClickState, acts: ClickActs): () => void {
  const [awaiting, setAwaiting] = useState(false);
  if (awaiting && !state.syncing) {
    setAwaiting(false);
    if (collectionAction(state) === 'import') acts.openImport();
  }

  return () => {
    const action = collectionAction(state);
    if (action === 'sign-in') return acts.openSignIn();
    if (action === 'import') return acts.openImport();
    if (state.active) {
      setAwaiting(false);
      return acts.leave();
    }
    if (action === 'wait') setAwaiting(true);
    acts.enter();
  };
}
