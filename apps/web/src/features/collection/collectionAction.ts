/**
 * What pressing "Collection" should do.
 *
 * Pure and separate from the page because the alternative is untestable: the
 * two interesting branches need a real OAuth session, so inside a click handler
 * they can only be verified by signing in and clicking. As a function they are
 * four assertions.
 *
 * ORDERED BY WHAT IS MISSING, and the order is the rule. Sign-in is checked
 * first, so `'import'` can never be reached without an account — which is what
 * lets the page mount both dialogs unconditionally without them contending.
 *
 * `'wait'`: signed in with no collection in this browser while the sync has not yet
 * heard from the account. Its copy may be the collection (a new browser), so offering
 * an import now could replace it; the page opens the binder and decides once it hears.
 */
export type CollectionAction = 'sign-in' | 'wait' | 'import' | 'toggle';

export function collectionAction({
  signedIn,
  hasCollection,
  syncing,
}: {
  signedIn: boolean;
  hasCollection: boolean;
  /** True while the account's copy has not answered (`useCollection().syncing`). */
  syncing: boolean;
}): CollectionAction {
  // Deliberately BEFORE the collection check. Collections predate the sign-in
  // gate and live in localStorage, so a returning visitor can hold one while
  // signed out; honouring it would make the gate decorative.
  if (!signedIn) return 'sign-in';
  if (hasCollection) return 'toggle';
  return syncing ? 'wait' : 'import';
}
