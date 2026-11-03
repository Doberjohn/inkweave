/**
 * Address params whose value names a player, one of their binders, or is a sign-in's one-time
 * code: a friend's binder and a binder of your own (binderCards' FRIEND_PARAM and CUSTOM_PARAM;
 * literals, so every build loads this without the collection's code) and the sign-in return.
 * PostHog masks the same three (posthogClient.ts).
 */
const ACCOUNT_PARAMS = ['friend', 'custom', 'code'];

/**
 * Both Vercel tools' `beforeSend`. Their scripts send the page's whole address, query included,
 * unless the path they're handed differs from the page's own, which here it never does. Vercel
 * reads only the path and the `utm_` params from it, so dropping these keeps a friend's handle, a
 * binder's id and a sign-in code in the browser. An address with none goes as it came, encoding
 * and all.
 */
export function withoutAccountParams<E extends {url: string}>(event: E): E {
  const url = new URL(event.url);
  if (!ACCOUNT_PARAMS.some((name) => url.searchParams.has(name))) return event;
  for (const name of ACCOUNT_PARAMS) url.searchParams.delete(name);
  return {...event, url: url.href};
}
