/**
 * The address of a friend's binder: the binder `scope` names (a set, `all` for their whole
 * collection, as the Friends list links it), `?binder=<scope>&friend=<handle>`. Spelled out
 * rather than built from `binderCards`' params: importing that module here would take it out
 * of the collection's chunk into one of its own, shared with this one. `binderCards.test.ts`
 * checks they agree.
 */
export const friendBinderPath = (handle: string, scope = 'all') =>
  `/browse?binder=${encodeURIComponent(scope)}&friend=${encodeURIComponent(handle)}`;
