/**
 * The address of a friend's binder, as the Friends list links it: their whole
 * collection, `?binder=all&friend=<handle>`. Spelled out rather than built from
 * `binderCards`' params: importing that module here would take it out of the collection's
 * chunk into one of its own, shared with this one. `binderCards.test.ts` checks they agree.
 */
export const friendBinderPath = (handle: string) => `/browse?binder=all&friend=${encodeURIComponent(handle)}`;
