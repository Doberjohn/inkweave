// The signed-in user's public identity: the name their decks are published under.
//
// Separate from SessionContext on purpose. SessionContext lives in `shared/`, and a
// shared module importing a feature inverts the layering — so identity, which is a
// profile concern, gets its own provider here and reads the session rather than the
// other way round.
import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import {useSession} from '../../shared/contexts/SessionContext';
import {NOT_CONFIGURED} from '../../shared/lib/repoResult';
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

/**
 * What the caller sees, given the last claim and who is signed in now.
 *
 * A stored claim counts only for the user it came from; against anyone else there is
 * no identity and the state is loading again. Deriving that instead of clearing it in
 * an effect is what keeps sign-out from needing a synchronous setState, which cascades
 * renders and `react-hooks/set-state-in-effect` rejects. Same shape as DecksPage's
 * keyed deck-list reads, for the same reason.
 */
function resolveClaim(claimed: ClaimedIdentity | null, userId: string | null) {
  const resolved = claimed?.userId === userId ? claimed : null;
  return {identity: resolved?.identity ?? null, loading: userId !== null && resolved === null};
}

/**
 * Rename in place. The handle is carried through unchanged: renaming yourself changes
 * what people READ, never the identity the uniqueness index and future /u/ URLs are
 * built on. A claim that has not landed yet has nothing to rename.
 */
function withDisplayName(displayName: string) {
  return (prev: ClaimedIdentity | null): ClaimedIdentity | null =>
    prev?.identity ? {...prev, identity: {...prev.identity, displayName}} : prev;
}

/**
 * Retry budget for a failed claim.
 *
 * A stored claim is FINAL: the effect only runs again when `userId` changes, so a
 * network blip recorded as `identity: null` leaves the account page showing "—" with no
 * Change button until the user signs out and back in. Retrying is safe because
 * `claim_handle` is idempotent, so the only cost of a redundant call is the round trip.
 */
const CLAIM_RETRIES = 2;
/** Short on purpose: the account page is rendering a loading state while this runs. */
const CLAIM_RETRY_MS = 1500;

export function ProfileProvider({children}: {children: ReactNode}) {
  const {user} = useSession();
  const userId = user?.id ?? null;
  const [claimed, setClaimed] = useState<ClaimedIdentity | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Safe to fire on every sign-in with no guard: claim_handle returns an existing
    // handle untouched and never overwrites a display name the user chose. That
    // idempotence is why there is no "have I already claimed?" flag here — a flag
    // would be a second source of truth for something the database already answers.
    // It is also what makes the retry free: a repeat call cannot double-claim.
    const attempt = (retriesLeft: number) => {
      void claimIdentity().then(({data, error}) => {
        if (!active) return;
        // NOT_CONFIGURED is a permanent answer (no credentials in this environment),
        // so it settles immediately rather than burning the budget on a certain failure.
        if (error !== null && error !== NOT_CONFIGURED && retriesLeft > 0) {
          timer = setTimeout(() => attempt(retriesLeft - 1), CLAIM_RETRY_MS);
          return;
        }
        setClaimed({userId, identity: data});
      });
    };
    attempt(CLAIM_RETRIES);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [userId]);

  const value: ProfileContextValue = {
    ...resolveClaim(claimed, userId),
    adoptDisplayName: (displayName: string) => setClaimed(withDisplayName(displayName)),
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
