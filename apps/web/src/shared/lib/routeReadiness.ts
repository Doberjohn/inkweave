import {matchRoutes, type Params, type RouteObject} from 'react-router-dom';

/**
 * What a route needs before the app's first render can show it whole: its page's code and the
 * data that page would otherwise show a skeleton for. router.tsx gives each prerendered route one
 * as `handle.ready`, through `readyWhen`.
 */
type RouteReady = (params: Params) => Promise<unknown>;

/**
 * A prerendered route's `handle`: what it waits for before main.tsx stops holding its page (#915),
 * the page's code plus the data it would otherwise show a skeleton for. It settles once each has
 * arrived or failed, so a request that fails first leaves the others to arrive, and the app's
 * first render shows the page whole, with its error where the failed data would be.
 */
export function readyWhen(
  page: {preload: () => Promise<unknown>},
  ...data: ((params: Params) => Promise<unknown>)[]
): {ready: RouteReady} {
  return {
    ready: (params) => Promise.allSettled([page.preload(), ...data.map((load) => load(params))]),
  };
}

function readyOf(handle: unknown): RouteReady | undefined {
  if (typeof handle !== 'object' || handle === null) return undefined;
  const {ready} = handle as {ready?: unknown};
  return typeof ready === 'function' ? (ready as RouteReady) : undefined;
}

/**
 * Settles once every route `pathname` matches has what its `handle.ready` waits for, or has
 * failed to get it. main.tsx holds the prerendered page on screen until then (#915), so the
 * app's first commit is the page itself, never its fallback or skeleton.
 */
export async function whenRouteReady(routes: RouteObject[], pathname: string): Promise<void> {
  const matches = matchRoutes(routes, pathname) ?? [];
  await Promise.allSettled(matches.map(({route, params}) => readyOf(route.handle)?.(params)));
}
