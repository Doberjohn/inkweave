/**
 * The address of a friend's binder: the binder `scope` names (a set, `all` for their whole
 * collection, as the Friends list links it), `?binder=<scope>&friend=<handle>`. Spelled out
 * rather than built from `binderCards`' params: importing that module here would take it out
 * of the collection's chunk into one of its own, shared with this one. `binderCards.test.ts`
 * checks they agree.
 */
export const friendBinderPath = (handle: string, scope = 'all') =>
  `/browse?binder=${encodeURIComponent(scope)}&friend=${encodeURIComponent(handle)}`;

/**
 * Where a link into a friend's binder sits, in the navigation's state, for `friend_binder_opened`'s
 * `from`: never in the address, which a shared link would carry along. A binder reached without
 * it, by its address alone, is `link`.
 */
export interface BinderEntry {
  binderFrom: 'friends_list' | 'friends_who_have_it';
}
