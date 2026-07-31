// Auth session state for the app (#463). Wraps Supabase Auth: seeds from the stored
// session, subscribes to auth changes, and exposes sign-in (Google/Discord OAuth) +
// sign-out. When Supabase env is unset (getSupabase() === null) auth is `enabled: false`
// and the actions are safe no-ops, so the app degrades gracefully, exactly like voting.
import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import type {Session, User} from '@supabase/supabase-js';
import {getSupabase} from '../lib/supabase';

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
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({children}: {children: ReactNode}) {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  // Only "loading" when auth is actually available; otherwise resolve immediately.
  const [loading, setLoading] = useState(supabase !== null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth
      .getSession()
      .then(({data}) => {
        if (active) setSession(data.session);
      })
      .catch(() => {
        // Network or storage failure: swallow so the loading gate still resolves below.
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const {data} = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = async (provider: AuthProvider): Promise<{error: string | null}> => {
    if (!supabase) return {error: 'Sign-in is unavailable (auth not configured).'};
    const {error} = await supabase.auth.signInWithOAuth({
      provider,
      options: {redirectTo: `${window.location.origin}/auth/callback`},
    });
    return {error: error?.message ?? null};
  };

  const signOut = async (): Promise<void> => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const value: SessionContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    enabled: supabase !== null,
    signIn,
    signOut,
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
