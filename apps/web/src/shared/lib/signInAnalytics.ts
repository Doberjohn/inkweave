import type {Session} from '@supabase/auth-js';
import type {AuthProvider} from '../contexts/SessionContext';
import {trackEvent, type SignInSurface} from './analytics';

export type {SignInSurface};

/** Why a sign-in did not complete. Must match the catalog's `sign_in_failed` union. */
export type SignInFailureReason = 'error' | 'cancelled' | 'timeout';

interface SignInStart {
  provider: AuthProvider;
  surface: SignInSurface;
}

/** Fire `sign_in_shown` when the dialog opens, before any provider press. */
export function trackSignInShown(shown: {surface: SignInSurface}): void {
  trackEvent('sign_in_shown', shown);
}

/** Fire `sign_in_started` when a provider button is pressed. */
export function trackSignInStarted(start: SignInStart): void {
  trackEvent('sign_in_started', start);
}

/** The session's provider as the catalog spells it: a provider name, never an identity. */
function providerOf(session: Session): 'google' | 'discord' | 'other' {
  const provider = session.user.app_metadata.provider;
  return provider === 'google' || provider === 'discord' ? provider : 'other';
}

/** Fire `sign_in_completed` for the session `/auth/callback` saw arrive. */
export function trackSignInCompleted(session: Session): void {
  trackEvent('sign_in_completed', {provider: providerOf(session)});
}

interface SignInFailure {
  provider: AuthProvider | null;
  stage: 'start' | 'callback';
  reason: SignInFailureReason;
}

/** Fire `sign_in_failed` for a start the dialog couldn't make, or a callback that gave up. */
export function trackSignInFailed(failure: SignInFailure): void {
  trackEvent('sign_in_failed', failure);
}

/**
 * Why the provider sent the visitor back without a session: the OAuth `error` it added to the
 * callback URL, in the fragment (Supabase's docs) or the query. `access_denied` means the
 * visitor declined.
 */
export function callbackFailureReason({
  search,
  hash,
}: Pick<Location, 'search' | 'hash'>): SignInFailureReason {
  const error =
    new URLSearchParams(search).get('error') ?? new URLSearchParams(hash.slice(1)).get('error');
  if (error === null) return 'timeout';
  return error === 'access_denied' ? 'cancelled' : 'error';
}
