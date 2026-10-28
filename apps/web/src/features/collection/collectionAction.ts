/**
 * What pressing "Collection" should do.
 *
 * Pure and separate from the page because the alternative is untestable: the
 * two interesting branches need a real OAuth session, so inside a click handler
 * they can only be verified by signing in and clicking. As a function they are
 * three assertions.
 *
 * ORDERED BY WHAT IS MISSING, and the order is the rule. Sign-in is checked
 * first, so `'start'` can never be reached without an account.
 *
 * `'start'`: signed in with no collection in this browser. The binder opens at once, and an
 * empty collection is started for it once the account is known to hold none
 * (`startCollection`): its copy may be the collection (a new browser), which the start then
 * adopts instead. A player with a Dreamborn export imports from the empty binder's cover.
 */
export type CollectionAction = 'sign-in' | 'start' | 'toggle';

export function collectionAction({signedIn, hasCollection}: {signedIn: boolean; hasCollection: boolean}): CollectionAction {
  // Deliberately BEFORE the collection check. Collections predate the sign-in
  // gate and live in localStorage, so a returning visitor can hold one while
  // signed out; honouring it would make the gate decorative.
  if (!signedIn) return 'sign-in';
  return hasCollection ? 'toggle' : 'start';
}

/** Where the Collection button's click stands: who is asking, and whether the binder shows. */
export interface ClickState {
  signedIn: boolean;
  hasCollection: boolean;
  /** Collection mode is on: the binder shows. */
  active: boolean;
}

/** What a click can do. */
export interface ClickActs {
  openSignIn: () => void;
  /** Start an empty collection once the account is known to hold none (`startCollection`). */
  start: () => void;
  enter: () => void;
  leave: () => void;
}

/**
 * The Collection button's click: sign in, or toggle the binder, starting a collection on the
 * way in for a reader with none. The binder loads while the account answers, and keeps
 * whichever collection it answers with, the started one or its own.
 */
export function collectionClick(state: ClickState, acts: ClickActs): void {
  const action = collectionAction(state);
  if (action === 'sign-in') return acts.openSignIn();
  if (state.active) return acts.leave();
  if (action === 'start') acts.start();
  acts.enter();
}
