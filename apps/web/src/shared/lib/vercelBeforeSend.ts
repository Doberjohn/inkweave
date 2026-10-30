/**
 * Address params whose value names a player or is a sign-in's one-time code: a friend's binder
 * (binderCards' FRIEND_PARAM; a literal, so every build loads this without the collection's code)
 * and the sign-in return. PostHog masks the same two (posthogClient.ts).
 */
const ACCOUNT_PARAMS = ['friend', 'code'];

/**
 * Both Vercel tools' `beforeSend`. Their scripts send the page's whole address, query included,
 * unless the path they're handed differs from the page's own, which here it never does. Vercel
 * reads only the path and the `utm_` params from it, so dropping these two keeps a friend's handle
 * and a sign-in code in the browser. An address with neither goes as it came, encoding and all.
 */
export function withoutAccountParams<E extends {url: string}>(event: E): E {
  const url = new URL(event.url);
  if (!ACCOUNT_PARAMS.some((name) => url.searchParams.has(name))) return event;
  for (const name of ACCOUNT_PARAMS) url.searchParams.delete(name);
  return {...event, url: url.href};
}
