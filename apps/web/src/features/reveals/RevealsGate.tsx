import type {ReactNode} from 'react';
import {Navigate} from 'react-router-dom';
import {useRevealPhase} from './useRevealPhase';

/**
 * Renders children during reveal season (`pre-release` / `pre-release-live`).
 * Redirects to `/` when the phase is `hidden` (flag off) or `released` (past wide release).
 */
export function RevealsGate({children}: {children: ReactNode}) {
  const phase = useRevealPhase();
  // 'loading' means the flag is on but reveal dates are still being fetched —
  // let children mount (the page handles its own loading state) so we don't
  // race-redirect before dates resolve.
  if (phase === 'hidden' || phase === 'released') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
