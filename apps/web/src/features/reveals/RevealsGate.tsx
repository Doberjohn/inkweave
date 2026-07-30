import type {ReactNode} from 'react';
import {RevealsOffSeason} from './RevealsOffSeason';
import {useRevealPhase} from './useRevealPhase';

/**
 * Renders children during reveal season (`pre-release` / `pre-release-live`) and
 * an off-season notice when the phase is `hidden` (flag off) or `released` (past
 * wide release). It used to redirect to `/`, which left anyone arriving from a
 * bookmark, link or search on the homepage with no explanation.
 */
export function RevealsGate({children}: {children: ReactNode}) {
  const phase = useRevealPhase();
  // 'loading' means the flag is on but reveal dates are still being fetched —
  // let children mount (the page handles its own loading state) so we don't
  // race-redirect before dates resolve.
  if (phase === 'hidden' || phase === 'released') {
    return <RevealsOffSeason phase={phase} />;
  }
  return <>{children}</>;
}
