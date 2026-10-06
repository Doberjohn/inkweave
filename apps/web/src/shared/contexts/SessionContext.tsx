// Auth session state for the app (#463). Wraps Supabase Auth: seeds from the stored
// session, subscribes to auth changes, and exposes sign-in (Google/Discord OAuth) +
// sign-out. When Supabase env is unset auth is `enabled: false` and the actions are safe
// no-ops, so the app degrades gracefully, exactly like voting.
//
// This provider downloads supabase-js only when there is a session to restore (#729): a stored
// one, or an OAuth code on its way back. For an anonymous visitor it fetches nothing; their
// sign-in click loads the SDK on the way to the provider. (Other features still load it on
// first use: a vote, a pair's community scores, a profile call.) The accepted cost: a sign-in completed in another tab
// shows up here only after a reload, since no client is listening for it.
import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import type {Session, User} from '@supabase/supabase-js';
import {AUTH_STORAGE_KEY, isSupabaseConfigured, loadSupabase} from '../lib/supabase';

export type AuthProvider = 'google' | 'discord';

interface SessionContextValue {
  session: Session | null;
  user: User | null;
  /** True until the initial session lookup resolves. */
  loading: boolean;
  /** False when Supabase env is not configured (auth unavailable). */
  enabled: boolean;
  /** Start an OAuth redirect. Returns `{error}` if it could not be initiated. */
  signIn: (provider: AuthProvider) => Promise<{error: string | null}>;
  /** End the session. Returns `{error}` if Supabase refused the logout. */
  signOut: () => Promise<{error: string | null}>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const AUTH_CALLBACK_PATH = '/auth/callback';

/**
 * Whether this visit has a session for supabase-js to restore: a stored one, or the OAuth
 * code the provider just sent back. The code is checked as well as the path because Supabase
 * falls back to the Site URL (`/?code=…`) when it rejects `redirectTo`. When storage cannot be
 * read we cannot rule a session out, so the answer is yes and the SDK loads, as it did for
 * everyone before #729.
 */
function hasSessionToRestore(): boolean {
  if (window.location.pathname === AUTH_CALLBACK_PATH) return true;
  if (new URLSearchParams(window.location.search).has('code')) return true;
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

/*
  signIn and signOut live out here rather than inside SessionProvider. Neither reads
  React state, and as closures their guards counted toward the provider's cyclomatic
  complexity, which tipped past CodeScene's threshold when signOut started reporting
  its error. The provider now just exposes them.
*/

/** Start an OAuth redirect. The provider round-trip returns to `/auth/callback`. */
async function startOAuth(provider: AuthProvider): Promise<{error: string | null}> {
  if (!isSupabaseConfigured()) return {error: 'Sign-in is unavailable (auth not configured).'};
  try {
    const supabase = await loadSupabase();
    if (!supabase) return {error: 'Sign-in is unavailable (auth not configured).'};
    const {error} = await supabase.auth.signInWithOAuth({
      provider,
      options: {redirectTo: `${window.location.origin}${AUTH_CALLBACK_PATH}`},
    });
    return {error: error?.message ?? null};
  } catch {
    return {error: 'Sign-in could not start. Check your connection and try again.'};
  }
}

/**
 * End the session, reporting a refusal rather than swallowing it.
 *
 * Supabase can decline a logout (an expired refresh token, a dropped connection), and
 * discarding that left the user pressing a button that appeared to do nothing while
 * they stayed signed in. With nothing configured there is no session to end, so that is
 * a vacuous success, not an error; it is unreachable anyway, since the control only
 * renders for a signed-in user.
 */
async function endSession(): Promise<{error: string | null}> {
  if (!isSupabaseConfigured()) return {error: null};
  try {
    const supabase = await loadSupabase();
    if (!supabase) return {error: null};
    const {error} = await supabase.auth.signOut();
    return {error: error?.message ?? null};
  } catch {
    return {error: 'Could not sign out. Check your connection and try again.'};
  }
}

/**
 * The session supabase-js restores, and whether that lookup is still running. With nothing
 * to restore it downloads nothing and resolves at once: no session, not loading.
 */
function useRestoredSession(restoring: boolean): {session: Session | null; loading: boolean} {
  const [session, setSession] = useState<Session | null>(null);
  // Only "loading" while there is a session to look up; otherwise resolve immediately.
  const [loading, setLoading] = useState(restoring);

  useEffect(() => {
    if (!restoring) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;

    loadSupabase()
      .then((supabase) => {
        // Unmounted while the SDK downloaded: subscribing now would leak the listener.
        if (!active || !supabase) return;
        const {data} = supabase.auth.onAuthStateChange((_event, next) => {
          setSession(next);
        });
        unsubscribe = () => data.subscription.unsubscribe();
        return supabase.auth.getSession().then(({data: stored}) => {
          if (active) setSession(stored.session);
        });
      })
      .catch(() => {
        // SDK download, network or storage failure: swallow so the loading gate still
        // resolves below.
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [restoring]);

  return {session, loading};
}

export function SessionProvider({children}: {children: ReactNode}) {
  const enabled = isSupabaseConfigured();
  // Decided once per page load: the stored session only appears or disappears through
  // supabase-js itself, which is already loaded by then.
  const [restoring] = useState(() => enabled && hasSessionToRestore());
  const {session, loading} = useRestoredSession(restoring);

  const value: SessionContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    enabled,
    signIn: startOAuth,
    signOut: endSession,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

/**
 * Signed-in state for components that REACT to auth without REQUIRING it.
 *
 * Unlike `useSession`, this returns false outside a SessionProvider rather than
 * throwing. The desktop nav needs it: CompactHeader is rendered at 18 call sites
 * and by Storybook stories that wrap in MemoryRouter alone, so demanding a
 * provider there would break all of them for a single boolean.
 *
 * Returns false during the auth-loading window, so a returning signed-in user
 * reads as signed out for a beat on page load. Accepted: nothing is auth-gated
 * yet. When the first gated nav item ships (#452), decide then whether to gate
 * on `!loading` or reserve the item's width to avoid a layout shift.
 */
export function useIsSignedIn(): boolean {
  const context = useContext(SessionContext);
  return context?.user != null;
}
