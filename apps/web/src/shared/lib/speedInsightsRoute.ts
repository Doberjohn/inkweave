import {useLocation, useMatches, type RouteObject} from 'react-router-dom';

// The route `handle` key withSpeedInsightsRoutes writes and useSpeedInsightsRoute reads.
const LABEL_KEY = 'speedInsightsRoute';

/**
 * Tags every route in the tree with the pattern Speed Insights files its visits under, such as
 * `/card/[cardId]/[slug]` for `card/:cardId/:slug`. router.tsx wraps its whole tree in this.
 *
 * Speed Insights works out route patterns by itself only in the frameworks it integrates with,
 * like Next.js, so without a label every visit is filed under "Unknown". The label comes from
 * the route definition, not the URL, so a percent-encoded URL or a slug that spells a static
 * segment (`/card/1936/card`) still gets the right one. The package's own `computeRoute` gets
 * both wrong: it searches the URL text for each param's decoded value.
 */
export function withSpeedInsightsRoutes(routes: RouteObject[], parentPath = ''): RouteObject[] {
  return routes.map((route) => {
    const path = joinRoutePath(parentPath, route.path);
    const handle = {...route.handle, [LABEL_KEY]: toLabel(path)};
    if (!route.children) return {...route, handle};
    return {...route, handle, children: withSpeedInsightsRoutes(route.children, path)};
  });
}

/** The matched route's label, for AppLayout's `<SpeedInsights route={…} />`. */
export function useSpeedInsightsRoute(): string {
  const {pathname} = useLocation();
  const matches = useMatches();
  // Every route in a wrapped tree has a label, so the pathname is only a fallback. It is never
  // null: SpeedInsights reads a null route as "not known yet" and skips loading its script.
  return labelOf(matches.at(-1)?.handle) ?? pathname;
}

/** Index and pathless routes take their parent's path; a leading slash makes a path absolute. */
function joinRoutePath(parentPath: string, path: string | undefined): string {
  if (path === undefined) return parentPath;
  if (path.startsWith('/')) return path;
  return `${parentPath.replace(/\/$/, '')}/${path}`;
}

function toLabel(path: string): string {
  return path.split('/').map(labelSegment).join('/') || '/';
}

function labelSegment(segment: string): string {
  if (segment === '*') return '[*]';
  if (!segment.startsWith(':')) return segment;
  return `[${segment.slice(1).replace(/\?$/, '')}]`;
}

function labelOf(handle: unknown): string | undefined {
  if (typeof handle !== 'object' || handle === null) return undefined;
  const label = (handle as Record<string, unknown>)[LABEL_KEY];
  return typeof label === 'string' ? label : undefined;
}
