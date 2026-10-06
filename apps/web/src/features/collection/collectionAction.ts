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
 */
export type CollectionAction = 'sign-in' | 'import' | 'toggle';

export function collectionAction({
  signedIn,
  hasCollection,
}: {
  signedIn: boolean;
  hasCollection: boolean;
}): CollectionAction {
  // Deliberately BEFORE the collection check. Collections predate the sign-in
  // gate and live in localStorage, so a returning visitor can hold one while
  // signed out; honouring it would make the gate decorative.
  if (!signedIn) return 'sign-in';
  if (!hasCollection) return 'import';
  return 'toggle';
}
