// The signed-in user's public identity: the name their decks are published under.
//
// Separate from SessionContext on purpose. SessionContext lives in `shared/`, and a
// shared module importing a feature inverts the layering — so identity, which is a
// profile concern, gets its own provider here and reads the session rather than the
// other way round.
import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import {useSession} from '../../shared/contexts/SessionContext';
import {claimIdentity, type PublicIdentity} from './profileRepository';

interface ProfileContextValue {
  /** Both names, or null while being claimed / when signed out. */
  identity: PublicIdentity | null;
  /** True only while a signed-in user's identity is in flight. */
  loading: boolean;
  /**
   * Adopt a display name the user just saved, so every reader updates without a
   * refetch. The write itself is `updateDisplayName`; this is the local echo.
   */
  adoptDisplayName: (displayName: string) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

/** What a consumer sees with no provider above it (Storybook, isolated tests). */
const SIGNED_OUT: ProfileContextValue = {identity: null, loading: false, adoptDisplayName: () => {}};

/** A finished claim, tagged with the user it answers for. */
interface ClaimedIdentity {
  userId: string;
  identity: PublicIdentity | null;
}

export function ProfileProvider({children}: {children: ReactNode}) {
  const {user} = useSession();
  const userId = user?.id ?? null;
  const [claimed, setClaimed] = useState<ClaimedIdentity | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    // Safe to fire on every sign-in with no guard: claim_handle returns an existing
    // handle untouched and never overwrites a display name the user chose. That
    // idempotence is why there is no "have I already claimed?" flag here — a flag
    // would be a second source of truth for something the database already answers.
    void claimIdentity().then(({data}) => {
      if (active) setClaimed({userId, identity: data});
    });
    return () => {
      active = false;
    };
  }, [userId]);

  /*
    A stored claim counts only for the user it came from; against anyone else there is
    no identity and the state is loading again. Deriving that instead of clearing it in
    the effect is what keeps sign-out from needing a synchronous setState, which
    cascades renders and `react-hooks/set-state-in-effect` rejects. Same shape as
    DecksPage's keyed deck-list reads, for the same reason.
  */
  const resolved = claimed?.userId === userId ? claimed : null;

  const value: ProfileContextValue = {
    identity: resolved?.identity ?? null,
    loading: userId !== null && resolved === null,
    // The handle is carried through unchanged: renaming yourself changes what people
    // READ, never the identity the uniqueness index and future /u/ URLs are built on.
    adoptDisplayName: (displayName: string) => {
      setClaimed((prev) => (prev?.identity ? {...prev, identity: {...prev.identity, displayName}} : prev));
    },
  };
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

/**
 * The caller's public identity.
 *
 * Returns the signed-out default outside a provider rather than throwing, matching
 * `useIsSignedIn`: this is read by page chrome that also renders in stories, and
 * demanding a provider there would break them for one nullable object.
 */
export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext) ?? SIGNED_OUT;
}
