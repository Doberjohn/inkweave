import {computeRoute} from '@vercel/speed-insights/react';
import {useLocation, useParams} from 'react-router-dom';

/**
 * The current page as a route pattern for Speed Insights, such as `/card/[cardId]/[slug]`.
 *
 * Speed Insights works out route patterns by itself only in the frameworks it integrates with,
 * like Next.js. Without this, every visit is filed under "Unknown", and the dashboard can't tell
 * card pages from the homepage. The package's own Remix entry computes the route the same way.
 * Called from the root layout, `useParams` still returns the params of the child route that
 * matched.
 *
 * Imported by path rather than through the hooks barrel, which admin re-exports (#593), so
 * `@vercel/speed-insights` stays out of admin's import graph.
 */
export function useSpeedInsightsRoute(): string {
  const {pathname} = useLocation();
  const params = useParams();
  // React Router types a param as possibly undefined (an absent optional segment), and one
  // undefined value makes computeRoute fall back to the raw pathname, so pass only present ones.
  const present = Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  // Never null: SpeedInsights reads a null route as "not known yet" and skips loading its script.
  return computeRoute(pathname, present) ?? pathname;
}
